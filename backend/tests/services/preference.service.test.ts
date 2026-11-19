import type { Queryable } from '#db/connection';

import type { CustomerRow, SuppressionRow } from '#repositories/customer.repository';

import { runInTransaction } from '#db/connection';

import {
    getCustomerPreference,
    updateCustomerPreference,
} from '#services/preference.service';

import { insertAuditRecord } from '#repositories/audit-log.repository';
import {
    deleteSuppression,
    findCustomerRowById,
    findCustomerRowForUpdate,
    findSuppressionByEmail,
    findSuppressionRowForUpdate,
    upsertSuppression,
} from '#repositories/customer.repository';




jest.mock('#db/connection', () => ({
    runInTransaction: jest.fn(),
}));

jest.mock('#repositories/customer.repository', () => ({
    findCustomerRowById: jest.fn(),
    findCustomerRowForUpdate: jest.fn(),
    findSuppressionByEmail: jest.fn(),
    findSuppressionRowForUpdate: jest.fn(),
    upsertSuppression: jest.fn(),
    deleteSuppression: jest.fn(),
}));

jest.mock('#repositories/audit-log.repository', () => ({
    insertAuditRecord: jest.fn(),
}));

const runInTransactionMock = runInTransaction as jest.Mock;
const insertAuditRecordMock = insertAuditRecord as jest.Mock;
const findCustomerRowByIdMock = findCustomerRowById as jest.Mock;
const findCustomerRowForUpdateMock = findCustomerRowForUpdate as jest.Mock;
const findSuppressionByEmailMock = findSuppressionByEmail as jest.Mock;
const findSuppressionRowForUpdateMock = findSuppressionRowForUpdate as jest.Mock;
const upsertSuppressionMock = upsertSuppression as jest.Mock;
const deleteSuppressionMock = deleteSuppression as jest.Mock;

const CUSTOMER_ID = '00000000-0000-4000-8000-000000000006';
const USER_ID = 'usr-agent-1';

const customerRow = (overrides: Partial<CustomerRow> = {}): CustomerRow => ({
    customer_id: CUSTOMER_ID,
    email: 'khoa.vo@example.com',
    created_at: '2026-09-06T03:00:00.000Z',
    ...overrides,
});

const suppressionRow = (
    overrides: Partial<SuppressionRow> = {},
): SuppressionRow => ({
    email_normalized: 'khoa.vo@example.com',
    reason: 'manual_opt_out',
    created_at: '2026-10-20T06:30:00.000Z',
    ...overrides,
});

let tx: { query: jest.Mock };

beforeEach(() => {
    tx = { query: jest.fn() };

    runInTransactionMock.mockReset();
    runInTransactionMock.mockImplementation(async (fn) => fn(tx as unknown as Queryable));

    insertAuditRecordMock.mockReset();
    insertAuditRecordMock.mockResolvedValue(undefined);

    findCustomerRowByIdMock.mockReset();
    findCustomerRowByIdMock.mockResolvedValue(customerRow());

    findCustomerRowForUpdateMock.mockReset();
    findCustomerRowForUpdateMock.mockResolvedValue(customerRow());

    findSuppressionByEmailMock.mockReset();
    findSuppressionByEmailMock.mockResolvedValue(null);

    findSuppressionRowForUpdateMock.mockReset();
    findSuppressionRowForUpdateMock.mockResolvedValue(null);

    upsertSuppressionMock.mockReset();
    upsertSuppressionMock.mockResolvedValue(suppressionRow());

    deleteSuppressionMock.mockReset();
    deleteSuppressionMock.mockResolvedValue(true);
});

describe('getCustomerPreference', () => {
    test('reports the opted-in state when the address has no suppression row', async () => {
        const preference = await getCustomerPreference(CUSTOMER_ID);

        expect(findCustomerRowByIdMock).toHaveBeenCalledWith(CUSTOMER_ID);
        expect(findSuppressionByEmailMock).toHaveBeenCalledWith('khoa.vo@example.com');
        expect(preference).toEqual({
            customerId: CUSTOMER_ID,
            email: 'khoa.vo@example.com',
            isOptedOut: false,
            reason: null,
            suppressedAt: null,
        });
    });

    test('reports the opted-out state plus reason and timestamp', async () => {
        findSuppressionByEmailMock.mockResolvedValue(suppressionRow());

        const preference = await getCustomerPreference(CUSTOMER_ID);

        expect(preference).toMatchObject({
            isOptedOut: true,
            reason: 'manual_opt_out',
            suppressedAt: '2026-10-20T06:30:00.000Z',
        });
    });

    test('looks the suppression up on lower(trim(email))', async () => {
        findCustomerRowByIdMock.mockResolvedValue(
            customerRow({ email: '  Khoa.Vo@Example.com ' }),
        );

        await getCustomerPreference(CUSTOMER_ID);

        expect(findSuppressionByEmailMock).toHaveBeenCalledWith('khoa.vo@example.com');
    });

    test('404 when the customer does not exist', async () => {
        findCustomerRowByIdMock.mockResolvedValue(null);

        await expect(getCustomerPreference(CUSTOMER_ID)).rejects.toMatchObject({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
        });
        expect(findSuppressionByEmailMock).not.toHaveBeenCalled();
    });
});

