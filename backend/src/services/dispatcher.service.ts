import type {
    DispatchAudience,
    DispatchCampaignRow,
    DispatchJobRow,
    DispatchMode,
    DispatchRecipientRow,
} from '#repositories/dispatcher.repository';
import type { DatabaseSession } from '#db/connection';

import { loadEmailCooldownHours } from '#config/env';

import {
    claimCampaignForDispatch,
    completeCampaignDispatch,
    failCampaignDispatch,
    listPendingDispatchJobs,
    markDispatchLogsQueued,
    resolveDispatchAudience,
    seedPendingDispatchLogs,
    withCampaignDispatchLock,
} from '#repositories/dispatcher.repository';

import { sendQueueBatch } from '#services/dispatcher-queue';



export interface DispatchTrigger {
    campaignId: string;
    dispatchMode: DispatchMode;
}

export interface SendQueueEntry {
    Id: string;
    MessageBody: string;
    MessageAttributes: {
        idempotencyKey: {
            DataType: 'String';
            StringValue: string;
        };
    };
}

export interface SendQueueBatchResult {
    Successful: Array<{ Id?: string }>;
    Failed: Array<{ Id?: string; Code?: string; Message?: string }>;
}

export interface DispatcherDependencies {
    withCampaignDispatchLock<T>(
        campaignId: string,
        operation: (session: DatabaseSession) => Promise<T>,
    ): Promise<T>;
    claimCampaignForDispatch(
        campaignId: string,
        mode: DispatchMode,
        session: DatabaseSession,
    ): Promise<DispatchCampaignRow | null>;
    resolveDispatchAudience(
        segmentId: string,
        cooldownHours: number,
        session: DatabaseSession,
    ): Promise<DispatchAudience>;
    seedPendingDispatchLogs(
        campaignId: string,
        recipients: DispatchRecipientRow[],
        session: DatabaseSession,
    ): Promise<void>;
    listPendingDispatchJobs(campaignId: string, session: DatabaseSession): Promise<DispatchJobRow[]>;
    markDispatchLogsQueued(emailLogIds: string[], session: DatabaseSession): Promise<void>;
    completeCampaignDispatch(campaignId: string, session: DatabaseSession): Promise<void>;
    failCampaignDispatch(campaignId: string, session: DatabaseSession): Promise<void>;
    sendQueueBatch(entries: SendQueueEntry[]): Promise<SendQueueBatchResult>;
}

const _defaultDependencies: DispatcherDependencies = {
    withCampaignDispatchLock,
    claimCampaignForDispatch,
    resolveDispatchAudience,
    seedPendingDispatchLogs,
    listPendingDispatchJobs,
    markDispatchLogsQueued,
    completeCampaignDispatch,
    failCampaignDispatch,
    sendQueueBatch,
};

const _chunk = <T>(items: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};

const _toQueueEntry = (job: DispatchJobRow): SendQueueEntry => ({
    Id: job.email_log_id,
    MessageBody: JSON.stringify({
        campaignId: job.campaign_id,
        emailLogId: job.email_log_id,
        customerId: job.customer_id,
        recipientEmail: job.recipient_email,
        templateId: job.template_id,
        idempotencyKey: job.idempotency_key,
    }),
    MessageAttributes: {
        idempotencyKey: {
            DataType: 'String',
            StringValue: job.idempotency_key,
        },
    },
});

