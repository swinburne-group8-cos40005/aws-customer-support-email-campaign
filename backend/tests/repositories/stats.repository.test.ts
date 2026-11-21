import { runReadQuery } from '#db/connection';

import type { CampaignStatsRow, EmailCountsRow } from '#repositories/stats.repository';
import {
    countCampaignsGroupedByStatus,
    findCampaignStatsRowById,
    getOverallCountsRow,
    listCampaignStatusAuditRows,
    listRecentCampaignStatsRows,
} from '#repositories/stats.repository';




jest.mock('#db/connection', () => ({
    runReadQuery: jest.fn(),
}));

const runReadQueryMock = runReadQuery as jest.Mock;

const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';

const countsRow = (): EmailCountsRow => ({
    sent_count: 8278,
    delivered_count: 8100,
    bounced_count: 150,
    complained_count: 3,
    failed_count: 25,
    pending_count: 0,
});

const campaignStatsRow = (): CampaignStatsRow => ({
    campaign_id: CAMPAIGN_ID,
    name: 'October Monthly Newsletter',
    status: 'completed',
    scheduled_at: '2026-10-30T10:00:00.000Z',
    created_at: '2026-10-25T08:00:00.000Z',
    updated_at: '2026-10-30T10:12:00.000Z',
    ...countsRow(),
});

beforeEach(() => {
    runReadQueryMock.mockReset();
});

describe('getOverallCountsRow', () => {
    test('aggregates every email log into the six counters', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [countsRow()], rowCount: 1 });

        const row = await getOverallCountsRow();

        const [text] = runReadQueryMock.mock.calls[0] as [string];
        expect(text).toContain('FROM email_logs');
        expect(text).toContain("IN ('sent', 'delivered', 'bounced', 'complained')");
        expect(text).toContain("IN ('pending', 'queued')");
        expect(text).toContain("l.send_status = 'failed'");
        expect(row.sent_count).toBe(8278);
    });

    test('answers all zeros when the driver returns no row', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(getOverallCountsRow()).resolves.toEqual({
            sent_count: 0,
            delivered_count: 0,
            bounced_count: 0,
            complained_count: 0,
            failed_count: 0,
            pending_count: 0,
        });
    });
});

describe('countCampaignsGroupedByStatus', () => {
    test('groups campaigns by status', async () => {
        runReadQueryMock.mockResolvedValue({
            rows: [{ status: 'completed', count: 80 }],
            rowCount: 1,
        });

        const rows = await countCampaignsGroupedByStatus();

        const [text] = runReadQueryMock.mock.calls[0] as [string];
        expect(text).toContain('GROUP BY status');
        expect(rows).toEqual([{ status: 'completed', count: 80 }]);
    });
});

describe('listRecentCampaignStatsRows', () => {
    test('limits campaigns before the join and binds the limit', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [campaignStatsRow()], rowCount: 1 });

        const rows = await listRecentCampaignStatsRows(10);

        const [text, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('ORDER BY created_at DESC');
        expect(text).toContain('LIMIT $1) c');
        expect(text).toContain('LEFT JOIN email_logs l');
        expect(params).toEqual([10]);
        expect(rows).toHaveLength(1);
    });
});

describe('findCampaignStatsRowById', () => {
    test('filters by campaign and returns the row with counters', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [campaignStatsRow()], rowCount: 1 });

        const row = await findCampaignStatsRowById(CAMPAIGN_ID);

        const [text, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('WHERE c.campaign_id = $1');
        expect(params).toEqual([CAMPAIGN_ID]);
        expect(row?.name).toBe('October Monthly Newsletter');
    });

    test('returns null when the campaign does not exist', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(findCampaignStatsRowById(CAMPAIGN_ID)).resolves.toBeNull();
    });
});

describe('listCampaignStatusAuditRows', () => {
    test('reads only status-setting campaign actions, oldest first', async () => {
        runReadQueryMock.mockResolvedValue({
            rows: [{ user_id: 'usr-agent-1', action: 'create', status: 'draft', created_at: '2026-10-25T08:00:00.000Z' }],
            rowCount: 1,
        });

        const rows = await listCampaignStatusAuditRows(CAMPAIGN_ID);

        const [text, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(text).toContain("entity_type = 'campaign'");
        expect(text).toContain("IN ('create', 'schedule', 'send', 'cancel')");
        expect(text).toContain("changes->'after'->>'status'");
        expect(text).toContain('ORDER BY created_at ASC');
        expect(params).toEqual([CAMPAIGN_ID]);
        expect(rows[0]?.status).toBe('draft');
    });
});
