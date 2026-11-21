import type { CampaignStatsRow } from '#repositories/stats.repository';

import {
    countCampaignsGroupedByStatus,
    findCampaignStatsRowById,
    getOverallCountsRow,
    listCampaignStatusAuditRows,
    listRecentCampaignStatsRows,
} from '#repositories/stats.repository';

import {
    buildStatusHistory,
    classifyRate,
    computeAlerts,
    computeRates,
    getCampaignStats,
    getStatsOverview,
    mapCountsRow,
    STATS_THRESHOLDS,
} from '#services/stats.service';

import { NotFoundError } from '#utils/errors';




jest.mock('#repositories/stats.repository', () => ({
    getOverallCountsRow: jest.fn(),
    countCampaignsGroupedByStatus: jest.fn(),
    listRecentCampaignStatsRows: jest.fn(),
    findCampaignStatsRowById: jest.fn(),
    listCampaignStatusAuditRows: jest.fn(),
}));

const getOverallCountsRowMock = getOverallCountsRow as jest.Mock;
const countCampaignsGroupedByStatusMock = countCampaignsGroupedByStatus as jest.Mock;
const listRecentCampaignStatsRowsMock = listRecentCampaignStatsRows as jest.Mock;
const findCampaignStatsRowByIdMock = findCampaignStatsRowById as jest.Mock;
const listCampaignStatusAuditRowsMock = listCampaignStatusAuditRows as jest.Mock;

const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';

const campaignRow = (overrides: Partial<CampaignStatsRow> = {}): CampaignStatsRow => ({
    campaign_id: CAMPAIGN_ID,
    name: 'October Monthly Newsletter',
    status: 'completed',
    scheduled_at: '2026-10-30T10:00:00.000Z',
    created_at: '2026-10-25T08:00:00.000Z',
    updated_at: '2026-10-30T10:12:00.000Z',
    sent_count: '1000',
    delivered_count: '960',
    bounced_count: '30',
    complained_count: '1',
    failed_count: '5',
    pending_count: '0',
    ...overrides,
});

beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-21T09:00:00.000Z'));

    getOverallCountsRowMock.mockReset();
    getOverallCountsRowMock.mockResolvedValue({
        sent_count: 48210, delivered_count: 46890, bounced_count: 1020,
        complained_count: 18, failed_count: 300, pending_count: 0,
    });
    countCampaignsGroupedByStatusMock.mockReset();
    countCampaignsGroupedByStatusMock.mockResolvedValue([
        { status: 'completed', count: 80 },
        { status: 'draft', count: '3' },
    ]);
    listRecentCampaignStatsRowsMock.mockReset();
    listRecentCampaignStatsRowsMock.mockResolvedValue([campaignRow()]);
    findCampaignStatsRowByIdMock.mockReset();
    findCampaignStatsRowByIdMock.mockResolvedValue(campaignRow());
    listCampaignStatusAuditRowsMock.mockReset();
    listCampaignStatusAuditRowsMock.mockResolvedValue([]);
});

afterEach(() => {
    jest.useRealTimers();
});

describe('mapCountsRow', () => {
    test('converts bigint strings and numbers into numbers', () => {
        expect(mapCountsRow({
            sent_count: '10', delivered_count: 9, bounced_count: '1',
            complained_count: 0, failed_count: '2', pending_count: 3,
        })).toEqual({ sent: 10, delivered: 9, bounced: 1, complained: 0, failed: 2, pending: 3 });
    });
});

describe('computeRates', () => {
    test('divides by sent and rounds to four decimals', () => {
        expect(computeRates({ sent: 3000, delivered: 2900, bounced: 64, complained: 1, failed: 0, pending: 0 }))
            .toEqual({ delivery: 0.9667, bounce: 0.0213, complaint: 0.0003 });
    });

    test('returns null rates when nothing was sent (no data is not perfect)', () => {
        expect(computeRates({ sent: 0, delivered: 0, bounced: 0, complained: 0, failed: 4, pending: 2 }))
            .toEqual({ delivery: null, bounce: null, complaint: null });
    });
});

describe('classifyRate', () => {
    const bounce = STATS_THRESHOLDS.bounce;

    test.each([
        [null, 'ok'],
        [0, 'ok'],
        [0.0199, 'ok'],
        [0.02, 'warning'],
        [0.0499, 'warning'],
        [0.05, 'critical'],
        [0.4, 'critical'],
    ])('bounce rate %p is %s', (rate, expected) => {
        expect(classifyRate(rate as number | null, bounce)).toBe(expected);
    });

    test('complaint thresholds are far lower than bounce thresholds', () => {
        expect(classifyRate(0.0005, STATS_THRESHOLDS.complaint)).toBe('warning');
        expect(classifyRate(0.001, STATS_THRESHOLDS.complaint)).toBe('critical');
    });
});

describe('computeAlerts', () => {
    test('classifies bounce and complaint independently', () => {
        expect(computeAlerts({ delivery: 0.9, bounce: 0.06, complaint: 0.0001 }))
            .toEqual({ bounce: 'critical', complaint: 'ok' });
    });
});

