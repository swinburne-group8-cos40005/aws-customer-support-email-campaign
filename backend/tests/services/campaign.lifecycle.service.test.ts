import type { Queryable } from '#db/connection';

import type { CampaignRow } from '#repositories/campaign.repository';

import { runInTransaction } from '#db/connection';

import {
    cancelScheduledCampaign,
    deleteDraftCampaign,
    getCampaignDetail,
    listCampaignLogs,
    listCampaigns,
    scheduleCampaign,
    sendCampaignImmediately,
    updateDraftCampaign,
} from '#services/campaign.service';

import { insertAuditRecord } from '#repositories/audit-log.repository';
import {
    cancelCampaignRow,
    countCampaignRows,
    deleteCampaignRow,
    findCampaignDetailById,
    findCampaignRowById,
    findCampaignRowForUpdate,
    listCampaignRows,
    markCampaignRowSending,
    scheduleCampaignRow,
    updateCampaignRow,
} from '#repositories/campaign.repository';

import { checkCatalogExists } from '#repositories/catalog.repository';
import { listEmailLogRows } from '#repositories/email-log.repository';




jest.mock('#db/connection', () => ({
    runInTransaction: jest.fn(),
}));

jest.mock('#repositories/catalog.repository', () => ({
    checkCatalogExists: jest.fn(),
}));

jest.mock('#repositories/campaign.repository', () => ({
    ...jest.requireActual('#repositories/campaign.repository'),
    findCampaignRowForUpdate: jest.fn(),
    findCampaignDetailById: jest.fn(),
    findCampaignRowById: jest.fn(),
    countCampaignRows: jest.fn(),
    listCampaignRows: jest.fn(),
    updateCampaignRow: jest.fn(),
    deleteCampaignRow: jest.fn(),
    scheduleCampaignRow: jest.fn(),
    markCampaignRowSending: jest.fn(),
    cancelCampaignRow: jest.fn(),
}));

jest.mock('#repositories/audit-log.repository', () => ({
    insertAuditRecord: jest.fn(),
}));

jest.mock('#repositories/email-log.repository', () => ({
    listEmailLogRows: jest.fn(),
    mapEmailLogRowToResponse: jest.requireActual('#repositories/email-log.repository')
        .mapEmailLogRowToResponse,
}));

const runInTransactionMock = runInTransaction as jest.Mock;
const checkCatalogExistsMock = checkCatalogExists as jest.Mock;
const insertAuditRecordMock = insertAuditRecord as jest.Mock;
const findCampaignRowForUpdateMock = findCampaignRowForUpdate as jest.Mock;
const findCampaignDetailByIdMock = findCampaignDetailById as jest.Mock;
const findCampaignRowByIdMock = findCampaignRowById as jest.Mock;
const countCampaignRowsMock = countCampaignRows as jest.Mock;
const listCampaignRowsMock = listCampaignRows as jest.Mock;
const updateCampaignRowMock = updateCampaignRow as jest.Mock;
const deleteCampaignRowMock = deleteCampaignRow as jest.Mock;
const scheduleCampaignRowMock = scheduleCampaignRow as jest.Mock;
const markCampaignRowSendingMock = markCampaignRowSending as jest.Mock;
const cancelCampaignRowMock = cancelCampaignRow as jest.Mock;
const listEmailLogRowsMock = listEmailLogRows as jest.Mock;

const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';
const TEMPLATE_ID = '22222222-2222-4000-8000-000000000001';
const SEGMENT_ID = '11111111-1111-4000-8000-000000000001';
const USER_ID = 'usr-agent-1';

const row = (overrides: Partial<CampaignRow> = {}): CampaignRow => ({
    campaign_id: CAMPAIGN_ID,
    name: 'Black Friday',
    template_id: TEMPLATE_ID,
    segment_id: SEGMENT_ID,
    status: 'draft',
    dispatch_mode: 'scheduled',
    scheduled_at: null,
    created_by: USER_ID,
    created_at: '2026-11-11T03:00:00.000Z',
    updated_at: '2026-11-11T03:00:00.000Z',
    ...overrides,
});

const scheduledAt = (minutesAhead: number): string =>
    new Date(Date.now() + minutesAhead * 60 * 1000).toISOString();

