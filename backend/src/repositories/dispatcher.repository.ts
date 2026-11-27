import { createHash } from 'node:crypto';

import type { DatabaseSession, Queryable } from '#db/connection';

import type { CampaignStatus } from '#repositories/campaign.repository';

import { runInTransaction, withDatabaseAdvisoryLock } from '#db/connection';



export type DispatchMode = 'scheduled' | 'immediate';

export interface DispatchCampaignRow {
    campaign_id: string;
    segment_id: string;
    template_id: string;
    status: CampaignStatus;
    dispatch_mode: DispatchMode;
}

export interface DispatchRecipientRow {
    customer_id: string;
    email: string;
}

export interface DispatchAudience {
    recipients: DispatchRecipientRow[];
    segmentRecipientCount: number;
    suppressedRecipientCount: number;
    cooldownSkippedCount: number;
}

export interface DispatchJobRow {
    email_log_id: string;
    campaign_id: string;
    customer_id: string;
    recipient_email: string;
    template_id: string;
    idempotency_key: string;
}

export const withCampaignDispatchLock = <T>(
    campaignId: string,
    operation: (session: DatabaseSession) => Promise<T>,
): Promise<T> => withDatabaseAdvisoryLock(`dispatcher:${campaignId}`, operation);

/**
 * Locks the campaign and performs the scheduled -> sending transition.
 * An already-sending campaign is returned for idempotent retry; all
 * other states and trigger-mode mismatches are ignored.
 */
export const claimCampaignForDispatch = async (
    campaignId: string,
    dispatchMode: DispatchMode,
    session: DatabaseSession,
): Promise<DispatchCampaignRow | null> => session.transaction(async (tx) => {
    const result = await tx.query(
        `SELECT campaign_id, segment_id, template_id, status, dispatch_mode
         FROM campaigns
         WHERE campaign_id = $1
         FOR UPDATE`,
        [campaignId],
    );
    const row = result.rows[0] as unknown as DispatchCampaignRow | undefined;

    if (!row || row.dispatch_mode !== dispatchMode) {
        return null;
    }

    if (row.status === 'scheduled' && dispatchMode === 'scheduled') {
        const transition = await tx.query(
            `UPDATE campaigns
             SET status = 'sending'
             WHERE campaign_id = $1 AND status = 'scheduled'
             RETURNING campaign_id`,
            [campaignId],
        );
        if (!transition.rows[0]) {
            throw new Error(`Campaign ${campaignId} could not transition from scheduled to sending`);
        }
        return { ...row, status: 'sending' };
    }

    if (row.status === 'sending') {
        return row;
    }

    return null;
});

/**
 * Resolves segment membership and filters every active suppression
 * before any email job is seeded. The current schema uses membership in
 * email_suppressions as the opt-out state; customers has no is_subscribed
 * column (db/schema.sql).
 */
export const resolveDispatchAudience = async (
    segmentId: string,
    cooldownHours: number,
    session: DatabaseSession,
): Promise<DispatchAudience> => {
    const result = await session.query(
        `WITH segment_audience AS (
             SELECT c.customer_id,
                    c.email,
                    EXISTS (
                        SELECT 1
                        FROM email_suppressions s
                        WHERE s.email_normalized = lower(trim(c.email))
                    ) AS is_suppressed,
                    EXISTS (
                        SELECT 1
                        FROM email_logs l
                        WHERE l.customer_id = c.customer_id
                          AND l.send_status IN ('queued', 'sent', 'delivered')
                          AND l.updated_at >= NOW() - make_interval(hours => $2)
                    ) AS recently_contacted
             FROM customer_segments cs
             JOIN customers c ON c.customer_id = cs.customer_id
             WHERE cs.segment_id = $1
         ),
         audience_counts AS (
             SELECT COUNT(*)::int AS segment_recipient_count,
                    COUNT(*) FILTER (WHERE is_suppressed)::int AS suppressed_recipient_count,
                    COUNT(*) FILTER (
                        WHERE NOT is_suppressed AND recently_contacted
                    )::int AS cooldown_skipped_count
             FROM segment_audience
         )
         SELECT counts.segment_recipient_count,
                counts.suppressed_recipient_count,
                counts.cooldown_skipped_count,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object('customer_id', a.customer_id, 'email', a.email)
                            ORDER BY a.customer_id
                        )
                        FROM segment_audience a
                        WHERE NOT a.is_suppressed
                          AND ($2 = 0 OR NOT a.recently_contacted)
                    ),
                    '[]'::json
                ) AS recipients
         FROM audience_counts counts`,
        [segmentId, cooldownHours],
    );

    const row = result.rows[0] as unknown as {
        recipients: DispatchRecipientRow[];
        segment_recipient_count: number;
        suppressed_recipient_count: number;
        cooldown_skipped_count: number;
    } | undefined;

    if (!row) {
        throw new Error('Dispatcher audience query returned no summary row');
    }

    return {
        recipients: row.recipients,
        segmentRecipientCount: row.segment_recipient_count,
        suppressedRecipientCount: row.suppressed_recipient_count,
        cooldownSkippedCount: row.cooldown_skipped_count,
    };
};