describe('updateCustomerPreference — opt out', () => {
    test('defaults the reason to manual_opt_out and audits the change', async () => {
        const preference = await updateCustomerPreference({
            customerId: CUSTOMER_ID,
            isOptedOut: true,
            userId: USER_ID,
        });

        expect(findCustomerRowForUpdateMock).toHaveBeenCalledWith(tx, CUSTOMER_ID);
        expect(findSuppressionRowForUpdateMock).toHaveBeenCalledWith(tx, 'khoa.vo@example.com');
        expect(upsertSuppressionMock).toHaveBeenCalledWith(tx, 'khoa.vo@example.com', 'manual_opt_out');
        expect(preference.isOptedOut).toBe(true);

        const [auditTx, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { action: string; entityType: string; changes: Record<string, unknown> },
        ];
        expect(auditTx).toBe(tx);
        expect(entry.action).toBe('opt_out');
        expect(entry.entityType).toBe('customer_preference');
        expect(entry.changes).toEqual({
            before: { isOptedOut: false },
            after: { isOptedOut: true, reason: 'manual_opt_out' },
        });
    });

    test('stores an explicit API reason and records the previous suppression', async () => {
        findSuppressionRowForUpdateMock.mockResolvedValue(
            suppressionRow({ reason: 'customer_requested' }),
        );
        upsertSuppressionMock.mockResolvedValue(
            suppressionRow({ reason: 'manual_opt_out' }),
        );

        await updateCustomerPreference({
            customerId: CUSTOMER_ID,
            isOptedOut: true,
            reason: 'manual_opt_out',
            userId: USER_ID,
        });

        expect(upsertSuppressionMock).toHaveBeenCalledWith(
            tx,
            'khoa.vo@example.com',
            'manual_opt_out',
        );

        const [, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { changes: Record<string, unknown> },
        ];
        expect(entry.changes.before).toEqual({
            isOptedOut: true,
            reason: 'customer_requested',
        });
        expect(entry.changes.after).toEqual({
            isOptedOut: true,
            reason: 'manual_opt_out',
        });
    });

    test('404 when the customer does not exist', async () => {
        findCustomerRowForUpdateMock.mockResolvedValue(null);

        await expect(
            updateCustomerPreference({ customerId: CUSTOMER_ID, isOptedOut: true, userId: USER_ID }),
        ).rejects.toMatchObject({ statusCode: 404 });
        expect(upsertSuppressionMock).not.toHaveBeenCalled();
        expect(insertAuditRecordMock).not.toHaveBeenCalled();
    });
});

describe('updateCustomerPreference — opt in', () => {
    test('removes an API-managed suppression and audits opt_in', async () => {
        findSuppressionRowForUpdateMock.mockResolvedValue(
            suppressionRow({ reason: 'customer_requested' }),
        );

        const preference = await updateCustomerPreference({
            customerId: CUSTOMER_ID,
            isOptedOut: false,
            userId: USER_ID,
        });

        expect(deleteSuppressionMock).toHaveBeenCalledWith(tx, 'khoa.vo@example.com');
        expect(upsertSuppressionMock).not.toHaveBeenCalled();
        expect(preference).toMatchObject({ isOptedOut: false, reason: null, suppressedAt: null });

        const [, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { action: string; changes: Record<string, unknown> },
        ];
        expect(entry.action).toBe('opt_in');
        expect(entry.changes).toEqual({
            before: { isOptedOut: true, reason: 'customer_requested' },
            after: { isOptedOut: false },
        });
    });

    test('is idempotent when the address was never suppressed', async () => {
        deleteSuppressionMock.mockResolvedValue(false);

        const preference = await updateCustomerPreference({
            customerId: CUSTOMER_ID,
            isOptedOut: false,
            userId: USER_ID,
        });

        expect(preference.isOptedOut).toBe(false);

        const [, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { changes: Record<string, unknown> },
        ];
        expect(entry.changes.before).toEqual({ isOptedOut: false });
    });

    test('409 when the suppression came from a bounce', async () => {
        findSuppressionRowForUpdateMock.mockResolvedValue(
            suppressionRow({ reason: 'bounce' }),
        );

        await expect(
            updateCustomerPreference({ customerId: CUSTOMER_ID, isOptedOut: false, userId: USER_ID }),
        ).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
            details: { field: 'isOptedOut' },
        });
        expect(deleteSuppressionMock).not.toHaveBeenCalled();
        expect(insertAuditRecordMock).not.toHaveBeenCalled();
    });

    test('409 when the suppression came from a complaint', async () => {
        findSuppressionRowForUpdateMock.mockResolvedValue(
            suppressionRow({ reason: 'complaint' }),
        );

        await expect(
            updateCustomerPreference({ customerId: CUSTOMER_ID, isOptedOut: false, userId: USER_ID }),
        ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    });

    test('404 when the customer does not exist', async () => {
        findCustomerRowForUpdateMock.mockResolvedValue(null);

        await expect(
            updateCustomerPreference({ customerId: CUSTOMER_ID, isOptedOut: false, userId: USER_ID }),
        ).rejects.toMatchObject({ statusCode: 404 });
        expect(deleteSuppressionMock).not.toHaveBeenCalled();
    });
});
