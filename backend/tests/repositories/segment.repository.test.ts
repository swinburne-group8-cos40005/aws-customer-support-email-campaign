import type { Queryable } from '#db/connection';
import { runReadQuery } from '#db/connection';

import type { SegmentRow } from '#repositories/segment.repository';
import {
    countSegmentRecipients,
    countSegmentSuppressedRecipients,
    findSegmentRowById,
    insertSegmentRow,
    listSegmentRows,
    mapSegmentRowToResponse,
} from '#repositories/segment.repository';




jest.mock('#db/connection', () => ({
    runReadQuery: jest.fn(),
}));

const runReadQueryMock = runReadQuery as jest.Mock;
const tx: { query: jest.Mock } = { query: jest.fn() };
const asTx = (): Queryable => tx as unknown as Queryable;

const SEGMENT_ID = '11111111-1111-4000-8000-000000000001';

const segmentRow = (): SegmentRow => ({
    segment_id: SEGMENT_ID,
    name: 'Gold Customers in Hanoi',
    description: 'Loyalty tier gold, city Hanoi',
    rules: { city: 'Hanoi', tier: 'gold' },
    created_at: '2026-10-01T03:00:00.000Z',
});

beforeEach(() => {
    tx.query.mockReset();
    runReadQueryMock.mockReset();
});

describe('insertSegmentRow', () => {
    test('serialises the rules tree as JSONB text', async () => {
        tx.query.mockResolvedValue({ rows: [segmentRow()], rowCount: 1 });

        const row = await insertSegmentRow(asTx(), {
            name: 'Gold Customers in Hanoi',
            rules: { city: 'Hanoi', tier: 'gold' },
        });

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('$3::jsonb');
        expect(params).toEqual([
            'Gold Customers in Hanoi',
            null,
            JSON.stringify({ city: 'Hanoi', tier: 'gold' }),
        ]);
        expect(row.segment_id).toBe(SEGMENT_ID);
    });

    test('fails loudly when RETURNING yields no row', async () => {
        tx.query.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(
            insertSegmentRow(asTx(), { name: 'x', rules: {} }),
        ).rejects.toThrow('segment INSERT RETURNING produced no row');
    });
});

describe('findSegmentRowById', () => {
    test('returns the segment row', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [segmentRow()], rowCount: 1 });

        const row = await findSegmentRowById(SEGMENT_ID);

        const [, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(params).toEqual([SEGMENT_ID]);
        expect(row?.name).toBe('Gold Customers in Hanoi');
    });

    test('returns null when no row matches', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(findSegmentRowById(SEGMENT_ID)).resolves.toBeNull();
    });
});

describe('listSegmentRows', () => {
    test('reads every segment newest first', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [segmentRow()], rowCount: 1 });

        const rows = await listSegmentRows();

        const [text] = runReadQueryMock.mock.calls[0] as [string];
        expect(text).toContain('ORDER BY created_at DESC');
        expect(rows).toHaveLength(1);
    });
});

describe('countSegmentRecipients', () => {
    test('returns the numeric membership count', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [{ count: '8420' }], rowCount: 1 });

        const total = await countSegmentRecipients(SEGMENT_ID);

        const [, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(params).toEqual([SEGMENT_ID]);
        expect(total).toBe(8420);
    });

    test('answers 0 when the driver returns no row', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(countSegmentRecipients(SEGMENT_ID)).resolves.toBe(0);
    });
});

describe('countSegmentSuppressedRecipients', () => {
    test('joins customers and normalises the email for the suppression lookup', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [{ count: '142' }], rowCount: 1 });

        const excluded = await countSegmentSuppressedRecipients(SEGMENT_ID);

        const [text, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('email_suppressions');
        expect(text).toContain('lower(trim(c.email))');
        expect(params).toEqual([SEGMENT_ID]);
        expect(excluded).toBe(142);
    });

    test('answers 0 when the driver returns no row', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(countSegmentSuppressedRecipients(SEGMENT_ID)).resolves.toBe(0);
    });
});

describe('mapSegmentRowToResponse', () => {
    test('maps the snake_case row onto the contract body (§2.3)', () => {
        expect(mapSegmentRowToResponse(segmentRow())).toEqual({
            segmentId: SEGMENT_ID,
            name: 'Gold Customers in Hanoi',
            description: 'Loyalty tier gold, city Hanoi',
            rules: { city: 'Hanoi', tier: 'gold' },
            createdAt: '2026-10-01T03:00:00.000Z',
        });
    });
});
