import type { Queryable } from '#db/connection';

import type { SegmentRow } from '#repositories/segment.repository';

import { runInTransaction } from '#db/connection';

import {
    createSegment,
    listSegments,
    previewSegment,
} from '#services/segment.service';

import { insertAuditRecord } from '#repositories/audit-log.repository';
import {
    countSegmentRecipients,
    countSegmentSuppressedRecipients,
    findSegmentRowById,
    insertSegmentRow,
    listSegmentRows,
} from '#repositories/segment.repository';




jest.mock('#db/connection', () => ({
    runInTransaction: jest.fn(),
}));

jest.mock('#repositories/segment.repository', () => ({
    ...jest.requireActual('#repositories/segment.repository'),
    insertSegmentRow: jest.fn(),
    findSegmentRowById: jest.fn(),
    listSegmentRows: jest.fn(),
    countSegmentRecipients: jest.fn(),
    countSegmentSuppressedRecipients: jest.fn(),
}));

jest.mock('#repositories/audit-log.repository', () => ({
    insertAuditRecord: jest.fn(),
}));

const runInTransactionMock = runInTransaction as jest.Mock;
const insertAuditRecordMock = insertAuditRecord as jest.Mock;
const insertSegmentRowMock = insertSegmentRow as jest.Mock;
const findSegmentRowByIdMock = findSegmentRowById as jest.Mock;
const listSegmentRowsMock = listSegmentRows as jest.Mock;
const countSegmentRecipientsMock = countSegmentRecipients as jest.Mock;
const countSegmentSuppressedRecipientsMock = countSegmentSuppressedRecipients as jest.Mock;

const SEGMENT_ID = '11111111-1111-4000-8000-000000000001';
const USER_ID = 'usr-agent-1';

const row = (): SegmentRow => ({
    segment_id: SEGMENT_ID,
    name: 'Gold Customers in Hanoi',
    description: 'Loyalty tier gold, city Hanoi',
    rules: { city: 'Hanoi', tier: 'gold' },
    created_at: '2026-10-01T03:00:00.000Z',
});

let tx: { query: jest.Mock };

beforeEach(() => {
    tx = { query: jest.fn() };

    runInTransactionMock.mockReset();
    runInTransactionMock.mockImplementation(async (fn) => fn(tx as unknown as Queryable));

    insertAuditRecordMock.mockReset();
    insertAuditRecordMock.mockResolvedValue(undefined);

    insertSegmentRowMock.mockReset();
    insertSegmentRowMock.mockResolvedValue(row());

    findSegmentRowByIdMock.mockReset();
    findSegmentRowByIdMock.mockResolvedValue(row());

    listSegmentRowsMock.mockReset();
    listSegmentRowsMock.mockResolvedValue([row()]);

    countSegmentRecipientsMock.mockReset();
    countSegmentRecipientsMock.mockResolvedValue(8420);

    countSegmentSuppressedRecipientsMock.mockReset();
    countSegmentSuppressedRecipientsMock.mockResolvedValue(142);
});

describe('listSegments', () => {
    test('wraps the mapped rows in { data }', async () => {
        const result = await listSegments();

        expect(result.data[0]).toMatchObject({
            segmentId: SEGMENT_ID,
            name: 'Gold Customers in Hanoi',
            rules: { city: 'Hanoi', tier: 'gold' },
        });
    });
});

describe('createSegment', () => {
    test('inserts the rules tree and audits the creation', async () => {
        const created = await createSegment({
            name: 'Gold Customers in Hanoi',
            description: 'Loyalty tier gold, city Hanoi',
            rules: { city: 'Hanoi', tier: 'gold' },
            userId: USER_ID,
        });

        expect(insertSegmentRowMock).toHaveBeenCalledWith(tx, {
            name: 'Gold Customers in Hanoi',
            description: 'Loyalty tier gold, city Hanoi',
            rules: { city: 'Hanoi', tier: 'gold' },
        });
        expect(created.segment_id).toBe(SEGMENT_ID);

        const [auditTx, entry] = insertAuditRecordMock.mock.calls[0] as [
            Queryable,
            { action: string; changes: Record<string, unknown> },
        ];
        expect(auditTx).toBe(tx);
        expect(entry.action).toBe('create');
        expect(entry.changes.before).toBeNull();
        expect(entry.changes.after).toMatchObject({
            name: 'Gold Customers in Hanoi',
            rules: { city: 'Hanoi', tier: 'gold' },
        });
    });
});

describe('previewSegment', () => {
    test('subtracts suppressed members from the audience estimate', async () => {
        const preview = await previewSegment(SEGMENT_ID);

        expect(preview).toMatchObject({
            segmentId: SEGMENT_ID,
            segmentName: 'Gold Customers in Hanoi',
            estimatedRecipients: 8420,
            suppressedExcluded: 142,
            netAudience: 8278,
        });
        // calculatedAt is a fresh ISO 8601 UTC timestamp on every call.
        expect(preview.calculatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('404 when the segment does not exist', async () => {
        findSegmentRowByIdMock.mockResolvedValue(null);

        await expect(previewSegment(SEGMENT_ID)).rejects.toMatchObject({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
        });
        expect(countSegmentRecipientsMock).not.toHaveBeenCalled();
        expect(countSegmentSuppressedRecipientsMock).not.toHaveBeenCalled();
    });
});
