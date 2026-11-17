import type { CampaignRow } from '#repositories/campaign.repository';

import { runInTransaction } from '#db/connection';

import { insertAuditRecord } from '#repositories/audit-log.repository';
import { checkCatalogExists } from '#repositories/catalog.repository';
import {
    insertCampaignRow,
    mapCampaignRowToResponse
} from '#repositories/campaign.repository';

import { NotFoundError } from '#utils/errors';




/** What the controller is allowed to hand over — user identity comes from the authenticated state, never from the body. */
export interface CreateCampaignCommand {
    name: string;
    templateId: string;
    segmentId: string;
    userId: string;
}

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

export { mapCampaignRowToResponse };