let tx: { query: jest.Mock };

beforeEach(() => {
    tx = { query: jest.fn() };

    runInTransactionMock.mockReset();
    runInTransactionMock.mockImplementation(async (fn) => fn(tx as unknown as Queryable));

    checkCatalogExistsMock.mockReset();
    checkCatalogExistsMock.mockResolvedValue(true);

    insertAuditRecordMock.mockReset();
    insertAuditRecordMock.mockResolvedValue(undefined);

    findCampaignRowForUpdateMock.mockReset();
    findCampaignRowForUpdateMock.mockResolvedValue(row());

    findCampaignDetailByIdMock.mockReset();
    findCampaignDetailByIdMock.mockResolvedValue({
        ...row(),
        template_name: 'Black Friday Announcement',
        subject_template: 'Black Friday starts now',
        segment_name: 'Gold Customers in Hanoi',
    });

    findCampaignRowByIdMock.mockReset();
    findCampaignRowByIdMock.mockResolvedValue(row());

    countCampaignRowsMock.mockReset();
    countCampaignRowsMock.mockResolvedValue(92);

    listCampaignRowsMock.mockReset();
    listCampaignRowsMock.mockResolvedValue([row()]);

    updateCampaignRowMock.mockReset();
    updateCampaignRowMock.mockResolvedValue(row({ name: 'November Newsletter' }));

    deleteCampaignRowMock.mockReset();
    deleteCampaignRowMock.mockResolvedValue(true);

    scheduleCampaignRowMock.mockReset();
    scheduleCampaignRowMock.mockResolvedValue(row({
        status: 'scheduled',
        scheduled_at: scheduledAt(10),
    }));

    markCampaignRowSendingMock.mockReset();
    markCampaignRowSendingMock.mockResolvedValue(row({
        status: 'sending',
        dispatch_mode: 'immediate',
        scheduled_at: '2026-11-18T03:00:00.000Z',
    }));

    cancelCampaignRowMock.mockReset();
    cancelCampaignRowMock.mockResolvedValue(row({ status: 'cancelled' }));

    listEmailLogRowsMock.mockReset();
    listEmailLogRowsMock.mockResolvedValue([]);
});

describe('listCampaigns', () => {
    test('returns the page plus the contract pagination block', async () => {
        listCampaignRowsMock.mockResolvedValue([row()]);

        const result = await listCampaigns({ page: 1, limit: 20 });

        expect(countCampaignRowsMock).toHaveBeenCalledWith(undefined);
        expect(listCampaignRowsMock).toHaveBeenCalledWith({
            status: undefined,
            limit: 20,
            offset: 0,
        });
        expect(result.pagination).toEqual({
            currentPage: 1,
            totalPages: 5,
            totalItems: 92,
        });
        expect(result.data[0]?.campaignId).toBe(CAMPAIGN_ID);
    });

    test('turns page/limit into an offset and forwards the status filter', async () => {
        await listCampaigns({ page: 3, limit: 20, status: 'scheduled' });

        expect(countCampaignRowsMock).toHaveBeenCalledWith('scheduled');
        expect(listCampaignRowsMock).toHaveBeenCalledWith({
            status: 'scheduled',
            limit: 20,
            offset: 40,
        });
    });

    test('reports zero pages when nothing matches', async () => {
        countCampaignRowsMock.mockResolvedValue(0);
        listCampaignRowsMock.mockResolvedValue([]);

        const result = await listCampaigns({ page: 1, limit: 20 });

        expect(result.pagination.totalPages).toBe(0);
        expect(result.data).toEqual([]);
    });
});

describe('getCampaignDetail', () => {
    test('maps the joined row into the campaign plus template/segment summaries', async () => {
        const detail = await getCampaignDetail(CAMPAIGN_ID);

        expect(findCampaignDetailByIdMock).toHaveBeenCalledWith(CAMPAIGN_ID);
        expect(detail.template.name).toBe('Black Friday Announcement');
        expect(detail.segment.name).toBe('Gold Customers in Hanoi');
    });

    test('404 when the campaign does not exist', async () => {
        findCampaignDetailByIdMock.mockResolvedValue(null);

        await expect(getCampaignDetail(CAMPAIGN_ID)).rejects.toMatchObject({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
        });
    });
});

