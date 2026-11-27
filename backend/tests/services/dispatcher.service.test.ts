import type {
    DispatchCampaignRow,
    DispatchJobRow,
    DispatchRecipientRow,
} from '#repositories/dispatcher.repository';
import type {
    DispatcherDependencies,
    SendQueueEntry,
    SendQueueBatchResult,
} from '#services/dispatcher.service';
import type { DatabaseSession } from '#db/connection';

import { dispatchCampaign } from '#services/dispatcher.service';



const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';
const CUSTOMER_ID = '11111111-1111-4000-8000-000000000001';
const TEMPLATE_ID = '22222222-2222-4000-8000-000000000001';
const EMAIL_LOG_ID = '44444444-4444-4000-8000-000000000001';
const SEGMENT_ID = '55555555-5555-4000-8000-000000000001';
const session: DatabaseSession = {
    query: jest.fn(),
    transaction: jest.fn(async (operation) => operation({ query: jest.fn() })),
};

const campaign: DispatchCampaignRow = {
    campaign_id: CAMPAIGN_ID,
    segment_id: SEGMENT_ID,
    template_id: TEMPLATE_ID,
    status: 'sending',
    dispatch_mode: 'immediate',
};

const recipient: DispatchRecipientRow = {
    customer_id: CUSTOMER_ID,
    email: 'person@example.com',
};

const audience = {
    recipients: [recipient],
    segmentRecipientCount: 1,
    suppressedRecipientCount: 0,
    cooldownSkippedCount: 0,
};

const job = (index: number): DispatchJobRow => ({
    email_log_id: index === 0
        ? EMAIL_LOG_ID
        : `44444444-4444-4000-8000-${(index + 1).toString().padStart(12, '0')}`,
    campaign_id: CAMPAIGN_ID,
    customer_id: CUSTOMER_ID,
    recipient_email: `person${index}@example.com`,
    template_id: TEMPLATE_ID,
    idempotency_key: `key-${index}`,
});

const dependencies = (
    overrides: Partial<DispatcherDependencies> = {},
): DispatcherDependencies => ({
    withCampaignDispatchLock: async (_campaignId, operation) => operation(session),
    claimCampaignForDispatch: jest.fn().mockResolvedValue(campaign),
    resolveDispatchAudience: jest.fn().mockResolvedValue(audience),
    seedPendingDispatchLogs: jest.fn().mockResolvedValue(undefined),
    listPendingDispatchJobs: jest.fn().mockResolvedValue([job(0)]),
    markDispatchLogsQueued: jest.fn().mockResolvedValue(undefined),
    completeCampaignDispatch: jest.fn().mockResolvedValue(undefined),
    failCampaignDispatch: jest.fn().mockResolvedValue(undefined),
    sendQueueBatch: jest.fn().mockImplementation(
        async (entries: SendQueueEntry[]): Promise<SendQueueBatchResult> => ({
            Successful: entries.map(({ Id }) => ({ Id })),
            Failed: [],
        }),
    ),
    ...overrides,
});

