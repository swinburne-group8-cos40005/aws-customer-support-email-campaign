import type { Queryable } from '#db/connection';

import type { TemplateRow } from '#repositories/template.repository';

import { runInTransaction } from '#db/connection';

import {
    createTemplate,
    deleteTemplate,
    getTemplate,
    listTemplates,
    updateTemplate,
} from '#services/template.service';

import { insertAuditRecord } from '#repositories/audit-log.repository';
import {
    countCampaignsUsingTemplate,
    deleteTemplateRow,
    findTemplateRowById,
    findTemplateRowForUpdate,
    insertTemplateRow,
    listTemplateRows,
    updateTemplateRow,
} from '#repositories/template.repository';




jest.mock('#db/connection', () => ({
    runInTransaction: jest.fn(),
}));

jest.mock('#repositories/template.repository', () => ({
    ...jest.requireActual('#repositories/template.repository'),
    insertTemplateRow: jest.fn(),
    findTemplateRowForUpdate: jest.fn(),
    findTemplateRowById: jest.fn(),
    listTemplateRows: jest.fn(),
    updateTemplateRow: jest.fn(),
    deleteTemplateRow: jest.fn(),
    countCampaignsUsingTemplate: jest.fn(),
}));

jest.mock('#repositories/audit-log.repository', () => ({
    insertAuditRecord: jest.fn(),
}));

const runInTransactionMock = runInTransaction as jest.Mock;
const insertAuditRecordMock = insertAuditRecord as jest.Mock;
const insertTemplateRowMock = insertTemplateRow as jest.Mock;
const findTemplateRowForUpdateMock = findTemplateRowForUpdate as jest.Mock;
const findTemplateRowByIdMock = findTemplateRowById as jest.Mock;
const listTemplateRowsMock = listTemplateRows as jest.Mock;
const updateTemplateRowMock = updateTemplateRow as jest.Mock;
const deleteTemplateRowMock = deleteTemplateRow as jest.Mock;
const countCampaignsUsingTemplateMock = countCampaignsUsingTemplate as jest.Mock;

const TEMPLATE_ID = '22222222-2222-4000-8000-000000000001';
const USER_ID = 'usr-agent-1';

const row = (overrides: Partial<TemplateRow> = {}): TemplateRow => ({
    template_id: TEMPLATE_ID,
    name: 'Black Friday Announcement',
    subject_template: 'Black Friday starts now',
    body_text: 'Hello {{firstName}}',
    body_html: '<p>Hello {{firstName}}</p>',
    created_at: '2026-11-01T03:00:00.000Z',
    updated_at: '2026-11-01T03:00:00.000Z',
    ...overrides,
});

let tx: { query: jest.Mock };

beforeEach(() => {
    tx = { query: jest.fn() };

    runInTransactionMock.mockReset();
    runInTransactionMock.mockImplementation(async (fn) => fn(tx as unknown as Queryable));

    insertAuditRecordMock.mockReset();
    insertAuditRecordMock.mockResolvedValue(undefined);

    insertTemplateRowMock.mockReset();
    insertTemplateRowMock.mockResolvedValue(row());

    findTemplateRowForUpdateMock.mockReset();
    findTemplateRowForUpdateMock.mockResolvedValue(row());

    findTemplateRowByIdMock.mockReset();
    findTemplateRowByIdMock.mockResolvedValue(row());

    listTemplateRowsMock.mockReset();
    listTemplateRowsMock.mockResolvedValue([row()]);

    updateTemplateRowMock.mockReset();
    updateTemplateRowMock.mockResolvedValue(row({ subject_template: 'Last chance' }));

    deleteTemplateRowMock.mockReset();
    deleteTemplateRowMock.mockResolvedValue(true);

    countCampaignsUsingTemplateMock.mockReset();
    countCampaignsUsingTemplateMock.mockResolvedValue(0);
});

describe('listTemplates', () => {
    test('wraps the mapped rows in { data }', async () => {
        const result = await listTemplates();

        expect(result.data[0]).toMatchObject({
            templateId: TEMPLATE_ID,
            name: 'Black Friday Announcement',
        });
    });
});

describe('getTemplate', () => {
    test('returns the mapped template', async () => {
        const template = await getTemplate(TEMPLATE_ID);

        expect(template.subjectTemplate).toBe('Black Friday starts now');
    });

    test('404 when the template does not exist', async () => {
        findTemplateRowByIdMock.mockResolvedValue(null);

        await expect(getTemplate(TEMPLATE_ID)).rejects.toMatchObject({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
        });
    });
});