describe('updateDraftCampaign', () => {
    test('locks, updates and audits the before/after snapshots in one transaction', async () => {
        const updated = await updateDraftCampaign({
            campaignId: CAMPAIGN_ID,
            name: 'November Newsletter',
            userId: USER_ID,
        });

        expect(findCampaignRowForUpdateMock).toHaveBeenCalledWith(tx, CAMPAIGN_ID);
        expect(updateCampaignRowMock).toHaveBeenCalledWith(tx, CAMPAIGN_ID, {
            name: 'November Newsletter',
            templateId: undefined,
            segmentId: undefined,
        });
        expect(updated.name).toBe('November Newsletter');

        const [auditTx, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { action: string; changes: Record<string, unknown> },
        ];
        expect(auditTx).toBe(tx);
        expect(entry.action).toBe('update');
        expect(entry.changes.before).toMatchObject({ status: 'draft', name: 'Black Friday' });
        expect(entry.changes.after).toMatchObject({ name: 'November Newsletter' });
    });

    test('re-checks a new template and segment before writing', async () => {
        await updateDraftCampaign({
            campaignId: CAMPAIGN_ID,
            templateId: TEMPLATE_ID,
            segmentId: SEGMENT_ID,
            userId: USER_ID,
        });

        expect(checkCatalogExistsMock).toHaveBeenNthCalledWith(1, tx, 'templates', TEMPLATE_ID);
        expect(checkCatalogExistsMock).toHaveBeenNthCalledWith(2, tx, 'segments', SEGMENT_ID);
    });

    test('404 when the campaign does not exist', async () => {
        findCampaignRowForUpdateMock.mockResolvedValue(null);

        await expect(
            updateDraftCampaign({ campaignId: CAMPAIGN_ID, name: 'x', userId: USER_ID }),
        ).rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
        expect(updateCampaignRowMock).not.toHaveBeenCalled();
    });

    test('409 when the campaign is no longer a draft', async () => {
        findCampaignRowForUpdateMock.mockResolvedValue(row({ status: 'scheduled' }));

        await expect(
            updateDraftCampaign({ campaignId: CAMPAIGN_ID, name: 'x', userId: USER_ID }),
        ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
        expect(updateCampaignRowMock).not.toHaveBeenCalled();
        expect(insertAuditRecordMock).not.toHaveBeenCalled();
    });

    test('404 when the new template does not exist', async () => {
        checkCatalogExistsMock.mockImplementation(
            async (_tx: Queryable, table: string) => table !== 'templates',
        );

        await expect(
            updateDraftCampaign({
                campaignId: CAMPAIGN_ID,
                templateId: TEMPLATE_ID,
                userId: USER_ID,
            }),
        ).rejects.toMatchObject({ statusCode: 404, message: expect.stringContaining('template') });
        expect(updateCampaignRowMock).not.toHaveBeenCalled();
    });

    test('404 when the new segment does not exist', async () => {
        checkCatalogExistsMock.mockImplementation(
            async (_tx: Queryable, table: string) => table !== 'segments',
        );

        await expect(
            updateDraftCampaign({
                campaignId: CAMPAIGN_ID,
                segmentId: SEGMENT_ID,
                userId: USER_ID,
            }),
        ).rejects.toMatchObject({ statusCode: 404, message: expect.stringContaining('segment') });
        expect(updateCampaignRowMock).not.toHaveBeenCalled();
    });

    test('fails loudly when the guarded UPDATE returns no row', async () => {
        updateCampaignRowMock.mockResolvedValue(null);

        await expect(
            updateDraftCampaign({ campaignId: CAMPAIGN_ID, name: 'x', userId: USER_ID }),
        ).rejects.toThrow('campaign UPDATE after row lock produced no row');
    });
});

describe('deleteDraftCampaign', () => {
    test('deletes the draft and audits a delete with a null after-snapshot', async () => {
        await deleteDraftCampaign(CAMPAIGN_ID, USER_ID);

        expect(deleteCampaignRowMock).toHaveBeenCalledWith(tx, CAMPAIGN_ID);

        const [, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { action: string; changes: Record<string, unknown> },
        ];
        expect(entry.action).toBe('delete');
        expect(entry.changes.after).toBeNull();
        expect(entry.changes.before).toMatchObject({ name: 'Black Friday' });
    });

    test('404 when the campaign does not exist', async () => {
        findCampaignRowForUpdateMock.mockResolvedValue(null);

        await expect(deleteDraftCampaign(CAMPAIGN_ID, USER_ID)).rejects.toMatchObject({
            statusCode: 404,
        });
        expect(deleteCampaignRowMock).not.toHaveBeenCalled();
    });

    test('409 when the campaign is not a draft', async () => {
        findCampaignRowForUpdateMock.mockResolvedValue(row({ status: 'completed' }));

        await expect(deleteDraftCampaign(CAMPAIGN_ID, USER_ID)).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
        });
        expect(deleteCampaignRowMock).not.toHaveBeenCalled();
    });

    test('fails loudly when the guarded DELETE removes no row', async () => {
        deleteCampaignRowMock.mockResolvedValue(false);

        await expect(deleteDraftCampaign(CAMPAIGN_ID, USER_ID)).rejects.toThrow(
            'campaign DELETE after row lock deleted no row',
        );
        expect(insertAuditRecordMock).not.toHaveBeenCalled();
    });
});