/** Seeds one deterministic email log per customer, ignoring prior attempts. */
export const seedPendingDispatchLogs = async (
    campaignId: string,
    recipients: DispatchRecipientRow[],
    session: DatabaseSession,
): Promise<void> => {
    if (recipients.length === 0) {
        return;
    }

    const values: unknown[] = [];
    const tuples = recipients.map((recipient, index) => {
        const offset = index * 4;
        const idempotencyKey = createHash('sha256')
            .update(`${campaignId}${recipient.customer_id}`)
            .digest('hex');
        values.push(campaignId, recipient.customer_id, recipient.email, idempotencyKey);
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, 'pending')`;
    });

    await session.transaction(async (tx) => {
        await tx.query(
            `INSERT INTO email_logs (
                campaign_id, customer_id, recipient_email, idempotency_key, send_status
             )
             VALUES ${tuples.join(', ')}
             ON CONFLICT (idempotency_key) DO NOTHING`,
            values,
        );
    });
};

/**
 * Reads only still-pending jobs. The suppression check is repeated here
 * to avoid enqueueing a recipient who opted out after audience resolution.
 */
export const listPendingDispatchJobs = async (
    campaignId: string,
    session: DatabaseSession,
): Promise<DispatchJobRow[]> => {
    const result = await session.query(
        `SELECT l.email_log_id, l.campaign_id, l.customer_id,
                l.recipient_email, c.template_id, l.idempotency_key
         FROM email_logs l
         JOIN campaigns c ON c.campaign_id = l.campaign_id
         JOIN customers cu ON cu.customer_id = l.customer_id
         WHERE l.campaign_id = $1
           AND l.send_status = 'pending'
           AND NOT EXISTS (
               SELECT 1
               FROM email_suppressions s
               WHERE s.email_normalized = lower(trim(l.recipient_email))
           )
         ORDER BY l.email_log_id`,
        [campaignId],
    );

    return result.rows as unknown as DispatchJobRow[];
};

/** Records SQS acceptance without overwriting a fast Worker transition. */
export const markDispatchLogsQueued = async (
    emailLogIds: string[],
    session: DatabaseSession,
): Promise<void> => {
    if (emailLogIds.length === 0) {
        return;
    }

    await session.transaction(async (tx) => {
        await tx.query(
            `UPDATE email_logs
             SET send_status = 'queued'
             WHERE email_log_id = ANY($1::uuid[])
               AND send_status = 'pending'`,
            [emailLogIds],
        );
    });
};

export const completeCampaignDispatch = async (
    campaignId: string,
    session: DatabaseSession,
): Promise<void> => {
    await session.transaction(async (tx) => {
        const result = await tx.query(
            `UPDATE campaigns
             SET status = 'completed'
             WHERE campaign_id = $1 AND status = 'sending'
             RETURNING campaign_id`,
            [campaignId],
        );
        if (!result.rows[0]) {
            throw new Error(`Campaign ${campaignId} could not transition from sending to completed`);
        }
    });
};

export const failCampaignDispatch = async (
    campaignId: string,
    session?: DatabaseSession,
): Promise<void> => {
    const transaction = session
        ? session.transaction.bind(session)
        : runInTransaction;
    await transaction(async (tx) => {
        await tx.query(
            `UPDATE campaigns
             SET status = 'failed'
             WHERE campaign_id = $1 AND status IN ('scheduled', 'sending')`,
            [campaignId],
        );
    });
};
