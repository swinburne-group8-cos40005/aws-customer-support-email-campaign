import type { Queryable, Row } from '#db/connection';

/** Shape of the `campaigns` table row this repository reads/writes. */
export interface CampaignRow {
    campaign_id: string;
    name: string;
    template_id: string;
    segment_id: string;
    status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled' | 'failed';
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface CreateCampaignInput {
    name: string;
    templateId: string;
    segmentId: string;
    createdBy: string;
}

/**
 * Inserts a draft campaign row. Status is hard-coded to 'draft' rather
 * than taken from input: a campaign can only ever be born as a draft,
 * and the state machine (docs/email-state-machine.md) owns every later
 * transition.
 *
 * @param tx - Open transaction to run the INSERT on.
 * @param input - Validated campaign fields plus the creator's identity.
 *
 * @returns The stored row as promised by the RETURNING clause.
 *
 * @throws Error When the INSERT RETURNING yields no row — a driver/PG
 *         defect that must fail loudly, not shape-shift.
 *
 * @example
 * const row = await insertCampaignRow(tx, {
 *     name: 'Black Friday',
 *     templateId: '22222222-2222-4000-8000-000000000001',
 *     segmentId: '11111111-1111-4000-8000-000000000001',
 *     createdBy: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f',
 * })
 * console.log(row.status) // Output: 'draft' — always, on every insert
 */
export const insertCampaignRow = async (
    tx: Queryable,
    input: CreateCampaignInput,
): Promise<CampaignRow> => {
    const result = await tx.query(
        `INSERT INTO campaigns (name, template_id, segment_id, status, created_by)
         VALUES ($1, $2, $3, 'draft', $4)
         RETURNING campaign_id, name, template_id, segment_id, status,
                   created_by, created_at, updated_at`,
        [input.name, input.templateId, input.segmentId, input.createdBy],
    );

    // RETURNING with VALUES guarantees exactly one row; an empty result
    // is a driver/PG defect and should fail loudly, not shape-shift.
    const row = result.rows[0];
    if (!row) {
        throw new Error('campaign INSERT RETURNING produced no row');
    }

    // The cast asserts the shape the RETURNING clause promises — pg
    // returns untyped rows at runtime.
    return row as unknown as CampaignRow;
};

/**
 * Maps the snake_case storage row onto the camelCase contract body
 * (docs/api-contract.md §2.1). Single source of truth for the response
 * shape — controllers must not duplicate the mapping.
 *
 * @param row - Row read from the campaigns table.
 *
 * @returns Body fields exactly as the contract names them.
 *
 * @example
 * const body = mapCampaignRowToResponse(row)
 * console.log(body)
 * // Output: {
 * //   campaignId: '33333333-3333-4000-8000-000000000009',
 * //   name: 'Black Friday',
 * //   templateId: '22222222-2222-4000-8000-000000000001',
 * //   segmentId: '11111111-1111-4000-8000-000000000001',
 * //   status: 'draft',
 * //   createdBy: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f',
 * //   createdAt: '2026-11-11T03:00:00.000Z',
 * //   updatedAt: '2026-11-11T03:00:00.000Z',
 * // }
 */
export const mapCampaignRowToResponse = (row: CampaignRow) => ({
    campaignId: row.campaign_id,
    name: row.name,
    templateId: row.template_id,
    segmentId: row.segment_id,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export type { Row };