describe('dispatchCampaign', () => {
    test.each(['immediate', 'scheduled'] as const)(
        'dispatches a %s trigger and marks its jobs queued',
        async (dispatchMode) => {
            const deps = dependencies();

            const result = await dispatchCampaign(
                { campaignId: CAMPAIGN_ID, dispatchMode },
                deps,
            );

            expect(deps.resolveDispatchAudience).toHaveBeenCalledWith(SEGMENT_ID, 24, session);
            expect(deps.claimCampaignForDispatch).toHaveBeenCalledWith(CAMPAIGN_ID, dispatchMode, session);
            expect(deps.seedPendingDispatchLogs).toHaveBeenCalledWith(CAMPAIGN_ID, [recipient], session);
            expect(deps.sendQueueBatch).toHaveBeenCalledWith([
                expect.objectContaining({
                    Id: EMAIL_LOG_ID,
                    MessageAttributes: {
                        idempotencyKey: { DataType: 'String', StringValue: 'key-0' },
                    },
                }),
            ]);
            expect(deps.markDispatchLogsQueued).toHaveBeenCalledWith([EMAIL_LOG_ID], session);
            expect(deps.completeCampaignDispatch).toHaveBeenCalledWith(CAMPAIGN_ID, session);
            expect(result).toEqual({ campaignId: CAMPAIGN_ID, status: 'completed', queued: 1 });
        },
    );

    test('completes campaigns with no eligible recipients without sending SQS messages', async () => {
        const deps = dependencies({
            resolveDispatchAudience: jest.fn().mockResolvedValue({
                ...audience,
                recipients: [],
                segmentRecipientCount: 1,
                suppressedRecipientCount: 0,
                cooldownSkippedCount: 1,
            }),
            listPendingDispatchJobs: jest.fn().mockResolvedValue([]),
        });

        const result = await dispatchCampaign(
            { campaignId: CAMPAIGN_ID, dispatchMode: 'scheduled' },
            deps,
        );

        expect(deps.sendQueueBatch).not.toHaveBeenCalled();
        expect(deps.completeCampaignDispatch).toHaveBeenCalledWith(CAMPAIGN_ID, session);
        expect(result).toEqual({ campaignId: CAMPAIGN_ID, status: 'completed', queued: 0 });
    });

    test('logs separate audience exclusion and final enqueue counts', async () => {
        const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
        let infoCalls: unknown[][];
        const deps = dependencies({
            resolveDispatchAudience: jest.fn().mockResolvedValue({
                ...audience,
                recipients: [],
                segmentRecipientCount: 4,
                suppressedRecipientCount: 1,
                cooldownSkippedCount: 3,
            }),
            listPendingDispatchJobs: jest.fn().mockResolvedValue([]),
        });

        try {
            await dispatchCampaign({ campaignId: CAMPAIGN_ID, dispatchMode: 'immediate' }, deps);
        } finally {
            infoCalls = info.mock.calls;
            info.mockRestore();
        }

        expect(infoCalls[0]).toEqual(['Dispatcher audience resolved', {
            campaignId: CAMPAIGN_ID,
            totalSegmentRecipients: 4,
            suppressedRecipients: 1,
            cooldownSkippedRecipients: 3,
            eligibleRecipients: 0,
            cooldownHours: 24,
        }]);
        expect(infoCalls[1]).toEqual(['Dispatcher campaign completed', {
            campaignId: CAMPAIGN_ID,
            totalSegmentRecipients: 4,
            suppressedRecipients: 1,
            cooldownSkippedRecipients: 3,
            eligibleRecipients: 0,
            enqueuedRecipients: 0,
        }]);
    });

    test('chunks at ten messages and retries only partial failures', async () => {
        const jobs = Array.from({ length: 12 }, (_, index) => job(index));
        const sendQueueBatch = jest.fn()
            .mockResolvedValueOnce({
                Successful: jobs.slice(0, 10).map(({ email_log_id }) => ({ Id: email_log_id })),
                Failed: [],
            })
            .mockResolvedValueOnce({
                Successful: [{ Id: jobs[10]?.email_log_id }],
                Failed: [{ Id: jobs[11]?.email_log_id, Code: 'Throttled', Message: 'retry' }],
            })
            .mockResolvedValueOnce({
                Successful: [{ Id: jobs[11]?.email_log_id }],
                Failed: [],
            });
        const deps = dependencies({
            listPendingDispatchJobs: jest.fn().mockResolvedValue(jobs),
            sendQueueBatch,
        });

        await dispatchCampaign({ campaignId: CAMPAIGN_ID, dispatchMode: 'immediate' }, deps);

        expect(sendQueueBatch.mock.calls.map(([entries]) => entries.length)).toEqual([10, 2, 1]);
        expect(sendQueueBatch.mock.calls.every(([entries]) => entries.length <= 10)).toBe(true);
        expect(deps.markDispatchLogsQueued).toHaveBeenNthCalledWith(
            1,
            jobs.slice(0, 10).map(({ email_log_id }) => email_log_id),
            session,
        );
        expect(deps.markDispatchLogsQueued).toHaveBeenNthCalledWith(
            2,
            [jobs[10]?.email_log_id],
            session,
        );
        expect(deps.markDispatchLogsQueued).toHaveBeenNthCalledWith(
            3,
            [jobs[11]?.email_log_id],
            session,
        );
    });

    test('rejects a batch response that omits an entry result', async () => {
        const deps = dependencies({
            sendQueueBatch: jest.fn().mockResolvedValue({
                Successful: [],
                Failed: [],
            }),
        });

        await expect(dispatchCampaign(
            { campaignId: CAMPAIGN_ID, dispatchMode: 'immediate' },
            deps,
        )).rejects.toThrow('SQS SendMessageBatch omitted result entries');
        expect(deps.failCampaignDispatch).toHaveBeenCalledWith(CAMPAIGN_ID, session);
    });

    test('ignores a duplicate trigger after the campaign is no longer eligible', async () => {
        const claimCampaignForDispatch = jest.fn()
            .mockResolvedValueOnce(campaign)
            .mockResolvedValueOnce(null);
        const deps = dependencies({ claimCampaignForDispatch });
        const trigger = { campaignId: CAMPAIGN_ID, dispatchMode: 'immediate' as const };

        await dispatchCampaign(trigger, deps);
        const duplicateResult = await dispatchCampaign(trigger, deps);

        expect(deps.sendQueueBatch).toHaveBeenCalledTimes(1);
        expect(duplicateResult).toEqual({ campaignId: CAMPAIGN_ID, status: 'ignored', queued: 0 });
    });

    test('marks a campaign failed and surfaces exhausted SQS entry failures', async () => {
        const jobs = [job(0)];
        const sendQueueBatch = jest.fn().mockResolvedValue({
            Successful: [],
            Failed: [{ Id: EMAIL_LOG_ID, Code: 'Invalid', Message: 'not accepted' }],
        });
        const deps = dependencies({
            listPendingDispatchJobs: jest.fn().mockResolvedValue(jobs),
            sendQueueBatch,
        });

        await expect(
            dispatchCampaign({ campaignId: CAMPAIGN_ID, dispatchMode: 'immediate' }, deps),
        ).rejects.toThrow('SQS failed to accept 1 dispatch message(s)');

        expect(sendQueueBatch).toHaveBeenCalledTimes(3);
        expect(deps.failCampaignDispatch).toHaveBeenCalledWith(CAMPAIGN_ID, session);
        expect(deps.completeCampaignDispatch).not.toHaveBeenCalled();
    });
});
