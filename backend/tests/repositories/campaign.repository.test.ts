import type { Queryable } from '#db/connection';
import { runReadQuery } from '#db/connection';

import type { CampaignDetailRow, CampaignRow } from '#repositories/campaign.repository';
import {
    cancelCampaignRow,
    countCampaignRows,
    deleteCampaignRow,
    findCampaignDetailById,
    findCampaignRowById,
    findCampaignRowForUpdate,
    insertCampaignRow,
    listCampaignRows,
    mapCampaignDetailToResponse,
    mapCampaignRowToResponse,
    markCampaignRowSending,
    scheduleCampaignRow,
    updateCampaignRow,
} from '#repositories/campaign.repository';




jest.mock('#db/connection', () => ({
    runReadQuery: jest.fn(),
}));

const runReadQueryMock = runReadQuery as jest.Mock;

const tx: { query: jest.Mock } = { query: jest.fn() };

const asTx = (): Queryable => tx as unknown as Queryable;

const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';
const TEMPLATE_ID = '22222222-2222-4000-8000-000000000001';
const SEGMENT_ID = '11111111-1111-4000-8000-000000000001';

const campaignRow = (): CampaignRow => ({
    campaign_id: CAMPAIGN_ID,
    name: 'Black Friday',
    template_id: TEMPLATE_ID,
    segment_id: SEGMENT_ID,
    status: 'draft',
    dispatch_mode: 'scheduled',
    scheduled_at: null,
    created_by: 'usr-agent-1',
    created_at: '2026-11-11T03:00:00.000Z',
    updated_at: '2026-11-11T03:00:00.000Z',
});

const detailRow = (): CampaignDetailRow => ({
    ...campaignRow(),
    template_name: 'Black Friday Announcement',
    subject_template: 'Black Friday starts now',
    segment_name: 'Gold Customers in Hanoi',
});

beforeEach(() => {
    tx.query.mockReset();
    runReadQueryMock.mockReset();
});

describe('insertCampaignRow', () => {
    test('INSERT hard-codes draft status and passes created_by as parameter', async () => {
        tx.query.mockResolvedValue({ rows: [campaignRow()], rowCount: 1 });

        await insertCampaignRow(asTx(), {
            name: 'Black Friday',
            templateId: TEMPLATE_ID,
            segmentId: SEGMENT_ID,
            createdBy: 'usr-agent-1',
        });

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain("'draft'");
        expect(text).not.toContain('$5');
        expect(params).toEqual([
            'Black Friday',
            TEMPLATE_ID,
            SEGMENT_ID,
            'usr-agent-1',
        ]);
    });

    test('returns the RETURNING row', async () => {
        tx.query.mockResolvedValue({ rows: [campaignRow()], rowCount: 1 });

        const row = await insertCampaignRow(asTx(), {
            name: 'Black Friday',
            templateId: TEMPLATE_ID,
            segmentId: SEGMENT_ID,
            createdBy: 'usr-agent-1',
        });

        expect(row.campaign_id).toBe(CAMPAIGN_ID);
        expect(row.status).toBe('draft');
    });

    test('fails loudly when RETURNING yields no row (driver defect)', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(
            insertCampaignRow(asTx(), {
                name: 'Black Friday',
                templateId: TEMPLATE_ID,
                segmentId: SEGMENT_ID,
                createdBy: 'usr-agent-1',
            }),
        ).rejects.toThrow('campaign INSERT RETURNING produced no row');
    });
});

describe('findCampaignRowForUpdate', () => {
    test('locks the row with FOR UPDATE and returns it', async () => {
        tx.query.mockResolvedValue({ rows: [campaignRow()], rowCount: 1 });

        const row = await findCampaignRowForUpdate(asTx(), CAMPAIGN_ID);

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('FOR UPDATE');
        expect(params).toEqual([CAMPAIGN_ID]);
        expect(row?.status).toBe('draft');
    });

    test('returns null when the id does not exist', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(findCampaignRowForUpdate(asTx(), CAMPAIGN_ID)).resolves.toBeNull();
    });
});

describe('findCampaignRowById', () => {
    test('reads through the shared pool without locking', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [campaignRow()], rowCount: 1 });

        const row = await findCampaignRowById(CAMPAIGN_ID);

        const [text, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(text).not.toContain('FOR UPDATE');
        expect(params).toEqual([CAMPAIGN_ID]);
        expect(row?.campaign_id).toBe(CAMPAIGN_ID);
    });

    test('returns null when no row matches', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(findCampaignRowById(CAMPAIGN_ID)).resolves.toBeNull();
    });
});

describe('findCampaignDetailById', () => {
    test('joins the template and segment summaries', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [detailRow()], rowCount: 1 });

        const row = await findCampaignDetailById(CAMPAIGN_ID);

        const [text, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('JOIN templates');
        expect(text).toContain('JOIN segments');
        expect(params).toEqual([CAMPAIGN_ID]);
        expect(row?.template_name).toBe('Black Friday Announcement');
    });

    test('returns null when the campaign does not exist', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(findCampaignDetailById(CAMPAIGN_ID)).resolves.toBeNull();
    });
});

describe('countCampaignRows', () => {
    test('returns the numeric count and filters by status when given', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [{ count: '3' }], rowCount: 1 });

        const total = await countCampaignRows('scheduled');

        const [, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(params).toEqual(['scheduled']);
        expect(total).toBe(3);
    });

    test('passes NULL when no status filter is requested', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [{ count: '0' }], rowCount: 1 });

        const total = await countCampaignRows();

        const [, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(params).toEqual([null]);
        expect(total).toBe(0);
    });

    test('answers 0 when the driver returns no row', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(countCampaignRows()).resolves.toBe(0);
    });
});

