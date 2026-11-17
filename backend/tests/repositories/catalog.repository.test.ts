import type { Queryable } from '#db/connection';

import { checkCatalogExists } from '#repositories/catalog.repository';




const tx: { query: jest.Mock } = { query: jest.fn() };

const asTx = (): Queryable => tx as unknown as Queryable;

beforeEach(() => {
    tx.query.mockReset();
});

describe('checkCatalogExists', () => {
    test('templates probe queries the right table/column and reports existence', async () => {
        tx.query.mockResolvedValue({ rows: [{ found: 1 }], rowCount: 1 });

        await expect(checkCatalogExists(asTx(), 'templates', 't-1')).resolves.toBe(true);

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('FROM templates');
        expect(text).toContain('template_id = $1');
        expect(params).toEqual(['t-1']);
    });

    test('segments probe queries the right table/column', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(checkCatalogExists(asTx(), 'segments', 's-1')).resolves.toBe(false);

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('FROM segments');
        expect(text).toContain('segment_id = $1');
        expect(params).toEqual(['s-1']);
    });
});
