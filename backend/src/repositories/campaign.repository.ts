import type { Queryable, Row } from '#db/connection';
import { runReadQuery } from '#db/connection';




/** Campaign status values the table's CHECK constraint allows (docs/email-state-machine.md §1.1). */
export type CampaignStatus =
    | 'draft'
    | 'scheduled'
    | 'sending'
    | 'completed'
    | 'cancelled'
    | 'failed';

/** How the campaign was dispatched — set by /schedule or /send (docs/api-contract.md §2.1). */
export type DispatchMode = 'scheduled' | 'immediate';

/** Shape of the `campaigns` table row this repository reads/writes. */
export interface CampaignRow {
    campaign_id: string;
    name: string;
    template_id: string;
    segment_id: string;
    status: CampaignStatus;
    dispatch_mode: DispatchMode;
    scheduled_at: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

/** A campaign row plus the template/segment summary GET /campaigns/{id} returns. */
export interface CampaignDetailRow extends CampaignRow {
    template_name: string;
    subject_template: string;
    segment_name: string;
}

export interface CreateCampaignInput {
    name: string;
    templateId: string;
    segmentId: string;
    createdBy: string;
}

export interface UpdateCampaignInput {
    name?: string;
    templateId?: string;
    segmentId?: string;
}

export interface CampaignListFilters {
    status?: CampaignStatus;
    limit: number;
    offset: number;
}

const _CAMPAIGN_COLUMNS = `campaign_id, name, template_id, segment_id, status,
                           dispatch_mode, scheduled_at, created_by, created_at, updated_at`;

/**
 * Inserts a draft campaign row. Status is hard-coded to 'draft' rather
 * than taken from input: a campaign can only ever be born as a draft,
 * and the state machine (docs/email-state-machine.md) owns every later
 * transition. `dispatch_mode` keeps its column default until /schedule
 * or /send decides the path.
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
         RETURNING ${_CAMPAIGN_COLUMNS}`,
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
 * Reads one campaign and locks it until the transaction ends. Every
 * mutation starts here: the FOR UPDATE lock is what makes
 * "check status, then change it" safe when two requests race (the
 * second one waits and sees the first one's committed status).
 *
 * @param tx - Open transaction performing the mutation.
 * @param campaignId - Primary key to lock.
 *
 * @returns The stored row, or null when the id does not exist.
 *
 * @example
 * const row = await findCampaignRowForUpdate(tx, campaignId)
 * console.log(row?.status) // Output: 'draft' — or null when missing
 */
export const findCampaignRowForUpdate = async (
    tx: Queryable,
    campaignId: string,
): Promise<CampaignRow | null> => {
    const result = await tx.query(
        `SELECT ${_CAMPAIGN_COLUMNS}
         FROM campaigns
         WHERE campaign_id = $1
         FOR UPDATE`,
        [campaignId],
    );

    return (result.rows[0] as unknown as CampaignRow | undefined) ?? null;
};

/**
 * Reads one campaign without locking — the read side of
 * GET /v1/campaigns/{id}.
 *
 * @param campaignId - Primary key to look for.
 *
 * @returns The stored row, or null when it does not exist.
 *
 * @example
 * const row = await findCampaignRowById('33333333-3333-4000-8000-000000000009')
 * console.log(row?.name) // Output: 'Black Friday' — or null when missing
 */
export const findCampaignRowById = async (campaignId: string): Promise<CampaignRow | null> => {
    const result = await runReadQuery(
        `SELECT ${_CAMPAIGN_COLUMNS}
         FROM campaigns
         WHERE campaign_id = $1`,
        [campaignId],
    );

    return (result.rows[0] as unknown as CampaignRow | undefined) ?? null;
};

/**
 * Reads one campaign with its template and segment summary — the body
 * GET /v1/campaigns/{id} promises ("associated template and segment
 * summary", docs/api-contract.md §2.1).
 *
 * @param campaignId - Primary key to look for.
 *
 * @returns The joined row, or null when the campaign does not exist.
 *
 * @example
 * const row = await findCampaignDetailById('33333333-3333-4000-8000-000000000009')
 * console.log(row?.template_name) // Output: 'Black Friday Announcement'
 */
export const findCampaignDetailById = async (
    campaignId: string,
): Promise<CampaignDetailRow | null> => {
    const result = await runReadQuery(
        `SELECT c.campaign_id, c.name, c.template_id, c.segment_id, c.status,
                c.dispatch_mode, c.scheduled_at, c.created_by, c.created_at, c.updated_at,
                t.name AS template_name, t.subject_template,
                s.name AS segment_name
         FROM campaigns c
         JOIN templates t ON t.template_id = c.template_id
         JOIN segments s ON s.segment_id = c.segment_id
         WHERE c.campaign_id = $1`,
        [campaignId],
    );

    return (result.rows[0] as unknown as CampaignDetailRow | undefined) ?? null;
};

/**
 * Counts campaigns for the list endpoint's pagination block. The status
 * filter is optional; $1 = NULL disables it.
 *
 * @param status - Optional status to filter by.
 *
 * @returns Total matching campaigns across all pages.
 *
 * @example
 * const total = await countCampaignRows('scheduled')
 * console.log(total) // Output: 3
 */
export const countCampaignRows = async (status?: CampaignStatus): Promise<number> => {
    const result = await runReadQuery(
        `SELECT COUNT(*) AS count
         FROM campaigns
         WHERE ($1::text IS NULL OR status = $1)`,
        [status ?? null],
    );

    const row = result.rows[0];
    return row ? Number(row.count) : 0;
};

/**
 * Reads one page of campaigns, newest first. Stable ordering is
 * `created_at DESC, campaign_id DESC` so a page boundary cannot repeat
 * or skip a row when two campaigns share a timestamp.
 *
 * @param filters - Optional status plus LIMIT/OFFSET computed by the service.
 *
 * @returns The page's rows, possibly empty.
 *
 * @example
 * const rows = await listCampaignRows({ status: 'draft', limit: 20, offset: 0 })
 * console.log(rows.length) // Output: 2
 */
export const listCampaignRows = async (filters: CampaignListFilters): Promise<CampaignRow[]> => {
    const result = await runReadQuery(
        `SELECT ${_CAMPAIGN_COLUMNS}
         FROM campaigns
         WHERE ($1::text IS NULL OR status = $1)
         ORDER BY created_at DESC, campaign_id DESC
         LIMIT $2 OFFSET $3`,
        [filters.status ?? null, filters.limit, filters.offset],
    );

    return result.rows as unknown as CampaignRow[];
};

/**
 * Applies a partial update to a campaign that is still a draft. The
 * `status = 'draft'` guard duplicates the service's state check on
 * purpose: even if a caller skipped it, SQL can never edit a scheduled
 * or completed campaign. Omitted fields keep their stored value.
 *
 * @param tx - Open transaction holding the row lock.
 * @param campaignId - Primary key to update.
 * @param input - Fields to change; undefined entries are left untouched.
 *
 * @returns The updated row, or null when the row is missing or no longer a draft.
 *
 * @example
 * const row = await updateCampaignRow(tx, campaignId, { name: 'November Newsletter' })
 * console.log(row?.name) // Output: 'November Newsletter'
 */
export const updateCampaignRow = async (
    tx: Queryable,
    campaignId: string,
    input: UpdateCampaignInput,
): Promise<CampaignRow | null> => {
    const result = await tx.query(
        `UPDATE campaigns
         SET name = COALESCE($2::varchar, name),
             template_id = COALESCE($3::uuid, template_id),
             segment_id = COALESCE($4::uuid, segment_id)
         WHERE campaign_id = $1 AND status = 'draft'
         RETURNING ${_CAMPAIGN_COLUMNS}`,
        [campaignId, input.name ?? null, input.templateId ?? null, input.segmentId ?? null],
    );

    return (result.rows[0] as unknown as CampaignRow | undefined) ?? null;
};

/**
 * Deletes a campaign that is still a draft. Scheduled and completed
 * campaigns are history, not deletable drafts — the guard returns false
 * and the service answers 409.
 *
 * @param tx - Open transaction holding the row lock.
 * @param campaignId - Primary key to delete.
 *
 * @returns True when a draft row was deleted.
 *
 * @example
 * const deleted = await deleteCampaignRow(tx, campaignId)
 * console.log(deleted) // Output: true — false when no draft matched
 */
export const deleteCampaignRow = async (
    tx: Queryable,
    campaignId: string,
): Promise<boolean> => {
    const result = await tx.query(
        `DELETE FROM campaigns
         WHERE campaign_id = $1 AND status = 'draft'`,
        [campaignId],
    );

    return (result.rowCount ?? 0) > 0;
};

/**
 * Moves a draft campaign to `scheduled` with the caller's timestamp.
 * The draft guard is in SQL so the transition can only ever come from
 * draft (docs/email-state-machine.md §1.2).
 *
 * @param tx - Open transaction holding the row lock.
 * @param campaignId - Primary key to schedule.
 * @param scheduledAt - Validated ISO 8601 timestamp (at least 5 minutes ahead).
 *
 * @returns The updated row, or null when it is no longer a draft.
 *
 * @example
 * const row = await scheduleCampaignRow(tx, campaignId, '2026-11-20T03:00:00.000Z')
 * console.log(row?.status) // Output: 'scheduled'
 */
export const scheduleCampaignRow = async (
    tx: Queryable,
    campaignId: string,
    scheduledAt: string,
): Promise<CampaignRow | null> => {
    const result = await tx.query(
        `UPDATE campaigns
         SET status = 'scheduled',
             dispatch_mode = 'scheduled',
             scheduled_at = $2::timestamptz
         WHERE campaign_id = $1 AND status = 'draft'
         RETURNING ${_CAMPAIGN_COLUMNS}`,
        [campaignId, scheduledAt],
    );

    return (result.rows[0] as unknown as CampaignRow | undefined) ?? null;
};

/**
 * Moves a draft campaign straight to `sending` for immediate dispatch
 * and stamps `scheduled_at` with NOW() so every campaign keeps a
 * dispatch timestamp (docs/api-contract.md §2.1, /send).
 *
 * @param tx - Open transaction holding the row lock.
 * @param campaignId - Primary key to dispatch.
 *
 * @returns The updated row, or null when it is no longer a draft.
 *
 * @example
 * const row = await markCampaignRowSending(tx, campaignId)
 * console.log(row?.dispatch_mode) // Output: 'immediate'
 */
export const markCampaignRowSending = async (
    tx: Queryable,
    campaignId: string,
): Promise<CampaignRow | null> => {
    const result = await tx.query(
        `UPDATE campaigns
         SET status = 'sending',
             dispatch_mode = 'immediate',
             scheduled_at = NOW()
         WHERE campaign_id = $1 AND status = 'draft'
         RETURNING ${_CAMPAIGN_COLUMNS}`,
        [campaignId],
    );

    return (result.rows[0] as unknown as CampaignRow | undefined) ?? null;
};

/**
 * Cancels a scheduled campaign, but only while its execution time is
 * still in the future (docs/email-state-machine.md §1.2 — "allowed only
 * before the scheduled execution timestamp"). The NOW() comparison runs
 * in the database so API and database clocks cannot disagree.
 *
 * @param tx - Open transaction holding the row lock.
 * @param campaignId - Primary key to cancel.
 *
 * @returns The updated row, or null when the campaign is not a due-in-future schedule.
 *
 * @example
 * const row = await cancelCampaignRow(tx, campaignId)
 * console.log(row?.status) // Output: 'cancelled'
 */
export const cancelCampaignRow = async (
    tx: Queryable,
    campaignId: string,
): Promise<CampaignRow | null> => {
    const result = await tx.query(
        `UPDATE campaigns
         SET status = 'cancelled'
         WHERE campaign_id = $1
           AND status = 'scheduled'
           AND scheduled_at > NOW()
         RETURNING ${_CAMPAIGN_COLUMNS}`,
        [campaignId],
    );

    return (result.rows[0] as unknown as CampaignRow | undefined) ?? null;
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
 * //   dispatchMode: 'scheduled',
 * //   scheduledAt: null,
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
    dispatchMode: row.dispatch_mode,
    scheduledAt: row.scheduled_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

/**
 * Maps the joined detail row onto the GET /campaigns/{id} body: the
 * campaign fields plus a `template` and `segment` summary object.
 *
 * @param row - Row read from findCampaignDetailById.
 *
 * @returns Campaign body with the two nested summaries.
 *
 * @example
 * const body = mapCampaignDetailToResponse(row)
 * console.log(body.template.name) // Output: 'Black Friday Announcement'
 */
export const mapCampaignDetailToResponse = (row: CampaignDetailRow) => ({
    ...mapCampaignRowToResponse(row),
    template: {
        templateId: row.template_id,
        name: row.template_name,
        subjectTemplate: row.subject_template,
    },
    segment: {
        segmentId: row.segment_id,
        name: row.segment_name,
    },
});

export type { Row };
