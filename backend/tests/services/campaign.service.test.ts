import { withTransaction } from '../../src/db/connection';
import { createDraftCampaign } from '../../src/services/campaign.service';
import { catalogExists } from '../../src/repositories/catalog.repository';
import { insertCampaign } from '../../src/repositories/campaign.repository';
import { recordAudit } from '../../src/repositories/audit-log.repository';
import type { Queryable } from '../../src/db/connection';
import type { CampaignRow } from '../../src/repositories/campaign.repository';

jest.mock('../../src/db/connection', () => ({
    withTransaction: jest.fn(),
}));

jest.mock('../../src/repositories/catalog.repository', () => ({
    catalogExists: jest.fn(),
}));

jest.mock('../../src/repositories/campaign.repository', () => ({
    insertCampaign: jest.fn(),
    toCampaignResponse: jest.requireActual('../../src/repositories/campaign.repository')
        .toCampaignResponse,
}));

jest.mock('../../src/repositories/audit-log.repository', () => ({
    recordAudit: jest.fn(),
}));

const withTransactionMock = withTransaction as jest.Mock;
const catalogExistsMock = catalogExists as jest.Mock;
const insertCampaignMock = insertCampaign as jest.Mock;
const recordAuditMock = recordAudit as jest.Mock;

const TEMPLATE_ID = '22222222-2222-4000-8000-000000000001';
const SEGMENT_ID = '11111111-1111-4000-8000-000000000001';
const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';

const row = (): CampaignRow => ({
    campaign_id: CAMPAIGN_ID,
    name: 'Black Friday',
    template_id: TEMPLATE_ID,
    segment_id: SEGMENT_ID,
    status: 'draft',
    created_by: 'usr-agent-1',
    created_at: '2026-11-11T03:00:00.000Z',
    updated_at: '2026-11-11T03:00:00.000Z',
});

let tx: { query: jest.Mock };

const command = () => ({
    name: 'Black Friday',
    templateId: TEMPLATE_ID,
    segmentId: SEGMENT_ID,
    userId: 'usr-agent-1',
});

beforeEach(() => {
    tx = { query: jest.fn() };
    withTransactionMock.mockReset().mockImplementation(
        async (fn: (t: Queryable) => unknown) => fn(tx as unknown as Queryable),
    );
    catalogExistsMock.mockReset().mockResolvedValue(true);
    insertCampaignMock.mockReset().mockResolvedValue(row());
    recordAuditMock.mockReset().mockResolvedValue(undefined);
});

describe('createDraftCampaign', () => {
    test('checks template and segment inside the same transaction, then inserts a draft', async () => {
        const result = await createDraftCampaign(command());

        expect(catalogExistsMock).toHaveBeenNthCalledWith(1, tx, 'templates', TEMPLATE_ID);
        expect(catalogExistsMock).toHaveBeenNthCalledWith(2, tx, 'segments', SEGMENT_ID);
        expect(insertCampaignMock).toHaveBeenCalledWith(tx, {
            name: 'Black Friday',
            templateId: TEMPLATE_ID,
            segmentId: SEGMENT_ID,
            createdBy: 'usr-agent-1',
        });
        expect(result.campaign_id).toBe(CAMPAIGN_ID);
    });

    test('audit row rides the same transaction: action=create + before/after snapshot', async () => {
        await createDraftCampaign(command());

        expect(recordAuditMock).toHaveBeenCalledTimes(1);
        const [auditTx, entry] = recordAuditMock.mock.calls[0] as [
            Queryable,
            { changes: Record<string, unknown> },
        ];
        expect(auditTx).toBe(tx);
        expect(JSON.parse(JSON.stringify(entry.changes))).toEqual({
            before: null,
            after: {
                name: 'Black Friday',
                templateId: TEMPLATE_ID,
                segmentId: SEGMENT_ID,
                status: 'draft',
            },
        });
    });

    test('404 when the template does not exist — campaign is never inserted', async () => {
        catalogExistsMock.mockImplementation(
            async (_tx: Queryable, table: string) => table !== 'templates',
        );

        await expect(createDraftCampaign(command())).rejects.toMatchObject({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
            message: expect.stringContaining('template'),
        });
        expect(insertCampaignMock).not.toHaveBeenCalled();
        expect(recordAuditMock).not.toHaveBeenCalled();
    });

    test('404 when the segment does not exist — campaign is never inserted', async () => {
        catalogExistsMock.mockImplementation(
            async (_tx: Queryable, table: string) => table !== 'segments',
        );

        await expect(createDraftCampaign(command())).rejects.toMatchObject({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
            message: expect.stringContaining('segment'),
        });
        expect(insertCampaignMock).not.toHaveBeenCalled();
        expect(recordAuditMock).not.toHaveBeenCalled();
    });
});
