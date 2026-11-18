import type { Queryable } from '#db/connection';
import { runReadQuery } from '#db/connection';

import type { CustomerRow, SuppressionRow } from '#repositories/customer.repository';
import {
    deleteSuppression,
    findCustomerRowById,
    findCustomerRowForUpdate,
    findSuppressionByEmail,
    findSuppressionRowForUpdate,
    upsertSuppression,
} from '#repositories/customer.repository';




jest.mock('#db/connection', () => ({
    runReadQuery: jest.fn(),
}));

const runReadQueryMock = runReadQuery as jest.Mock;

const tx: { query: jest.Mock } = { query: jest.fn() };

const asTx = (): Queryable => tx as unknown as Queryable;

const CUSTOMER_ID = '00000000-0000-4000-8000-000000000006';

const customerRow = (): CustomerRow => ({
    customer_id: CUSTOMER_ID,
    email: 'khoa.vo@example.com',
    created_at: '2026-09-06T03:00:00.000Z',
});

const suppressionRow = (): SuppressionRow => ({
    email_normalized: 'khoa.vo@example.com',
    reason: 'manual_opt_out',
    created_at: '2026-10-20T06:30:00.000Z',
});

beforeEach(() => {
    tx.query.mockReset();
    runReadQueryMock.mockReset();
});

describe('findCustomerRowForUpdate', () => {
    test('locks the customer row with FOR UPDATE', async () => {
        tx.query.mockResolvedValue({ rows: [customerRow()], rowCount: 1 });

        const row = await findCustomerRowForUpdate(asTx(), CUSTOMER_ID);

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('FOR UPDATE');
        expect(params).toEqual([CUSTOMER_ID]);
        expect(row?.email).toBe('khoa.vo@example.com');
    });

    test('returns null when the customer does not exist', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(findCustomerRowForUpdate(asTx(), CUSTOMER_ID)).resolves.toBeNull();
    });
});

describe('findCustomerRowById', () => {
    test('reads through the pool without locking', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [customerRow()], rowCount: 1 });

        const row = await findCustomerRowById(CUSTOMER_ID);

        const [text] = runReadQueryMock.mock.calls[0] as [string];
        expect(text).not.toContain('FOR UPDATE');
        expect(row?.customer_id).toBe(CUSTOMER_ID);
    });

    test('returns null when no row matches', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(findCustomerRowById(CUSTOMER_ID)).resolves.toBeNull();
    });
});

describe('findSuppressionByEmail', () => {
    test('looks the address up on its normalised form', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [suppressionRow()], rowCount: 1 });

        const row = await findSuppressionByEmail('khoa.vo@example.com');

        const [, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(params).toEqual(['khoa.vo@example.com']);
        expect(row?.reason).toBe('manual_opt_out');
    });

    test('returns null when the address is not suppressed', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(findSuppressionByEmail('an.lam@example.com')).resolves.toBeNull();
    });
});

describe('findSuppressionRowForUpdate', () => {
    test('locks the suppression row inside the transaction', async () => {
        tx.query.mockResolvedValue({ rows: [suppressionRow()], rowCount: 1 });

        const row = await findSuppressionRowForUpdate(asTx(), 'khoa.vo@example.com');

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('FOR UPDATE');
        expect(params).toEqual(['khoa.vo@example.com']);
        expect(row?.reason).toBe('manual_opt_out');
    });

    test('returns null when no suppression row exists', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(
            findSuppressionRowForUpdate(asTx(), 'an.lam@example.com'),
        ).resolves.toBeNull();
    });
});

describe('upsertSuppression', () => {
    test('upserts on the normalised email and returns the stored row', async () => {
        tx.query.mockResolvedValue({ rows: [suppressionRow()], rowCount: 1 });

        const row = await upsertSuppression(
            asTx(),
            'khoa.vo@example.com',
            'manual_opt_out',
        );

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('ON CONFLICT (email_normalized)');
        expect(text).toContain('DO UPDATE SET reason = EXCLUDED.reason');
        expect(params).toEqual(['khoa.vo@example.com', 'manual_opt_out']);
        expect(row.email_normalized).toBe('khoa.vo@example.com');
    });

    test('fails loudly when RETURNING yields no row', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(
            upsertSuppression(asTx(), 'khoa.vo@example.com', 'manual_opt_out'),
        ).rejects.toThrow('suppression UPSERT RETURNING produced no row');
    });
});

describe('deleteSuppression', () => {
    test('reports true when a suppression row was removed', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 1 });

        const removed = await deleteSuppression(asTx(), 'khoa.vo@example.com');

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('DELETE FROM email_suppressions');
        expect(params).toEqual(['khoa.vo@example.com']);
        expect(removed).toBe(true);
    });

    test('reports false when the address was not suppressed', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(deleteSuppression(asTx(), 'an.lam@example.com')).resolves.toBe(false);
    });
});
