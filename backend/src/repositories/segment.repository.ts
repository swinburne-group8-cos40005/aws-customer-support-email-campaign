import type { Queryable } from '#db/connection';
import { runReadQuery } from '#db/connection';




/** Shape of the `segments` table row this repository reads/writes. */
export interface SegmentRow {
    segment_id: string;
    name: string;
    description: string | null;
    rules: Record<string, unknown>;
    created_at: string;
}

export interface CreateSegmentInput {
    name: string;
    description?: string;
    rules: Record<string, unknown>;
}

const _SEGMENT_COLUMNS = `segment_id, name, description, rules, created_at`;

/**
 * Inserts one audience segment. `rules` is stored as JSONB so the
 * dispatcher can evaluate the filter tree at dispatch time
 * (db/schema.sql); the API only guarantees it is a JSON object.
 *
 * @param tx - Open transaction to run the INSERT on.
 * @param input - Validated segment fields.
 *
 * @returns The stored row as promised by the RETURNING clause.
 *
 * @throws Error When RETURNING yields no row — a driver/PG defect.
 *
 * @example
 * const row = await insertSegmentRow(tx, {
 *     name: 'Gold Customers in Hanoi',
 *     rules: { city: 'Hanoi', tier: 'gold' },
 * })
 * console.log(row.name) // Output: 'Gold Customers in Hanoi'
 */
export const insertSegmentRow = async (
    tx: Queryable,
    input: CreateSegmentInput,
): Promise<SegmentRow> => {
    const result = await tx.query(
        `INSERT INTO segments (name, description, rules)
         VALUES ($1, $2, $3::jsonb)
         RETURNING ${_SEGMENT_COLUMNS}`,
        [input.name, input.description ?? null, JSON.stringify(input.rules)],
    );

    const row = result.rows[0];
    if (!row) {
        throw new Error('segment INSERT RETURNING produced no row');
    }

    return row as unknown as SegmentRow;
};

/**
 * Reads one segment without locking — the preview endpoint's existence
 * check and (later) the campaign detail path.
 *
 * @param segmentId - Primary key to look for.
 *
 * @returns The stored row, or null when it does not exist.
 *
 * @example
 * const row = await findSegmentRowById(segmentId)
 * console.log(row?.name) // Output: 'Gold Customers in Hanoi'
 */
export const findSegmentRowById = async (segmentId: string): Promise<SegmentRow | null> => {
    const result = await runReadQuery(
        `SELECT ${_SEGMENT_COLUMNS}
         FROM segments
         WHERE segment_id = $1`,
        [segmentId],
    );

    return (result.rows[0] as unknown as SegmentRow | undefined) ?? null;
};

/**
 * Lists every segment, newest first (docs/api-contract.md §2.3 asks for
 * the segment list, no pagination block).
 *
 * @returns Every segment row, possibly empty.
 *
 * @example
 * const rows = await listSegmentRows()
 * console.log(rows.length) // Output: 3
 */
export const listSegmentRows = async (): Promise<SegmentRow[]> => {
    const result = await runReadQuery(
        `SELECT ${_SEGMENT_COLUMNS}
         FROM segments
         ORDER BY created_at DESC, segment_id DESC`,
    );

    return result.rows as unknown as SegmentRow[];
};

/**
 * Counts the customers assigned to a segment. Membership lives in
 * `customer_segments` (db/schema.sql) — a raw count is the preview
 * endpoint's "estimatedRecipients".
 *
 * @param segmentId - Segment whose members to count.
 *
 * @returns Number of customer_segments rows for the segment.
 *
 * @example
 * const estimated = await countSegmentRecipients(segmentId)
 * console.log(estimated) // Output: 8420
 */
export const countSegmentRecipients = async (segmentId: string): Promise<number> => {
    const result = await runReadQuery(
        `SELECT COUNT(*) AS count
         FROM customer_segments
         WHERE segment_id = $1`,
        [segmentId],
    );

    const row = result.rows[0];
    return row ? Number(row.count) : 0;
};

/**
 * Counts how many of a segment's members are on the global suppression
 * list — the preview's "suppressedExcluded". Emails are compared on the
 * same normalised form the table is keyed on (db/schema.sql).
 *
 * @param segmentId - Segment whose suppressed members to count.
 *
 * @returns Number of members whose email is suppressed.
 *
 * @example
 * const excluded = await countSegmentSuppressedRecipients(segmentId)
 * console.log(excluded) // Output: 142
 */
export const countSegmentSuppressedRecipients = async (segmentId: string): Promise<number> => {
    const result = await runReadQuery(
        `SELECT COUNT(*) AS count
         FROM customer_segments cs
         JOIN customers c ON c.customer_id = cs.customer_id
         JOIN email_suppressions s ON s.email_normalized = lower(trim(c.email))
         WHERE cs.segment_id = $1`,
        [segmentId],
    );

    const row = result.rows[0];
    return row ? Number(row.count) : 0;
};

/**
 * Maps a segment row onto the camelCase contract body
 * (docs/api-contract.md §2.3).
 *
 * @param row - Row read from the segments table.
 *
 * @returns Segment fields exactly as the contract names them.
 *
 * @example
 * const body = mapSegmentRowToResponse(row)
 * console.log(body.rules) // Output: { city: 'Hanoi', tier: 'gold' }
 */
export const mapSegmentRowToResponse = (row: SegmentRow) => ({
    segmentId: row.segment_id,
    name: row.name,
    description: row.description,
    rules: row.rules,
    createdAt: row.created_at,
});
