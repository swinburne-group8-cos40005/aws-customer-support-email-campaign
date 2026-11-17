import { runInTransaction } from '../db/connection';
import { insertAuditRecord } from '../repositories/audit-log.repository';
import { checkCatalogExists } from '../repositories/catalog.repository';
import {
    insertCampaignRow,
    mapCampaignRowToResponse,
    type CampaignRow,
} from '../repositories/campaign.repository';
import { NotFoundError } from '../utils/errors';

/** What the controller is allowed to hand over — user identity comes from middleware, never from the body. */
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
