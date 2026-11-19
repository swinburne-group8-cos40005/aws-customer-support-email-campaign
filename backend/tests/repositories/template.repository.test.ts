import type { Queryable } from '#db/connection';
import { runReadQuery } from '#db/connection';

import type { TemplateRow } from '#repositories/template.repository';
import {
    countCampaignsUsingTemplate,
    deleteTemplateRow,
    findTemplateRowById,
    findTemplateRowForUpdate,
    insertTemplateRow,
    listTemplateRows,
    mapTemplateRowToResponse,
    updateTemplateRow,
} from '#repositories/template.repository';




jest.mock('#db/connection', () => ({
    runReadQuery: jest.fn(),
}));

const runReadQueryMock = runReadQuery as jest.Mock;
const tx: { query: jest.Mock } = { query: jest.fn() };
const asTx = (): Queryable => tx as unknown as Queryable;

const TEMPLATE_ID = '22222222-2222-4000-8000-000000000001';

const templateRow = (): TemplateRow => ({
    template_id: TEMPLATE_ID,
    name: 'Black Friday Announcement',
    subject_template: 'Black Friday starts now',
    body_text: 'Hello {{firstName}}',
    body_html: '<p>Hello {{firstName}}</p>',
    created_at: '2026-11-01T03:00:00.000Z',
    updated_at: '2026-11-01T03:00:00.000Z',
});

beforeEach(() => {
    tx.query.mockReset();
    runReadQueryMock.mockReset();
});

describe('insertTemplateRow', () => {
    test('binds the content and returns the stored row', async () => {
        tx.query.mockResolvedValue({ rows: [templateRow()], rowCount: 1 });

        const row = await insertTemplateRow(asTx(), {
            name: 'Black Friday Announcement',
            subjectTemplate: 'Black Friday starts now',
            bodyHtml: '<p>Hello {{firstName}}</p>',
            bodyText: 'Hello {{firstName}}',
        });

        const [, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(params).toEqual([
            'Black Friday Announcement',
            'Black Friday starts now',
            '<p>Hello {{firstName}}</p>',
            'Hello {{firstName}}',
        ]);
        expect(row.template_id).toBe(TEMPLATE_ID);
    });

    test('stores NULL for omitted bodies', async () => {
        tx.query.mockResolvedValue({ rows: [templateRow()], rowCount: 1 });

        await insertTemplateRow(asTx(), {
            name: 'Text only',
            subjectTemplate: 'Subject',
        });

        const [, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(params).toEqual(['Text only', 'Subject', null, null]);
    });

    test('fails loudly when RETURNING yields no row', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(
            insertTemplateRow(asTx(), { name: 'x', subjectTemplate: 'y' }),
        ).rejects.toThrow('template INSERT RETURNING produced no row');
    });
});

describe('findTemplateRowForUpdate', () => {
    test('locks the row with FOR UPDATE', async () => {
        tx.query.mockResolvedValue({ rows: [templateRow()], rowCount: 1 });

        const row = await findTemplateRowForUpdate(asTx(), TEMPLATE_ID);

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('FOR UPDATE');
        expect(params).toEqual([TEMPLATE_ID]);
        expect(row?.name).toBe('Black Friday Announcement');
    });

    test('returns null when the id does not exist', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(findTemplateRowForUpdate(asTx(), TEMPLATE_ID)).resolves.toBeNull();
    });
});

describe('findTemplateRowById', () => {
    test('reads without locking', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [templateRow()], rowCount: 1 });

        const row = await findTemplateRowById(TEMPLATE_ID);

        const [text] = runReadQueryMock.mock.calls[0] as [string];
        expect(text).not.toContain('FOR UPDATE');
        expect(row?.template_id).toBe(TEMPLATE_ID);
    });

    test('returns null when no row matches', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(findTemplateRowById(TEMPLATE_ID)).resolves.toBeNull();
    });
});

describe('listTemplateRows', () => {
    test('reads every template newest first', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [templateRow()], rowCount: 1 });

        const rows = await listTemplateRows();

        const [text] = runReadQueryMock.mock.calls[0] as [string];
        expect(text).toContain('ORDER BY created_at DESC');
        expect(rows).toHaveLength(1);
    });
});

describe('updateTemplateRow', () => {
    test('keeps omitted fields with COALESCE', async () => {
        tx.query.mockResolvedValue({ rows: [templateRow()], rowCount: 1 });

        await updateTemplateRow(asTx(), TEMPLATE_ID, { subjectTemplate: 'Last chance' });

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('COALESCE');
        expect(params).toEqual([TEMPLATE_ID, null, 'Last chance', null, null]);
    });

    test('returns null when the template disappeared', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(
            updateTemplateRow(asTx(), TEMPLATE_ID, { name: 'x' }),
        ).resolves.toBeNull();
    });
});

describe('deleteTemplateRow', () => {
    test('reports true when a row was deleted', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 1 });

        await expect(deleteTemplateRow(asTx(), TEMPLATE_ID)).resolves.toBe(true);
    });

    test('reports false when nothing matched', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(deleteTemplateRow(asTx(), TEMPLATE_ID)).resolves.toBe(false);
    });
});

describe('countCampaignsUsingTemplate', () => {
    test('returns the numeric usage count', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [{ count: '2' }], rowCount: 1 });

        const usage = await countCampaignsUsingTemplate(TEMPLATE_ID);

        const [, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(params).toEqual([TEMPLATE_ID]);
        expect(usage).toBe(2);
    });

    test('answers 0 when the driver returns no row', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(countCampaignsUsingTemplate(TEMPLATE_ID)).resolves.toBe(0);
    });
});

describe('mapTemplateRowToResponse', () => {
    test('maps the snake_case row onto the contract body (§2.2)', () => {
        expect(mapTemplateRowToResponse(templateRow())).toEqual({
            templateId: TEMPLATE_ID,
            name: 'Black Friday Announcement',
            subjectTemplate: 'Black Friday starts now',
            bodyHtml: '<p>Hello {{firstName}}</p>',
            bodyText: 'Hello {{firstName}}',
            createdAt: '2026-11-01T03:00:00.000Z',
            updatedAt: '2026-11-01T03:00:00.000Z',
        });
    });
});
