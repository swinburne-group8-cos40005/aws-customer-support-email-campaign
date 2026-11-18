import type {
    CampaignRow,
    UpdateCampaignInput,
} from '#repositories/campaign.repository';

import type { ListCampaignsQuery } from '#schemas/campaign.schema';

import { runInTransaction } from '#db/connection';

import { insertAuditRecord } from '#repositories/audit-log.repository';
import { checkCatalogExists } from '#repositories/catalog.repository';
import {
    cancelCampaignRow,
    countCampaignRows,
    deleteCampaignRow,
    findCampaignDetailById,
    findCampaignRowById,
    findCampaignRowForUpdate,
    insertCampaignRow,
    listCampaignRows,
    mapCampaignDetailToResponse,
    mapCampaignRowToResponse,
    markCampaignRowSending,
    scheduleCampaignRow,
    updateCampaignRow,
} from '#repositories/campaign.repository';

import {
    listEmailLogRows,
    mapEmailLogRowToResponse,
} from '#repositories/email-log.repository';

import {
    ConflictError,
    NotFoundError,
    ValidationError,
} from '#utils/errors';




/** Schedule lead time required by docs/email-state-machine.md §1.2 (draft → scheduled). */
const _MINIMUM_SCHEDULE_LEAD_MS = 5 * 60 * 1000;

/**
 * The audit snapshot recorded before/after every campaign mutation
 * (docs/audit-log-strategy.md §4). Only human-meaningful fields are
 * kept — ids and timestamps the row itself already implies stay out.
 *
 * @param row - Campaign row before or after the mutation.
 *
 * @returns The snapshot stored in audit_logs.changes.
 *
 * @example
 * const snapshot = _toCampaignAuditSnapshot(row)
 * console.log(snapshot.status) // Output: 'draft'
 */
const _toCampaignAuditSnapshot = (row: CampaignRow) => ({
    name: row.name,
    templateId: row.template_id,
    segmentId: row.segment_id,
    status: row.status,
    dispatchMode: row.dispatch_mode,
    scheduledAt: row.scheduled_at,
});

/** What the controller is allowed to hand over — user identity comes from the authenticated state, never from the body. */
export interface CreateCampaignCommand {
    name: string;
    templateId: string;
    segmentId: string;
    userId: string;
}

/** PUT /campaigns/{id} command: the patch plus who is applying it. */
export interface UpdateCampaignCommand extends UpdateCampaignInput {
    campaignId: string;
    userId: string;
}

