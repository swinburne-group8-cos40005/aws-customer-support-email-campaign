import type { Queryable } from '../../src/db/connection';
import { catalogExists } from '../../src/repositories/catalog.repository';

const tx: { query: jest.Mock } = { query: jest.fn() };

const asTx = (): Queryable => tx as unknown as Queryable;

beforeEach(() => {
    tx.query.mockReset();
});

describe('catalogExists', () => {
    test('templates probe queries the right table/column and reports existence', async () => {
        tx.query.mockResolvedValue({ rows: [{ found: 1 }], rowCount: 1 });

        await expect(catalogExists(asTx(), 'templates', 't-1')).resolves.toBe(true);

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('FROM templates');
        expect(text).toContain('template_id = $1');
        expect(params).toEqual(['t-1']);
    });

    test('segments probe queries the right table/column', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(catalogExists(asTx(), 'segments', 's-1')).resolves.toBe(false);

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('FROM segments');
        expect(text).toContain('segment_id = $1');
        expect(params).toEqual(['s-1']);
    });
});