describe('listCampaignRows', () => {
    test('applies the optional status filter plus LIMIT/OFFSET', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [campaignRow()], rowCount: 1 });

        const rows = await listCampaignRows({ status: 'draft', limit: 20, offset: 40 });

        const [text, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('ORDER BY created_at DESC');
        expect(params).toEqual(['draft', 20, 40]);
        expect(rows).toHaveLength(1);
    });

    test('passes NULL when no status filter is requested', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        const rows = await listCampaignRows({ limit: 10, offset: 0 });

        const [, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(params).toEqual([null, 10, 0]);
        expect(rows).toEqual([]);
    });
});

describe('updateCampaignRow', () => {
    test('keeps omitted fields with COALESCE and returns the updated row', async () => {
        tx.query.mockResolvedValue({ rows: [campaignRow()], rowCount: 1 });

        const row = await updateCampaignRow(asTx(), CAMPAIGN_ID, { name: 'November Newsletter' });

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('COALESCE');
        expect(text).toContain("status = 'draft'");
        expect(params).toEqual([CAMPAIGN_ID, 'November Newsletter', null, null]);
        expect(row?.campaign_id).toBe(CAMPAIGN_ID);
    });

    test('returns null when the row is missing or no longer a draft', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(updateCampaignRow(asTx(), CAMPAIGN_ID, { name: 'x' })).resolves.toBeNull();
    });
});

describe('deleteCampaignRow', () => {
    test('reports true when a draft row was deleted', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 1 });

        const deleted = await deleteCampaignRow(asTx(), CAMPAIGN_ID);

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain("status = 'draft'");
        expect(params).toEqual([CAMPAIGN_ID]);
        expect(deleted).toBe(true);
    });

    test('reports false when nothing matched', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(deleteCampaignRow(asTx(), CAMPAIGN_ID)).resolves.toBe(false);
    });
});

describe('scheduleCampaignRow', () => {
    test('sets scheduled status, dispatch mode and the timestamp', async () => {
        tx.query.mockResolvedValue({ rows: [{ ...campaignRow(), status: 'scheduled' }], rowCount: 1 });

        const row = await scheduleCampaignRow(asTx(), CAMPAIGN_ID, '2026-11-20T03:00:00.000Z');

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain("status = 'scheduled'");
        expect(text).toContain("dispatch_mode = 'scheduled'");
        expect(params).toEqual([CAMPAIGN_ID, '2026-11-20T03:00:00.000Z']);
        expect(row?.status).toBe('scheduled');
    });

    test('returns null when the campaign is no longer a draft', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(
            scheduleCampaignRow(asTx(), CAMPAIGN_ID, '2026-11-20T03:00:00.000Z'),
        ).resolves.toBeNull();
    });
});

describe('markCampaignRowSending', () => {
    test('moves a draft straight to sending with NOW() as dispatch timestamp', async () => {
        tx.query.mockResolvedValue({ rows: [{ ...campaignRow(), status: 'sending' }], rowCount: 1 });

        const row = await markCampaignRowSending(asTx(), CAMPAIGN_ID);

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain("status = 'sending'");
        expect(text).toContain("dispatch_mode = 'immediate'");
        expect(text).toContain('NOW()');
        expect(params).toEqual([CAMPAIGN_ID]);
        expect(row?.status).toBe('sending');
    });

    test('returns null when the campaign is no longer a draft', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(markCampaignRowSending(asTx(), CAMPAIGN_ID)).resolves.toBeNull();
    });
});

describe('cancelCampaignRow', () => {
    test('guards scheduled status and a future execution time', async () => {
        tx.query.mockResolvedValue({ rows: [{ ...campaignRow(), status: 'cancelled' }], rowCount: 1 });

        const row = await cancelCampaignRow(asTx(), CAMPAIGN_ID);

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain("status = 'cancelled'");
        expect(text).toContain("status = 'scheduled'");
        expect(text).toContain('scheduled_at > NOW()');
        expect(params).toEqual([CAMPAIGN_ID]);
        expect(row?.status).toBe('cancelled');
    });

    test('returns null when the schedule already fired', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(cancelCampaignRow(asTx(), CAMPAIGN_ID)).resolves.toBeNull();
    });
});

describe('mapCampaignRowToResponse', () => {
    test('maps the snake_case storage row onto the contract body (§2.1)', () => {
        expect(mapCampaignRowToResponse(campaignRow())).toEqual({
            campaignId: CAMPAIGN_ID,
            name: 'Black Friday',
            templateId: TEMPLATE_ID,
            segmentId: SEGMENT_ID,
            status: 'draft',
            dispatchMode: 'scheduled',
            scheduledAt: null,
            createdBy: 'usr-agent-1',
            createdAt: '2026-11-11T03:00:00.000Z',
            updatedAt: '2026-11-11T03:00:00.000Z',
        });
    });
});

describe('mapCampaignDetailToResponse', () => {
    test('adds the template and segment summaries to the campaign body', () => {
        const body = mapCampaignDetailToResponse(detailRow());

        expect(body.campaignId).toBe(CAMPAIGN_ID);
        expect(body.template).toEqual({
            templateId: TEMPLATE_ID,
            name: 'Black Friday Announcement',
            subjectTemplate: 'Black Friday starts now',
        });
        expect(body.segment).toEqual({
            segmentId: SEGMENT_ID,
            name: 'Gold Customers in Hanoi',
        });
    });
});