/** One item of the GET /campaigns response. */
export interface CampaignListItem {
    campaignId: string;
    name: string;
    templateId: string;
    segmentId: string;
    status: string;
    dispatchMode: string;
    scheduledAt: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

/** GET /campaigns envelope — docs/api-contract.md §2.1. */
export interface CampaignListResult {
    data: CampaignListItem[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
    };
}

/**
 * Lists campaigns with the contract's pagination block. Count and page
 * run in parallel: both are independent reads, and the Proxy handles
 * the concurrency (ADR-0005).
 *
 * @param query - Validated status filter plus 1-based page and limit.
 *
 * @returns The page's campaigns and the pagination summary.
 *
 * @example
 * const result = await listCampaigns({ page: 1, limit: 20, status: 'draft' })
 * console.log(result.pagination.totalItems) // Output: 2
 */
export const listCampaigns = async (query: ListCampaignsQuery): Promise<CampaignListResult> => {
    const offset = (query.page - 1) * query.limit;

    const [totalItems, rows] = await Promise.all([
        countCampaignRows(query.status),
        listCampaignRows({
            status: query.status,
            limit: query.limit,
            offset,
        }),
    ]);

    return {
        data: rows.map(mapCampaignRowToResponse),
        pagination: {
            currentPage: query.page,
            totalPages: Math.ceil(totalItems / query.limit),
            totalItems,
        },
    };
};

/**
 * Reads one campaign with its template and segment summary for
 * GET /v1/campaigns/{id}.
 *
 * @param campaignId - Campaign UUID from the path.
 *
 * @returns The detail body in contract field names.
 *
 * @throws NotFoundError When the campaign does not exist.
 *
 * @example
 * const campaign = await getCampaignDetail('33333333-3333-4000-8000-000000000009')
 * console.log(campaign.segment.name) // Output: 'Gold Customers in Hanoi'
 */
export const getCampaignDetail = async (campaignId: string) => {
    const row = await findCampaignDetailById(campaignId);
    if (!row) {
        throw new NotFoundError('campaign', campaignId);
    }

    return mapCampaignDetailToResponse(row);
};

/**
 * Creates a draft campaign (US01, docs/api-contract.md §2.1).
 *
 * Business rules owned here:
 *  - template and segment must exist at write time, inside the same
 *    transaction (a stale reference cannot slip between check and insert);
 *  - the audit row rides the same transaction (FR9,
 *    docs/audit-log-strategy.md §5) — commit together or not at all;
 *  - campaigns are born as 'draft'; transitions belong to the state
 *    machine (docs/email-state-machine.md), not to this endpoint.
 *
 * @param command - Validated body fields plus the caller's identity
 *                  resolved by resolveAuthenticatedUser.
 *
 * @returns The stored campaign row.
 *
 * @throws NotFoundError When the referenced template or segment does
 *         not exist in Aurora; nothing is inserted and no audit row is
 *         written.
 *
 * @example
 * const command = {
 *     name: 'Black Friday',
 *     templateId: '22222222-2222-4000-8000-000000000001',
 *     segmentId: '11111111-1111-4000-8000-000000000001',
 *     userId: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f',
 * }
 * const row = await createDraftCampaign(command)
 * console.log(row.status) // Output: 'draft'
 */
export const createDraftCampaign = async (command: CreateCampaignCommand): Promise<CampaignRow> => {
    return runInTransaction(async (tx) => {
        const templateExists = await checkCatalogExists(tx, 'templates', command.templateId);
        if (!templateExists) {
            throw new NotFoundError('template', command.templateId);
        }

        const segmentExists = await checkCatalogExists(tx, 'segments', command.segmentId);
        if (!segmentExists) {
            throw new NotFoundError('segment', command.segmentId);
        }

        const row = await insertCampaignRow(tx, {
            name: command.name,
            templateId: command.templateId,
            segmentId: command.segmentId,
            createdBy: command.userId,
        });

        await insertAuditRecord(tx, {
            userId: command.userId,
            action: 'create',
            entityType: 'campaign',
            entityId: row.campaign_id,
            changes: {
                before: null,
                after: {
                    name: row.name,
                    templateId: row.template_id,
                    segmentId: row.segment_id,
                    status: row.status,
                },
            },
        });

        return row;
    });
};

/**
 * Updates a draft campaign (docs/api-contract.md §2.1, PUT). Editable
 * only while `status = 'draft'`: a scheduled or sending campaign is
 * locked because recipients may already be receiving it
 * (docs/email-state-machine.md §1.1).
 *
 * New template/segment references are re-checked inside the same
 * transaction, exactly like creation, so a request can never point a
 * campaign at a catalog row that vanished between check and write.
 *
 * @param command - Campaign id, the partial patch, and the caller's identity.
 *
 * @returns The updated campaign row.
 *
 * @throws NotFoundError When the campaign, template or segment does not exist.
 * @throws ConflictError When the campaign is no longer a draft.
 *
 * @example
 * const row = await updateDraftCampaign({
 *     campaignId: '33333333-3333-4000-8000-000000000009',
 *     name: 'November Newsletter',
 *     userId: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f',
 * })
 * console.log(row.name) // Output: 'November Newsletter'
 */
export const updateDraftCampaign = async (command: UpdateCampaignCommand): Promise<CampaignRow> => {
    return runInTransaction(async (tx) => {
        const existing = await findCampaignRowForUpdate(tx, command.campaignId);
        if (!existing) {
            throw new NotFoundError('campaign', command.campaignId);
        }

        if (existing.status !== 'draft') {
            throw new ConflictError(
                `Campaign ${command.campaignId} is '${existing.status}' and can only be updated while it is a draft.`,
                { field: 'status', reason: `status is '${existing.status}', expected 'draft'` },
            );
        }

        if (command.templateId) {
            const templateExists = await checkCatalogExists(tx, 'templates', command.templateId);
            if (!templateExists) {
                throw new NotFoundError('template', command.templateId);
            }
        }

        if (command.segmentId) {
            const segmentExists = await checkCatalogExists(tx, 'segments', command.segmentId);
            if (!segmentExists) {
                throw new NotFoundError('segment', command.segmentId);
            }
        }

        const updated = await updateCampaignRow(tx, command.campaignId, {
            name: command.name,
            templateId: command.templateId,
            segmentId: command.segmentId,
        });

        // The row is locked and was a draft a statement ago, so a null
        // result here is a driver/PG defect — fail loudly.
        if (!updated) {
            throw new Error('campaign UPDATE after row lock produced no row');
        }

        await insertAuditRecord(tx, {
            userId: command.userId,
            action: 'update',
            entityType: 'campaign',
            entityId: command.campaignId,
            changes: {
                before: _toCampaignAuditSnapshot(existing),
                after: _toCampaignAuditSnapshot(updated),
            },
        });

        return updated;
    });
};

/**
 * Deletes a draft campaign (docs/api-contract.md §2.1, DELETE). Only
 * drafts are deletable: anything further along has dispatch history
 * worth keeping, so the service answers 409 instead.
 *
 * @param campaignId - Campaign UUID from the path.
 * @param userId - Caller identity for the `delete` audit row.
 *
 * @throws NotFoundError When the campaign does not exist.
 * @throws ConflictError When the campaign is not a draft.
 *
 * @example
 * await deleteDraftCampaign('33333333-3333-4000-8000-000000000009', '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f')
 * console.log('deleted') // Output: 'deleted' — 204, or a 404/409 envelope
 */
export const deleteDraftCampaign = async (
    campaignId: string,
    userId: string,
): Promise<void> => {
    await runInTransaction(async (tx) => {
        const existing = await findCampaignRowForUpdate(tx, campaignId);
        if (!existing) {
            throw new NotFoundError('campaign', campaignId);
        }

        if (existing.status !== 'draft') {
            throw new ConflictError(
                `Campaign ${campaignId} is '${existing.status}' and can only be deleted while it is a draft.`,
                { field: 'status', reason: `status is '${existing.status}', expected 'draft'` },
            );
        }

        const deleted = await deleteCampaignRow(tx, campaignId);
        if (!deleted) {
            throw new Error('campaign DELETE after row lock deleted no row');
        }

        await insertAuditRecord(tx, {
            userId,
            action: 'delete',
            entityType: 'campaign',
            entityId: campaignId,
            changes: {
                before: _toCampaignAuditSnapshot(existing),
                after: null,
            },
        });
    });
};

/**
 * Moves a draft campaign to `scheduled` (US02). Enforces the state
 * machine's 5-minute lead time so an EventBridge rule always has time
 * to be created before the dispatch moment.
 *
 * @param campaignId - Campaign UUID from the path.
 * @param scheduledAt - Validated ISO 8601 timestamp from the body.
 * @param userId - Caller identity for the `schedule` audit row.
 *
 * @returns The scheduled campaign row.
 *
 * @throws NotFoundError When the campaign does not exist.
 * @throws ConflictError When the campaign is not a draft.
 * @throws ValidationError When scheduledAt is less than 5 minutes ahead.
 *
 * @example
 * const row = await scheduleCampaign('33333333-3333-4000-8000-000000000009', '2026-11-20T03:00:00.000Z', '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f')
 * console.log(row.status) // Output: 'scheduled'
 */
export const scheduleCampaign = async (
    campaignId: string,
    scheduledAt: string,
    userId: string,
): Promise<CampaignRow> => {
    return runInTransaction(async (tx) => {
        const existing = await findCampaignRowForUpdate(tx, campaignId);
        if (!existing) {
            throw new NotFoundError('campaign', campaignId);
        }

        if (existing.status !== 'draft') {
            throw new ConflictError(
                `Campaign ${campaignId} is '${existing.status}' and can only be scheduled while it is a draft.`,
                { field: 'status', reason: `status is '${existing.status}', expected 'draft'` },
            );
        }

        const leadTimeMs = Date.parse(scheduledAt) - Date.now();
        if (leadTimeMs < _MINIMUM_SCHEDULE_LEAD_MS) {
            throw new ValidationError(
                'scheduledAt',
                'scheduledAt must be at least 5 minutes in the future.',
            );
        }

        const updated = await scheduleCampaignRow(tx, campaignId, scheduledAt);
        if (!updated) {
            throw new Error('campaign SCHEDULE after row lock produced no row');
        }

        await insertAuditRecord(tx, {
            userId,
            action: 'schedule',
            entityType: 'campaign',
            entityId: campaignId,
            changes: {
                before: _toCampaignAuditSnapshot(existing),
                after: _toCampaignAuditSnapshot(updated),
            },
        });

        return updated;
    });
};

/**
 * Dispatches a draft campaign immediately (US03): `status = 'sending'`
 * and `dispatchMode = 'immediate'` in one conditional update, with
 * `scheduledAt = NOW()` so every campaign keeps a dispatch timestamp.
 * No EventBridge rule is created — the `scheduled` state is skipped
 * entirely (docs/api-contract.md §2.1, amended by issue #4).
 *
 * The Dispatcher invocation itself belongs to the messaging stack
 * (`csep-dispatcher`, #26/#47); this endpoint owns the state
 * transition and its audit row.
 *
 * @param campaignId - Campaign UUID from the path.
 * @param userId - Caller identity for the `send` audit row.
 *
 * @returns The campaign row now in `sending`.
 *
 * @throws NotFoundError When the campaign does not exist.
 * @throws ConflictError When the campaign is not a draft.
 *
 * @example
 * const row = await sendCampaignImmediately('33333333-3333-4000-8000-000000000009', '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f')
 * console.log(row.status) // Output: 'sending'
 */
export const sendCampaignImmediately = async (
    campaignId: string,
    userId: string,
): Promise<CampaignRow> => {
    return runInTransaction(async (tx) => {
        const existing = await findCampaignRowForUpdate(tx, campaignId);
        if (!existing) {
            throw new NotFoundError('campaign', campaignId);
        }

        if (existing.status !== 'draft') {
            throw new ConflictError(
                `Campaign ${campaignId} is '${existing.status}' and can only be sent while it is a draft.`,
                { field: 'status', reason: `status is '${existing.status}', expected 'draft'` },
            );
        }

        const updated = await markCampaignRowSending(tx, campaignId);
        if (!updated) {
            throw new Error('campaign SEND after row lock produced no row');
        }

        await insertAuditRecord(tx, {
            userId,
            action: 'send',
            entityType: 'campaign',
            entityId: campaignId,
            changes: {
                before: _toCampaignAuditSnapshot(existing),
                after: _toCampaignAuditSnapshot(updated),
            },
        });

        return updated;
    });
};

/**
 * Cancels a scheduled campaign before its execution time (US02). The
 * SQL update re-checks `scheduled_at > NOW()`: if the scheduler has
 * already fired between the lock and the update, nothing is cancelled
 * and the caller gets a 409 instead of a false success.
 *
 * @param campaignId - Campaign UUID from the path.
 * @param userId - Caller identity for the `cancel` audit row.
 *
 * @returns The campaign row now in `cancelled`.
 *
 * @throws NotFoundError When the campaign does not exist.
 * @throws ConflictError When the campaign is not scheduled or is already due.
 *
 * @example
 * const row = await cancelScheduledCampaign('33333333-3333-4000-8000-000000000009', '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f')
 * console.log(row.status) // Output: 'cancelled'
 */
export const cancelScheduledCampaign = async (
    campaignId: string,
    userId: string,
): Promise<CampaignRow> => {
    return runInTransaction(async (tx) => {
        const existing = await findCampaignRowForUpdate(tx, campaignId);
        if (!existing) {
            throw new NotFoundError('campaign', campaignId);
        }

        if (existing.status !== 'scheduled') {
            throw new ConflictError(
                `Campaign ${campaignId} is '${existing.status}' and can only be cancelled while it is scheduled.`,
                { field: 'status', reason: `status is '${existing.status}', expected 'scheduled'` },
            );
        }

        const updated = await cancelCampaignRow(tx, campaignId);
        if (!updated) {
            throw new ConflictError(
                `Campaign ${campaignId} is already due to send and can no longer be cancelled.`,
                { field: 'scheduledAt', reason: 'scheduledAt is not in the future' },
            );
        }

        await insertAuditRecord(tx, {
            userId,
            action: 'cancel',
            entityType: 'campaign',
            entityId: campaignId,
            changes: {
                before: _toCampaignAuditSnapshot(existing),
                after: _toCampaignAuditSnapshot(updated),
            },
        });

        return updated;
    });
};

/**
 * Reads a campaign's dispatch log for US04 (docs/api-contract.md §2.1).
 * The campaign is checked first so a typo'd id answers 404 instead of
 * an empty list that looks like "no emails were sent".
 *
 * @param campaignId - Campaign UUID from the path.
 *
 * @returns The campaign id plus its log entries in contract field names.
 *
 * @throws NotFoundError When the campaign does not exist.
 *
 * @example
 * const result = await listCampaignLogs('33333333-3333-4000-8000-000000000009')
 * console.log(result.logs[0]?.sendStatus) // Output: 'delivered'
 */
export const listCampaignLogs = async (campaignId: string) => {
    const campaign = await findCampaignRowById(campaignId);
    if (!campaign) {
        throw new NotFoundError('campaign', campaignId);
    }

    const rows = await listEmailLogRows(campaignId);

    return {
        campaignId,
        logs: rows.map(mapEmailLogRowToResponse),
    };
};

export { mapCampaignRowToResponse };
