import type {
    CampaignStatsRow,
    CampaignStatusAuditRow,
    EmailCountsRow,
} from '#repositories/stats.repository';

import {
    countCampaignsGroupedByStatus,
    findCampaignStatsRowById,
    getOverallCountsRow,
    listCampaignStatusAuditRows,
    listRecentCampaignStatsRows,
} from '#repositories/stats.repository';

import { NotFoundError } from '#utils/errors';




export type AlertLevel = 'ok' | 'warning' | 'critical';

export interface EmailCounts {
    sent: number;
    delivered: number;
    bounced: number;
    complained: number;
    failed: number;
    pending: number;
}

export interface EmailRates {
    delivery: number | null;
    bounce: number | null;
    complaint: number | null;
}

export interface RateAlerts {
    bounce: AlertLevel;
    complaint: AlertLevel;
}

export interface StatusHistoryEntry {
    status: string;
    changedAt: string;
    changedBy: string | null;
}

/**
 * Alert thresholds returned with every response so the frontend never
 * hard-codes them (docs/api-contract.md §2.6.1). `critical` matches the
 * levels at which SES starts reviewing an account: 5 % bounce and
 * 0.1 % complaint.
 */
export const STATS_THRESHOLDS = {
    bounce: { warning: 0.02, critical: 0.05 },
    complaint: { warning: 0.0005, critical: 0.001 },
} as const;

/** Every campaign status, so the overview reports 0 instead of omitting one. */
const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled'] as const;

const toIso = (value: Date | string): string => new Date(value).toISOString();

/**
 * Rounds a ratio to four decimals (0.02134 -> 0.0213).
 *
 * @param value - A ratio between 0 and 1.
 *
 * @returns The rounded ratio.
 */
const roundRate = (value: number): number => Math.round(value * 10_000) / 10_000;

/**
 * Converts the SQL counter row (numbers or bigint strings) into numbers.
 *
 * @param row - Counter columns as returned by the repository.
 *
 * @returns Counters named as in the contract.
 *
 * @example
 * mapCountsRow({ sent_count: '10', delivered_count: 9, bounced_count: 1,
 *     complained_count: 0, failed_count: 0, pending_count: 0 }).sent // Output: 10
 */
export const mapCountsRow = (row: EmailCountsRow): EmailCounts => ({
    sent: Number(row.sent_count),
    delivered: Number(row.delivered_count),
    bounced: Number(row.bounced_count),
    complained: Number(row.complained_count),
    failed: Number(row.failed_count),
    pending: Number(row.pending_count),
});

/**
 * Derives the three rates from the counters. The denominator is `sent`
 * (emails SES accepted); with nothing sent yet the rates are null so
 * "no data" never looks like "perfect".
 *
 * @param counts - Counters for one campaign or for all campaigns.
 *
 * @returns Rates rounded to four decimals, or null when `sent` is 0.
 *
 * @example
 * computeRates({ sent: 100, delivered: 97, bounced: 2, complained: 1, failed: 0, pending: 0 })
 * // Output: { delivery: 0.97, bounce: 0.02, complaint: 0.01 }
 */
export const computeRates = (counts: EmailCounts): EmailRates => {
    if (counts.sent === 0) {
        return { delivery: null, bounce: null, complaint: null };
    }

    return {
        delivery: roundRate(counts.delivered / counts.sent),
        bounce: roundRate(counts.bounced / counts.sent),
        complaint: roundRate(counts.complained / counts.sent),
    };
};

/**
 * Compares a rate with its thresholds.
 *
 * @param rate - Rounded rate, or null when there is no data yet.
 * @param threshold - Warning and critical levels for this rate.
 *
 * @returns `ok` for null or below warning, otherwise `warning` or `critical`.
 *
 * @example
 * classifyRate(0.03, { warning: 0.02, critical: 0.05 }) // Output: 'warning'
 */
export const classifyRate = (
    rate: number | null,
    threshold: { readonly warning: number; readonly critical: number },
): AlertLevel => {
    if (rate === null) {
        return 'ok';
    }
    if (rate >= threshold.critical) {
        return 'critical';
    }
    if (rate >= threshold.warning) {
        return 'warning';
    }
    return 'ok';
};

/**
 * Alert level of the bounce and complaint rates.
 *
 * @param rates - Rates from computeRates.
 *
 * @returns One alert level per rate.
 */
export const computeAlerts = (rates: EmailRates): RateAlerts => ({
    bounce: classifyRate(rates.bounce, STATS_THRESHOLDS.bounce),
    complaint: classifyRate(rates.complaint, STATS_THRESHOLDS.complaint),
});