describe('buildStatusHistory', () => {
    test('keeps audit entries and adds the system-reached current status', () => {
        const history = buildStatusHistory(
            [
                { user_id: 'usr-1', action: 'create', status: 'draft', created_at: '2026-10-25T08:00:00.000Z' },
                { user_id: 'usr-1', action: 'send', status: 'sending', created_at: new Date('2026-10-30T10:00:00.000Z') },
            ],
            'completed',
            '2026-10-30T10:12:00.000Z',
        );

        expect(history).toEqual([
            { status: 'draft', changedAt: '2026-10-25T08:00:00.000Z', changedBy: 'usr-1' },
            { status: 'sending', changedAt: '2026-10-30T10:00:00.000Z', changedBy: 'usr-1' },
            { status: 'completed', changedAt: '2026-10-30T10:12:00.000Z', changedBy: null },
        ]);
    });

    test('adds nothing when the last audit entry is already the current status', () => {
        const history = buildStatusHistory(
            [{ user_id: 'usr-1', action: 'schedule', status: 'scheduled', created_at: '2026-10-25T14:30:00.000Z' }],
            'scheduled',
            '2026-10-25T14:30:00.000Z',
        );

        expect(history).toHaveLength(1);
        expect(history[0]?.changedBy).toBe('usr-1');
    });

    test('ignores audit rows without a status and falls back to the current status', () => {
        const history = buildStatusHistory(
            [{ user_id: 'usr-1', action: 'create', status: null, created_at: '2026-10-25T08:00:00.000Z' }],
            'draft',
            new Date('2026-10-25T08:00:00.000Z'),
        );

        expect(history).toEqual([
            { status: 'draft', changedAt: '2026-10-25T08:00:00.000Z', changedBy: null },
        ]);
    });
});

describe('getStatsOverview', () => {
    test('assembles totals, rates, alerts, status breakdown and recent campaigns', async () => {
        const overview = await getStatsOverview(10);

        expect(listRecentCampaignStatsRowsMock).toHaveBeenCalledWith(10);
        expect(overview.generatedAt).toBe('2026-11-21T09:00:00.000Z');
        expect(overview.totals).toEqual({
            campaigns: 83,
            sent: 48210, delivered: 46890, bounced: 1020, complained: 18, failed: 300, pending: 0,
        });
        expect(overview.rates).toEqual({ delivery: 0.9726, bounce: 0.0212, complaint: 0.0004 });
        expect(overview.alerts).toEqual({ bounce: 'warning', complaint: 'ok' });
        expect(overview.campaignsByStatus).toEqual({
            draft: 3, scheduled: 0, sending: 0, completed: 80, failed: 0, cancelled: 0,
        });
        expect(overview.thresholds).toEqual(STATS_THRESHOLDS);
        expect(overview.recentCampaigns).toEqual([
            {
                campaignId: CAMPAIGN_ID,
                name: 'October Monthly Newsletter',
                status: 'completed',
                scheduledAt: '2026-10-30T10:00:00.000Z',
                counts: { sent: 1000, delivered: 960, bounced: 30, complained: 1, failed: 5, pending: 0 },
                rates: { delivery: 0.96, bounce: 0.03, complaint: 0.001 },
                alerts: { bounce: 'warning', complaint: 'critical' },
            },
        ]);
    });

    test('a campaign that was never scheduled keeps scheduledAt null', async () => {
        listRecentCampaignStatsRowsMock.mockResolvedValue([
            campaignRow({ status: 'draft', scheduled_at: null, sent_count: 0, delivered_count: 0, bounced_count: 0, complained_count: 0 }),
        ]);

        const overview = await getStatsOverview(5);

        expect(overview.recentCampaigns[0]?.scheduledAt).toBeNull();
        expect(overview.recentCampaigns[0]?.rates).toEqual({ delivery: null, bounce: null, complaint: null });
        expect(overview.recentCampaigns[0]?.alerts).toEqual({ bounce: 'ok', complaint: 'ok' });
    });
});

describe('getCampaignStats', () => {
    test('returns counters, rates, alerts, thresholds and the status history', async () => {
        listCampaignStatusAuditRowsMock.mockResolvedValue([
            { user_id: 'usr-1', action: 'create', status: 'draft', created_at: '2026-10-25T08:00:00.000Z' },
        ]);

        const stats = await getCampaignStats(CAMPAIGN_ID);

        expect(findCampaignStatsRowByIdMock).toHaveBeenCalledWith(CAMPAIGN_ID);
        expect(listCampaignStatusAuditRowsMock).toHaveBeenCalledWith(CAMPAIGN_ID);
        expect(stats).toMatchObject({
            campaignId: CAMPAIGN_ID,
            name: 'October Monthly Newsletter',
            status: 'completed',
            generatedAt: '2026-11-21T09:00:00.000Z',
            counts: { sent: 1000, delivered: 960, bounced: 30, complained: 1, failed: 5, pending: 0 },
            rates: { delivery: 0.96, bounce: 0.03, complaint: 0.001 },
            alerts: { bounce: 'warning', complaint: 'critical' },
            thresholds: STATS_THRESHOLDS,
        });
        expect(stats.statusHistory).toEqual([
            { status: 'draft', changedAt: '2026-10-25T08:00:00.000Z', changedBy: 'usr-1' },
            { status: 'completed', changedAt: '2026-10-30T10:12:00.000Z', changedBy: null },
        ]);
    });

    test('throws NotFoundError and skips the audit query for an unknown campaign', async () => {
        findCampaignStatsRowByIdMock.mockResolvedValue(null);

        await expect(getCampaignStats(CAMPAIGN_ID)).rejects.toBeInstanceOf(NotFoundError);
        expect(listCampaignStatusAuditRowsMock).not.toHaveBeenCalled();
    });
});
