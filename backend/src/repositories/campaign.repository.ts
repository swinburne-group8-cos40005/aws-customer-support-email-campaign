import type { Queryable, Row } from '../db/connection';

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
 * Inserts a draft campaign. Status is hard-coded to 'draft' rather than
 * taken from input: a campaign can only ever be born as a draft, and the
 * state machine (docs/email-state-machine.md) owns every later transition.
 */
export const insertCampaign = async (
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
    return result.rows[0] as CampaignRow;
};

/** Maps the snake_case storage row onto the camelCase contract body (§2.1). */
export const toCampaignResponse = (row: CampaignRow) => ({
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
