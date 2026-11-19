import type { Row } from '#db/connection';
import { runReadQuery } from '#db/connection';




/** Shape of the `email_logs` columns GET /campaigns/{id}/logs returns. */
export interface EmailLogRow {
    email_log_id: string;
    recipient_email: string;
    send_status: 'pending' | 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed';
    ses_message_id: string | null;
    attempt_count: number;
    updated_at: string;
}

/**
 * Reads every dispatch log row of one campaign, newest first. The
 * (campaign_id, send_status) index makes the filter a single scan of
 * the campaign's rows (db/schema.sql).
 *
 * @param campaignId - Campaign whose email_logs rows to return.
 *
 * @returns The campaign's log rows, possibly empty.
 *
 * @example
 * const rows = await listEmailLogRows('33333333-3333-4000-8000-000000000009')
 * console.log(rows.length) // Output: 2
 */
export const listEmailLogRows = async (campaignId: string): Promise<EmailLogRow[]> => {
    const result = await runReadQuery(
        `SELECT email_log_id, recipient_email, send_status,
                ses_message_id, attempt_count, updated_at
         FROM email_logs
         WHERE campaign_id = $1
         ORDER BY created_at DESC, email_log_id DESC`,
        [campaignId],
    );

    return result.rows as unknown as EmailLogRow[];
};

/**
 * Maps a log row onto the camelCase shape of
 * docs/api-contract.md §2.1 (GET /campaigns/{id}/logs).
 *
 * @param row - Row read from email_logs.
 *
 * @returns One entry of the response's `logs` array.
 *
 * @example
 * const log = mapEmailLogRowToResponse(row)
 * console.log(log.sendStatus) // Output: 'delivered'
 */
export const mapEmailLogRowToResponse = (row: EmailLogRow) => ({
    emailLogId: row.email_log_id,
    recipientEmail: row.recipient_email,
    sendStatus: row.send_status,
    sesMessageId: row.ses_message_id,
    attemptCount: row.attempt_count,
    updatedAt: row.updated_at,
});

export type { Row };