describe('scheduleCampaign', () => {
    test('schedules a draft at least 5 minutes ahead and audits the transition', async () => {
        const at = scheduledAt(10);

        const updated = await scheduleCampaign(CAMPAIGN_ID, at, USER_ID);

        expect(scheduleCampaignRowMock).toHaveBeenCalledWith(tx, CAMPAIGN_ID, at);
        expect(updated.status).toBe('scheduled');

        const [, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { action: string; changes: Record<string, unknown> },
        ];
        expect(entry.action).toBe('schedule');
        expect(entry.changes.before).toMatchObject({ status: 'draft' });
        expect(entry.changes.after).toMatchObject({ status: 'scheduled' });
    });

    test('400 when scheduledAt is less than 5 minutes ahead', async () => {
        await expect(
            scheduleCampaign(CAMPAIGN_ID, scheduledAt(1), USER_ID),
        ).rejects.toMatchObject({
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: { field: 'scheduledAt' },
        });
        expect(scheduleCampaignRowMock).not.toHaveBeenCalled();
    });

    test('404 when the campaign does not exist', async () => {
        findCampaignRowForUpdateMock.mockResolvedValue(null);

        await expect(
            scheduleCampaign(CAMPAIGN_ID, scheduledAt(10), USER_ID),
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('409 when the campaign is not a draft', async () => {
        findCampaignRowForUpdateMock.mockResolvedValue(row({ status: 'cancelled' }));

        await expect(
            scheduleCampaign(CAMPAIGN_ID, scheduledAt(10), USER_ID),
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(scheduleCampaignRowMock).not.toHaveBeenCalled();
    });

    test('fails loudly when the guarded UPDATE returns no row', async () => {
        scheduleCampaignRowMock.mockResolvedValue(null);

        await expect(
            scheduleCampaign(CAMPAIGN_ID, scheduledAt(10), USER_ID),
        ).rejects.toThrow('campaign SCHEDULE after row lock produced no row');
    });
});

describe('sendCampaignImmediately', () => {
    test('moves a draft to sending and audits the send action', async () => {
        const updated = await sendCampaignImmediately(CAMPAIGN_ID, USER_ID);

        expect(markCampaignRowSendingMock).toHaveBeenCalledWith(tx, CAMPAIGN_ID);
        expect(updated.status).toBe('sending');
        expect(updated.dispatch_mode).toBe('immediate');

        const [, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { action: string; changes: Record<string, unknown> },
        ];
        expect(entry.action).toBe('send');
        expect(entry.changes.after).toMatchObject({ status: 'sending', dispatchMode: 'immediate' });
    });

    test('404 when the campaign does not exist', async () => {
        findCampaignRowForUpdateMock.mockResolvedValue(null);

        await expect(sendCampaignImmediately(CAMPAIGN_ID, USER_ID)).rejects.toMatchObject({
            statusCode: 404,
        });
    });

    test('409 when the campaign is not a draft', async () => {
        findCampaignRowForUpdateMock.mockResolvedValue(row({ status: 'sending' }));

        await expect(sendCampaignImmediately(CAMPAIGN_ID, USER_ID)).rejects.toMatchObject({
            statusCode: 409,
        });
        expect(markCampaignRowSendingMock).not.toHaveBeenCalled();
    });

    test('fails loudly when the guarded UPDATE returns no row', async () => {
        markCampaignRowSendingMock.mockResolvedValue(null);

        await expect(sendCampaignImmediately(CAMPAIGN_ID, USER_ID)).rejects.toThrow(
            'campaign SEND after row lock produced no row',
        );
    });
});

describe('cancelScheduledCampaign', () => {
    test('cancels a scheduled campaign and audits the transition', async () => {
        findCampaignRowForUpdateMock.mockResolvedValue(row({ status: 'scheduled' }));

        const updated = await cancelScheduledCampaign(CAMPAIGN_ID, USER_ID);

        expect(cancelCampaignRowMock).toHaveBeenCalledWith(tx, CAMPAIGN_ID);
        expect(updated.status).toBe('cancelled');

        const [, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { action: string; changes: Record<string, unknown> },
        ];
        expect(entry.action).toBe('cancel');
        expect(entry.changes.before).toMatchObject({ status: 'scheduled' });
        expect(entry.changes.after).toMatchObject({ status: 'cancelled' });
    });

    test('404 when the campaign does not exist', async () => {
        findCampaignRowForUpdateMock.mockResolvedValue(null);

        await expect(cancelScheduledCampaign(CAMPAIGN_ID, USER_ID)).rejects.toMatchObject({
            statusCode: 404,
        });
    });

    test('409 when the campaign is not scheduled', async () => {
        findCampaignRowForUpdateMock.mockResolvedValue(row({ status: 'draft' }));

        await expect(cancelScheduledCampaign(CAMPAIGN_ID, USER_ID)).rejects.toMatchObject({
            statusCode: 409,
        });
        expect(cancelCampaignRowMock).not.toHaveBeenCalled();
    });

    test('409 when the schedule is already due to send', async () => {
        findCampaignRowForUpdateMock.mockResolvedValue(row({ status: 'scheduled' }));
        cancelCampaignRowMock.mockResolvedValue(null);

        await expect(cancelScheduledCampaign(CAMPAIGN_ID, USER_ID)).rejects.toMatchObject({
            statusCode: 409,
            details: { field: 'scheduledAt' },
        });
        expect(insertAuditRecordMock).not.toHaveBeenCalled();
    });
});

describe('listCampaignLogs', () => {
    test('returns the campaign id plus mapped log entries', async () => {
        listEmailLogRowsMock.mockResolvedValue([
            {
                email_log_id: 'c4d5e6f7-a8b9-4c1d-8e3f-4a5b6c7d8e9f',
                recipient_email: 'user@example.com',
                send_status: 'delivered',
                ses_message_id: '0100017a-8b9c-xyz-000000',
                attempt_count: 1,
                updated_at: '2026-10-30T10:02:15.000Z',
            },
        ]);

        const result = await listCampaignLogs(CAMPAIGN_ID);

        expect(result.campaignId).toBe(CAMPAIGN_ID);
        expect(result.logs[0]).toEqual({
            emailLogId: 'c4d5e6f7-a8b9-4c1d-8e3f-4a5b6c7d8e9f',
            recipientEmail: 'user@example.com',
            sendStatus: 'delivered',
            sesMessageId: '0100017a-8b9c-xyz-000000',
            attemptCount: 1,
            updatedAt: '2026-10-30T10:02:15.000Z',
        });
    });

    test('404 when the campaign does not exist — an empty list would hide the typo', async () => {
        findCampaignRowByIdMock.mockResolvedValue(null);

        await expect(listCampaignLogs(CAMPAIGN_ID)).rejects.toMatchObject({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
        });
        expect(listEmailLogRowsMock).not.toHaveBeenCalled();
    });
});