describe('createTemplate', () => {
    test('inserts and audits the creation in one transaction', async () => {
        const created = await createTemplate({
            name: 'Black Friday Announcement',
            subjectTemplate: 'Black Friday starts now',
            bodyHtml: '<p>Hello {{firstName}}</p>',
            userId: USER_ID,
        });

        expect(insertTemplateRowMock).toHaveBeenCalledWith(tx, {
            name: 'Black Friday Announcement',
            subjectTemplate: 'Black Friday starts now',
            bodyHtml: '<p>Hello {{firstName}}</p>',
            bodyText: undefined,
        });
        expect(created.template_id).toBe(TEMPLATE_ID);

        const [auditTx, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { action: string; changes: Record<string, unknown> },
        ];
        expect(auditTx).toBe(tx);
        expect(entry.action).toBe('create');
        expect(entry.changes.before).toBeNull();
        expect(entry.changes.after).toMatchObject({ subjectTemplate: 'Black Friday starts now' });
    });
});

describe('updateTemplate', () => {
    test('locks, updates and audits the before/after snapshots', async () => {
        const updated = await updateTemplate({
            templateId: TEMPLATE_ID,
            subjectTemplate: 'Last chance',
            userId: USER_ID,
        });

        expect(findTemplateRowForUpdateMock).toHaveBeenCalledWith(tx, TEMPLATE_ID);
        expect(updateTemplateRowMock).toHaveBeenCalledWith(tx, TEMPLATE_ID, {
            name: undefined,
            subjectTemplate: 'Last chance',
            bodyHtml: undefined,
            bodyText: undefined,
        });
        expect(updated.subject_template).toBe('Last chance');

        const [, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { action: string; changes: Record<string, unknown> },
        ];
        expect(entry.action).toBe('update');
        expect(entry.changes.before).toMatchObject({ subjectTemplate: 'Black Friday starts now' });
        expect(entry.changes.after).toMatchObject({ subjectTemplate: 'Last chance' });
    });

    test('404 when the template does not exist', async () => {
        findTemplateRowForUpdateMock.mockResolvedValue(null);

        await expect(
            updateTemplate({ templateId: TEMPLATE_ID, name: 'x', userId: USER_ID }),
        ).rejects.toMatchObject({ statusCode: 404 });
        expect(updateTemplateRowMock).not.toHaveBeenCalled();
    });

    test('fails loudly when the guarded UPDATE returns no row', async () => {
        updateTemplateRowMock.mockResolvedValue(null);

        await expect(
            updateTemplate({ templateId: TEMPLATE_ID, name: 'x', userId: USER_ID }),
        ).rejects.toThrow('template UPDATE after row lock produced no row');
    });
});

describe('deleteTemplate', () => {
    test('deletes an unused template and audits a delete with a null after-snapshot', async () => {
        await deleteTemplate(TEMPLATE_ID, USER_ID);

        expect(countCampaignsUsingTemplateMock).toHaveBeenCalledWith(TEMPLATE_ID);
        expect(deleteTemplateRowMock).toHaveBeenCalledWith(tx, TEMPLATE_ID);

        const [, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { action: string; changes: Record<string, unknown> },
        ];
        expect(entry.action).toBe('delete');
        expect(entry.changes.after).toBeNull();
    });

    test('404 when the template does not exist', async () => {
        findTemplateRowForUpdateMock.mockResolvedValue(null);

        await expect(deleteTemplate(TEMPLATE_ID, USER_ID)).rejects.toMatchObject({
            statusCode: 404,
        });
        expect(deleteTemplateRowMock).not.toHaveBeenCalled();
    });

    test('409 when a campaign still references the template', async () => {
        countCampaignsUsingTemplateMock.mockResolvedValue(2);

        await expect(deleteTemplate(TEMPLATE_ID, USER_ID)).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
        });
        expect(deleteTemplateRowMock).not.toHaveBeenCalled();
        expect(insertAuditRecordMock).not.toHaveBeenCalled();
    });

    test('fails loudly when the DELETE removes no row', async () => {
        deleteTemplateRowMock.mockResolvedValue(false);

        await expect(deleteTemplate(TEMPLATE_ID, USER_ID)).rejects.toThrow(
            'template DELETE after row lock deleted no row',
        );
    });
});
