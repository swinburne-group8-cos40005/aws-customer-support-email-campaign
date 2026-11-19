import type { CreateSegmentInput, SegmentRow } from '#repositories/segment.repository';

import { runInTransaction } from '#db/connection';

import { insertAuditRecord } from '#repositories/audit-log.repository';

import {
    countSegmentRecipients,
    countSegmentSuppressedRecipients,
    findSegmentRowById,
    insertSegmentRow,
    listSegmentRows,
    mapSegmentRowToResponse,
} from '#repositories/segment.repository';

import { NotFoundError } from '#utils/errors';




/** POST /segments command: the validated rules plus the caller's identity. */
export interface CreateSegmentCommand extends CreateSegmentInput {
    userId: string;
}

/** GET /segments envelope — docs/api-contract.md §2.3. */
export interface SegmentListResult {
    data: ReturnType<typeof mapSegmentRowToResponse>[];
}

/** POST /segments/{id}/preview body — docs/api-contract.md §2.3. */
export interface SegmentPreviewResult {
    segmentId: string;
    segmentName: string;
    estimatedRecipients: number;
    suppressedExcluded: number;
    netAudience: number;
    calculatedAt: string;
}

/**
 * Lists every audience segment (docs/api-contract.md §2.3).
 *
 * @returns `{ data }` with the segments, newest first.
 *
 * @example
 * const result = await listSegments()
 * console.log(result.data.length) // Output: 3
 */
export const listSegments = async (): Promise<SegmentListResult> => {
    const rows = await listSegmentRows();

    return { data: rows.map(mapSegmentRowToResponse) };
};

/**
 * Creates a segment from its filter rules and writes the `create`
 * audit row in the same transaction.
 *
 * @param command - Validated name/description/rules plus the caller's identity.
 *
 * @returns The stored segment row.
 *
 * @example
 * const row = await createSegment({
 *     name: 'Gold Customers in Hanoi',
 *     rules: { city: 'Hanoi', tier: 'gold' },
 *     userId: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f',
 * })
 * console.log(row.segment_id) // Output: '11111111-1111-4000-8000-000000000009'
 */
export const createSegment = async (command: CreateSegmentCommand): Promise<SegmentRow> => {
    return runInTransaction(async (tx) => {
        const row = await insertSegmentRow(tx, {
            name: command.name,
            description: command.description,
            rules: command.rules,
        });

        await insertAuditRecord(tx, {
            userId: command.userId,
            action: 'create',
            entityType: 'segment',
            entityId: row.segment_id,
            changes: {
                before: null,
                after: {
                    name: row.name,
                    description: row.description,
                    rules: row.rules,
                },
            },
        });

        return row;
    });
};

/**
 * Estimates the audience of a segment before a campaign is scheduled
 * (US01/US02, docs/api-contract.md §2.3):
 *
 *  - `estimatedRecipients` — members in `customer_segments`;
 *  - `suppressedExcluded` — members whose email is on `email_suppressions`;
 *  - `netAudience` — the difference, i.e. who would actually receive mail.
 *
 * Both counts read the same membership snapshot, so the subtraction is
 * meaningful rather than two unrelated numbers.
 *
 * @param segmentId - Segment UUID from the path.
 *
 * @returns The preview body in contract field names.
 *
 * @throws NotFoundError When the segment does not exist.
 *
 * @example
 * const preview = await previewSegment('11111111-1111-4000-8000-000000000001')
 * console.log(preview.netAudience) // Output: 8278
 */
export const previewSegment = async (segmentId: string): Promise<SegmentPreviewResult> => {
    const segment = await findSegmentRowById(segmentId);
    if (!segment) {
        throw new NotFoundError('segment', segmentId);
    }

    const [estimatedRecipients, suppressedExcluded] = await Promise.all([
        countSegmentRecipients(segmentId),
        countSegmentSuppressedRecipients(segmentId),
    ]);

    return {
        segmentId: segment.segment_id,
        segmentName: segment.name,
        estimatedRecipients,
        suppressedExcluded,
        netAudience: estimatedRecipients - suppressedExcluded,
        calculatedAt: new Date().toISOString(),
    };
};

export { mapSegmentRowToResponse };
