import { runReadQuery } from '#db/connection';




/**
 * Per-status email counters, computed once in SQL so the service never
 * re-implements what "sent" means (docs/api-contract.md §2.6.1,
 * docs/email-state-machine.md §2.1):
 *  - sent       = SES accepted the message: sent, delivered, bounced, complained
 *  - pending    = created but not yet accepted by SES: pending, queued
 * `::int` keeps the counters JavaScript numbers instead of bigint strings.
 */
const EMAIL_COUNT_COLUMNS = `
        COUNT(*) FILTER (WHERE l.send_status IN ('sent', 'delivered', 'bounced', 'complained'))::int AS sent_count,
        COUNT(*) FILTER (WHERE l.send_status = 'delivered')::int AS delivered_count,
        COUNT(*) FILTER (WHERE l.send_status = 'bounced')::int AS bounced_count,
        COUNT(*) FILTER (WHERE l.send_status = 'complained')::int AS complained_count,
        COUNT(*) FILTER (WHERE l.send_status = 'failed')::int AS failed_count,
        COUNT(*) FILTER (WHERE l.send_status IN ('pending', 'queued'))::int AS pending_count`;

export interface EmailCountsRow {
    sent_count: number | string;
    delivered_count: number | string;
    bounced_count: number | string;
    complained_count: number | string;
    failed_count: number | string;
    pending_count: number | string;
}

export interface CampaignStatusCountRow {
    status: string;
    count: number | string;
}

export interface CampaignStatsRow extends EmailCountsRow {
    campaign_id: string;
    name: string;
    status: string;
    scheduled_at: Date | string | null;
    created_at: Date | string;
    updated_at: Date | string;
}

export interface CampaignStatusAuditRow {
    user_id: string;
    action: string;
    status: string | null;
    created_at: Date | string;
}

const ZERO_COUNTS_ROW: EmailCountsRow = {
    sent_count: 0,
    delivered_count: 0,
    bounced_count: 0,
    complained_count: 0,
    failed_count: 0,
    pending_count: 0,
};

/**
 * Email counters across every campaign. An aggregate without GROUP BY
 * always yields one row; the zero row only guards a driver defect.
 *
 * @returns The overall counters.
 *
 * @example
 * const counts = await getOverallCountsRow()
 * console.log(counts.sent_count) // Output: 48210
 */
export const getOverallCountsRow = async (): Promise<EmailCountsRow> => {
    const result = await runReadQuery(
        `SELECT ${EMAIL_COUNT_COLUMNS}
           FROM email_logs l`,
    );

    return (result.rows[0] as unknown as EmailCountsRow | undefined) ?? ZERO_COUNTS_ROW;
};

/**
 * How many campaigns sit in each status. Statuses with no campaign are
 * simply absent; the service fills the gaps with 0.
 *
 * @returns One row per status that has at least one campaign.
 *
 * @example
 * const rows = await countCampaignsGroupedByStatus()
 * console.log(rows[0]) // Output: { status: 'completed', count: 80 }
 */
export const countCampaignsGroupedByStatus = async (): Promise<CampaignStatusCountRow[]> => {
    const result = await runReadQuery(
        `SELECT status, COUNT(*)::int AS count
           FROM campaigns
          GROUP BY status`,
    );

    return result.rows as unknown as CampaignStatusCountRow[];
};

/**
 * The newest campaigns with their own email counters. The LIMIT is
 * applied to campaigns before the join, so campaigns without any email
 * log still appear with all-zero counters.
 *
 * @param limit - Number of campaigns to return, newest first.
 *
 * @returns Campaign rows with counters.
 *
 * @example
 * const rows = await listRecentCampaignStatsRows(10)
 * console.log(rows.length) // Output: 10
 */
export const listRecentCampaignStatsRows = async (limit: number): Promise<CampaignStatsRow[]> => {
    const result = await runReadQuery(
        `SELECT c.campaign_id, c.name, c.status, c.scheduled_at, c.created_at, c.updated_at,
                ${EMAIL_COUNT_COLUMNS}
           FROM (SELECT campaign_id, name, status, scheduled_at, created_at, updated_at
                   FROM campaigns
                  ORDER BY created_at DESC
                  LIMIT $1) c
           LEFT JOIN email_logs l ON l.campaign_id = c.campaign_id
          GROUP BY c.campaign_id, c.name, c.status, c.scheduled_at, c.created_at, c.updated_at
          ORDER BY c.created_at DESC`,
        [limit],
    );

    return result.rows as unknown as CampaignStatsRow[];
};

/**
 * One campaign with its email counters.
 *
 * @param campaignId - Campaign UUID.
 *
 * @returns The campaign row with counters, or null when it does not exist.
 *
 * @example
 * const row = await findCampaignStatsRowById('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d')
 * console.log(row?.status) // Output: 'completed'
 */
export const findCampaignStatsRowById = async (campaignId: string): Promise<CampaignStatsRow | null> => {
    const result = await runReadQuery(
        `SELECT c.campaign_id, c.name, c.status, c.scheduled_at, c.created_at, c.updated_at,
                ${EMAIL_COUNT_COLUMNS}
           FROM campaigns c
           LEFT JOIN email_logs l ON l.campaign_id = c.campaign_id
          WHERE c.campaign_id = $1
          GROUP BY c.campaign_id, c.name, c.status, c.scheduled_at, c.created_at, c.updated_at`,
        [campaignId],
    );

    return (result.rows[0] as unknown as CampaignStatsRow | undefined) ?? null;
};

/**
 * Status-changing human actions on one campaign, oldest first. Only
 * actions that set a status are read; `update` rows are excluded
 * because editing a draft never changes its status. Worker and
 * dispatcher transitions are not in audit_logs (db/schema.sql), so the
 * service adds the current system-reached status separately.
 *
 * @param campaignId - Campaign UUID.
 *
 * @returns Audit rows with the status each action produced.
 *
 * @example
 * const rows = await listCampaignStatusAuditRows('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d')
 * console.log(rows[0].status) // Output: 'draft'
 */
export const listCampaignStatusAuditRows = async (campaignId: string): Promise<CampaignStatusAuditRow[]> => {
    const result = await runReadQuery(
        `SELECT user_id, action, changes->'after'->>'status' AS status, created_at
           FROM audit_logs
          WHERE entity_type = 'campaign'
            AND entity_id = $1
            AND action IN ('create', 'schedule', 'send', 'cancel')
          ORDER BY created_at ASC, audit_log_id ASC`,
        [campaignId],
    );

    return result.rows as unknown as CampaignStatusAuditRow[];
};