/**
 * Builds the status history of a campaign. audit_logs only records human
 * actions, so the history is those status changes plus, when the current
 * status was reached by the system (dispatcher), one final entry without
 * a user stamped with the campaign's last update. Intermediate system
 * transitions are not stored anywhere and therefore not shown.
 *
 * @param auditRows - Status-changing audit rows, oldest first.
 * @param currentStatus - The campaign's current status.
 * @param updatedAt - The campaign's updated_at.
 *
 * @returns History entries, oldest first.
 *
 * @example
 * buildStatusHistory([], 'draft', '2026-10-25T08:00:00.000Z')
 * // Output: [{ status: 'draft', changedAt: '2026-10-25T08:00:00.000Z', changedBy: null }]
 */
export const buildStatusHistory = (
    auditRows: CampaignStatusAuditRow[],
    currentStatus: string,
    updatedAt: Date | string,
): StatusHistoryEntry[] => {
    const entries: StatusHistoryEntry[] = [];

    for (const row of auditRows) {
        if (typeof row.status === 'string') {
            entries.push({
                status: row.status,
                changedAt: toIso(row.created_at),
                changedBy: row.user_id,
            });
        }
    }

    const last = entries[entries.length - 1];
    if (!last || last.status !== currentStatus) {
        entries.push({ status: currentStatus, changedAt: toIso(updatedAt), changedBy: null });
    }

    return entries;
};

/**
 * Counters, rates and alert levels of one campaign row.
 *
 * @param row - Campaign row with counters.
 *
 * @returns The campaign summary used by both endpoints.
 */
const summariseCampaign = (row: CampaignStatsRow) => {
    const counts = mapCountsRow(row);
    const rates = computeRates(counts);

    return {
        campaignId: row.campaign_id,
        name: row.name,
        status: row.status,
        scheduledAt: row.scheduled_at === null ? null : toIso(row.scheduled_at),
        counts,
        rates,
        alerts: computeAlerts(rates),
    };
};

/**
 * GET /v1/stats/overview — totals, rates, status breakdown and the
 * newest campaigns with their own rates (docs/api-contract.md §2.6).
 *
 * @param limit - Number of recent campaigns to include.
 *
 * @returns The overview body.
 *
 * @example
 * const overview = await getStatsOverview(10)
 * console.log(overview.alerts.bounce) // Output: 'warning'
 */
export const getStatsOverview = async (limit: number) => {
    const [totalsRow, statusRows, campaignRows] = await Promise.all([
        getOverallCountsRow(),
        countCampaignsGroupedByStatus(),
        listRecentCampaignStatsRows(limit),
    ]);

    const campaignsByStatus: Record<string, number> = {};
    for (const status of CAMPAIGN_STATUSES) {
        campaignsByStatus[status] = 0;
    }
    for (const row of statusRows) {
        campaignsByStatus[row.status] = Number(row.count);
    }

    const counts = mapCountsRow(totalsRow);
    const rates = computeRates(counts);

    return {
        generatedAt: new Date().toISOString(),
        totals: {
            campaigns: Object.values(campaignsByStatus).reduce((sum, value) => sum + value, 0),
            ...counts,
        },
        rates,
        alerts: computeAlerts(rates),
        campaignsByStatus,
        thresholds: STATS_THRESHOLDS,
        recentCampaigns: campaignRows.map(summariseCampaign),
    };
};

/**
 * GET /v1/campaigns/{id}/stats — counters, rates, alert levels and
 * status history of one campaign (docs/api-contract.md §2.6).
 *
 * @param campaignId - Campaign UUID.
 *
 * @returns The campaign statistics body.
 *
 * @throws NotFoundError When the campaign does not exist.
 *
 * @example
 * const stats = await getCampaignStats('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d')
 * console.log(stats.statusHistory.length) // Output: 3
 */
export const getCampaignStats = async (campaignId: string) => {
    const row = await findCampaignStatsRowById(campaignId);
    if (!row) {
        throw new NotFoundError('campaign', campaignId);
    }

    const auditRows = await listCampaignStatusAuditRows(campaignId);
    const summary = summariseCampaign(row);

    return {
        campaignId: summary.campaignId,
        name: summary.name,
        status: summary.status,
        generatedAt: new Date().toISOString(),
        counts: summary.counts,
        rates: summary.rates,
        alerts: summary.alerts,
        thresholds: STATS_THRESHOLDS,
        statusHistory: buildStatusHistory(auditRows, row.status, row.updated_at),
    };
};
