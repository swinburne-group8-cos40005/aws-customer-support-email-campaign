import { createHash } from 'node:crypto';

import type { Queryable } from '#db/connection';

import { runInTransaction } from '#db/connection';



export type SesFeedbackStatus = 'delivered' | 'bounced' | 'complained';
export type SesFeedbackType = 'delivery' | 'bounce' | 'complaint';

export interface SesFeedbackEvent {
    sesMessageId: string;
    eventType: SesFeedbackType;
    status: SesFeedbackStatus;
    eventAt: string;
    payload: Record<string, unknown>;
    shouldSuppress: boolean;
    diagnostics: Record<string, unknown> | null;
}

export type SesFeedbackResult = 'updated' | 'duplicate' | 'ignored';

export interface SesFeedbackRepositoryDependencies {
    runInTransaction<T>(operation: (tx: Queryable) => Promise<T>): Promise<T>;
}

const _defaultDependencies: SesFeedbackRepositoryDependencies = {
    runInTransaction,
};

const _deduplicationKey = (event: SesFeedbackEvent): string =>
    createHash('sha256')
        .update([
            event.sesMessageId,
            event.eventType,
            event.eventAt,
            JSON.stringify(event.payload),
        ].join(':'))
        .digest('hex');

const _applySesFeedbackEvent = async (
    tx: Queryable,
    event: SesFeedbackEvent,
): Promise<SesFeedbackResult> => {
    const logResult = await tx.query(
        `SELECT email_log_id, recipient_email, send_status
         FROM email_logs
         WHERE ses_message_id = $1
         FOR UPDATE`,
        [event.sesMessageId],
    );
    const log = logResult.rows[0];
    if (!log) {
        throw new Error(`No email log found for SES message ${event.sesMessageId}`);
    }

    const emailLogId = String(log.email_log_id);
    const recipientEmail = String(log.recipient_email);
    const insertResult = await tx.query(
        `INSERT INTO email_events (
            email_log_id, ses_message_id, event_type, event_at,
            event_details, deduplication_key
         )
         VALUES ($1, $2, $3, $4::timestamptz, $5::jsonb, $6)
         ON CONFLICT (deduplication_key) DO NOTHING
         RETURNING event_id`,
        [
            emailLogId,
            event.sesMessageId,
            event.eventType,
            event.eventAt,
            JSON.stringify(event.payload),
            _deduplicationKey(event),
        ],
    );

    if (event.shouldSuppress) {
        const reason = event.status === 'complained' ? 'complaint' : 'bounce';
        await tx.query(
            `INSERT INTO email_suppressions (email_normalized, reason)
             VALUES ($1, $2)
             ON CONFLICT (email_normalized)
             DO UPDATE SET reason = EXCLUDED.reason`,
            [recipientEmail.trim().toLowerCase(), reason],
        );
    }

    if (!insertResult.rows[0]) {
        return 'duplicate';
    }

    const statusResult = await tx.query(
        `UPDATE email_logs
         SET send_status = $2,
             last_error = CASE WHEN $3::jsonb IS NULL THEN last_error ELSE $3::text END
         WHERE email_log_id = $1
           AND send_status = 'sent'
         RETURNING email_log_id`,
        [
            emailLogId,
            event.status,
            event.diagnostics === null ? null : JSON.stringify(event.diagnostics),
        ],
    );

    return statusResult.rows[0] ? 'updated' : 'ignored';
};

export const applySesFeedbackEvent = async (
    event: SesFeedbackEvent,
    dependencies: SesFeedbackRepositoryDependencies = _defaultDependencies,
): Promise<SesFeedbackResult> => dependencies.runInTransaction(
    (tx) => _applySesFeedbackEvent(tx, event),
);