const _sendBatchWithRetries = async (
    entries: SendQueueEntry[],
    dependencies: DispatcherDependencies,
    session: DatabaseSession,
): Promise<void> => {
    let remaining = entries;
    let attempt = 0;
    const maxAttempts = 3;

    while (remaining.length > 0 && attempt < maxAttempts) {
        attempt += 1;
        const result = await dependencies.sendQueueBatch(remaining);
        const entriesById = new Map(remaining.map((entry) => [entry.Id, entry]));
        const successfulIds = new Set<string>();

        for (const success of result.Successful) {
            if (!success.Id || !entriesById.has(success.Id)) {
                throw new Error('SQS SendMessageBatch returned an unknown successful entry');
            }
            successfulIds.add(success.Id);
        }

        const failures = new Map<string, { Code?: string; Message?: string }>();
        for (const failure of result.Failed) {
            if (!failure.Id || !entriesById.has(failure.Id) || successfulIds.has(failure.Id)) {
                throw new Error('SQS SendMessageBatch returned an invalid failed entry');
            }
            failures.set(failure.Id, failure);
        }

        const unresolvedIds = remaining
            .filter((entry) => !successfulIds.has(entry.Id) && !failures.has(entry.Id))
            .map((entry) => entry.Id);
        if (unresolvedIds.length > 0) {
            throw new Error(`SQS SendMessageBatch omitted result entries: ${unresolvedIds.join(', ')}`);
        }

        await dependencies.markDispatchLogsQueued([...successfulIds], session);
        remaining = remaining.filter((entry) => failures.has(entry.Id));

        if (remaining.length > 0 && attempt === maxAttempts) {
            const details = [...failures.entries()]
                .map(([id, failure]) => `${id}: ${failure.Code ?? 'Unknown'} ${failure.Message ?? ''}`.trim())
                .join('; ');
            throw new Error(`SQS failed to accept ${remaining.length} dispatch message(s): ${details}`);
        }
    }
};

/**
 * Dispatches one campaign under a database advisory lock. Logs are
 * seeded before queueing and successful SQS entries are marked queued
 * immediately, so retries resume from pending rows only.
 */
export const dispatchCampaign = async (
    trigger: DispatchTrigger,
    dependencies: DispatcherDependencies = _defaultDependencies,
): Promise<{ campaignId: string; status: 'completed' | 'ignored'; queued: number }> => {
    const cooldownHours = loadEmailCooldownHours();

    return dependencies.withCampaignDispatchLock(trigger.campaignId, async (session) => {
        const campaign = await dependencies.claimCampaignForDispatch(
            trigger.campaignId,
            trigger.dispatchMode,
            session,
        );
        if (!campaign) {
            console.info('Dispatcher ignored ineligible or duplicate trigger', {
                campaignId: trigger.campaignId,
                dispatchMode: trigger.dispatchMode,
            });
            return { campaignId: trigger.campaignId, status: 'ignored', queued: 0 };
        }

        try {
            const audience = await dependencies.resolveDispatchAudience(
                campaign.segment_id,
                cooldownHours,
                session,
            );
            console.info('Dispatcher audience resolved', {
                campaignId: campaign.campaign_id,
                totalSegmentRecipients: audience.segmentRecipientCount,
                suppressedRecipients: audience.suppressedRecipientCount,
                cooldownSkippedRecipients: audience.cooldownSkippedCount,
                eligibleRecipients: audience.recipients.length,
                cooldownHours,
            });

            const recipients = audience.recipients;
            await dependencies.seedPendingDispatchLogs(campaign.campaign_id, recipients, session);

            const jobs = await dependencies.listPendingDispatchJobs(campaign.campaign_id, session);
            for (const batch of _chunk(jobs, 10)) {
                await _sendBatchWithRetries(batch.map(_toQueueEntry), dependencies, session);
            }

            await dependencies.completeCampaignDispatch(campaign.campaign_id, session);
            console.info('Dispatcher campaign completed', {
                campaignId: campaign.campaign_id,
                totalSegmentRecipients: audience.segmentRecipientCount,
                suppressedRecipients: audience.suppressedRecipientCount,
                cooldownSkippedRecipients: audience.cooldownSkippedCount,
                eligibleRecipients: recipients.length,
                enqueuedRecipients: jobs.length,
            });
            return { campaignId: campaign.campaign_id, status: 'completed', queued: jobs.length };
        } catch (error) {
            try {
                await dependencies.failCampaignDispatch(campaign.campaign_id, session);
            } catch (failureError) {
                throw new AggregateError(
                    [error, failureError],
                    `Dispatch failed and campaign ${campaign.campaign_id} could not be marked failed`,
                );
            }
            throw error;
        }
    });
};
