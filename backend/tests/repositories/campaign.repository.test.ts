import type { Queryable } from '../../src/db/connection';
import { insertCampaign, toCampaignResponse } from '../../src/repositories/campaign.repository';

const tx: { query: jest.Mock } = { query: jest.fn() };

const asTx = (): Queryable => tx as unknown as Queryable;

const campaignRow = () => ({
    campaign_id: '33333333-3333-4000-8000-000000000009',
    name: 'Black Friday',
    template_id: '22222222-2222-4000-8000-000000000001',
    segment_id: '11111111-1111-4000-8000-000000000001',
    status: 'draft',
    created_by: 'usr-agent-1',
    created_at: '2026-11-11T03:00:00.000Z',
    updated_at: '2026-11-11T03:00:00.000Z',
});

beforeEach(() => {
    tx.query.mockReset();
});

describe('insertCampaign', () => {
    test('INSERT hard-codes draft status and passes created_by as parameter', async () => {
        tx.query.mockResolvedValue({ rows: [campaignRow()], rowCount: 1 });

        await insertCampaign(asTx(), {
            name: 'Black Friday',
            templateId: '22222222-2222-4000-8000-000000000001',
            segmentId: '11111111-1111-4000-8000-000000000001',
            createdBy: 'usr-agent-1',
        });

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain("'draft'");
        expect(text).not.toContain('$5');
        expect(params).toEqual([
            'Black Friday',
            '22222222-2222-4000-8000-000000000001',
            '11111111-1111-4000-8000-000000000001',
            'usr-agent-1',
        ]);
    });

    test('returns the RETURNING row', async () => {
        tx.query.mockResolvedValue({ rows: [campaignRow()], rowCount: 1 });

        const row = await insertCampaign(asTx(), {
            name: 'Black Friday',
            templateId: '22222222-2222-4000-8000-000000000001',
            segmentId: '11111111-1111-4000-8000-000000000001',
            createdBy: 'usr-agent-1',
        });

        expect(row.campaign_id).toBe('33333333-3333-4000-8000-000000000009');
        expect(row.status).toBe('draft');
    });

    test('fails loudly when RETURNING yields no row (driver defect)', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(
            insertCampaign(asTx(), {
                name: 'Black Friday',
                templateId: '22222222-2222-4000-8000-000000000001',
                segmentId: '11111111-1111-4000-8000-000000000001',
                createdBy: 'usr-agent-1',
            }),
        ).rejects.toThrow('campaign INSERT RETURNING produced no row');
    });
});

describe('toCampaignResponse', () => {
    test('maps the snake_case storage row onto the contract body (§2.1)', () => {
        expect(toCampaignResponse(campaignRow())).toEqual({
            campaignId: '33333333-3333-4000-8000-000000000009',
            name: 'Black Friday',
            templateId: '22222222-2222-4000-8000-000000000001',
            segmentId: '11111111-1111-4000-8000-000000000001',
            status: 'draft' as const,
            createdBy: 'usr-agent-1',
            createdAt: '2026-11-11T03:00:00.000Z',
            updatedAt: '2026-11-11T03:00:00.000Z',
        });
    });
});
