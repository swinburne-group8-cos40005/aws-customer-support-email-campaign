import { runInTransaction } from '../../src/db/connection';
import { createDraftCampaign } from '../../src/services/campaign.service';
import { checkCatalogExists } from '../../src/repositories/catalog.repository';
import { insertCampaignRow } from '../../src/repositories/campaign.repository';
import { insertAuditRecord } from '../../src/repositories/audit-log.repository';
import type { Queryable } from '../../src/db/connection';
import type { CampaignRow } from '../../src/repositories/campaign.repository';

jest.mock('../../src/db/connection', () => ({
    runInTransaction: jest.fn(),
}));

jest.mock('../../src/repositories/catalog.repository', () => ({
    checkCatalogExists: jest.fn(),
}));

jest.mock('../../src/repositories/campaign.repository', () => ({
    insertCampaignRow: jest.fn(),
    mapCampaignRowToResponse: jest.requireActual('../../src/repositories/campaign.repository')
        .mapCampaignRowToResponse,
}));

jest.mock('../../src/repositories/audit-log.repository', () => ({
    insertAuditRecord: jest.fn(),
}));

const runInTransactionMock = runInTransaction as jest.Mock;
const checkCatalogExistsMock = checkCatalogExists as jest.Mock;
const insertCampaignRowMock = insertCampaignRow as jest.Mock;
const insertAuditRecordMock = insertAuditRecord as jest.Mock;

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

    runInTransactionMock.mockReset();
    runInTransactionMock.mockImplementation(async (fn) => {
        return fn(tx as unknown as Queryable);
    });

    checkCatalogExistsMock.mockReset();
    checkCatalogExistsMock.mockResolvedValue(true);

    insertCampaignRowMock.mockReset();
    insertCampaignRowMock.mockResolvedValue(row());

    insertAuditRecordMock.mockReset();
    insertAuditRecordMock.mockResolvedValue(undefined);
});

describe('createDraftCampaign', () => {
    test('checks template and segment inside the same transaction, then inserts a draft', async () => {
        const result = await createDraftCampaign(command());

        expect(checkCatalogExistsMock).toHaveBeenNthCalledWith(1, tx, 'templates', TEMPLATE_ID);
        expect(checkCatalogExistsMock).toHaveBeenNthCalledWith(2, tx, 'segments', SEGMENT_ID);
        expect(insertCampaignRowMock).toHaveBeenCalledWith(tx, {
            name: 'Black Friday',
            templateId: TEMPLATE_ID,
            segmentId: SEGMENT_ID,
            createdBy: 'usr-agent-1',
        });
        expect(result.campaign_id).toBe(CAMPAIGN_ID);
    });

    test('audit row rides the same transaction: action=create + before/after snapshot', async () => {
        await createDraftCampaign(command());

        expect(insertAuditRecordMock).toHaveBeenCalledTimes(1);
        const [auditTx, entry] = insertAuditRecordMock.mock.calls[0] as [
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
        checkCatalogExistsMock.mockImplementation(
            async (_tx: Queryable, table: string) => table !== 'templates',
        );

        await expect(createDraftCampaign(command())).rejects.toMatchObject({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
            message: expect.stringContaining('template'),
        });
        expect(insertCampaignRowMock).not.toHaveBeenCalled();
        expect(insertAuditRecordMock).not.toHaveBeenCalled();
    });

    test('404 when the segment does not exist — campaign is never inserted', async () => {
        checkCatalogExistsMock.mockImplementation(
            async (_tx: Queryable, table: string) => table !== 'segments',
        );

        await expect(createDraftCampaign(command())).rejects.toMatchObject({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
            message: expect.stringContaining('segment'),
        });
        expect(insertCampaignRowMock).not.toHaveBeenCalled();
        expect(insertAuditRecordMock).not.toHaveBeenCalled();
    });
});
