import { APIGatewayProxyEvent } from 'aws-lambda';
import { withTransaction, mustExist, Row } from '../shared/db';
import { ApiError } from '../shared/errors';
import { ok, toErrorResponse } from '../shared/response';
import { cognitoSub } from '../shared/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CreateCampaignBody {
    name?: unknown;
    templateId?: unknown;
    segmentId?: unknown;
}

const validationError = (field: string, reason: string) =>
    new ApiError(400, 'VALIDATION_ERROR', reason, { field, reason });

/**
  * POST /campaigns (US01) — docs/api-contract.md §2.1.
  * Creates the campaign in 'draft'; template and segment existence are checked
  * inside the transaction so the audit row and the campaign commit together.
  */
export const handler = async (event: APIGatewayProxyEvent) => {
    try {
        const sub = cognitoSub(event);
        if (!sub) {
            throw new ApiError(401, 'UNAUTHORIZED', 'A valid Cognito ID token is required.');
        }

        let body: CreateCampaignBody;
        try {
            body = JSON.parse(event.body ?? '') as CreateCampaignBody;
        } catch {
            throw validationError('body', 'Request body is not valid JSON.');
        }

        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) throw validationError('name', 'name is required.');
        if (name.length > 150) throw validationError('name', 'name must be at most 150 characters.');
        if (typeof body.templateId !== 'string' || !UUID_RE.test(body.templateId)) {
            throw validationError('templateId', 'templateId must be a UUID.');
        }
        if (typeof body.segmentId !== 'string' || !UUID_RE.test(body.segmentId)) {
            throw validationError('segmentId', 'segmentId must be a UUID.');
        }

        const campaign: Row = await withTransaction(async (tx) => {
            await mustExist(tx, 'templates', 'template_id', body.templateId as string, 'template');
            await mustExist(tx, 'segments', 'segment_id', body.segmentId as string, 'segment');

            const inserted = await tx.query(
                `INSERT INTO campaigns (name, template_id, segment_id, status, created_by)
                  VALUES ($1, $2, $3, 'draft', $4)
                  RETURNING campaign_id, name, template_id, segment_id, status,
                                      created_by, created_at, updated_at`,
                [name, body.templateId, body.segmentId, sub],
            );
            const row = inserted.rows[0] as Row;

            // FR9: audit log in the same transaction (audit-log-strategy.md §5).
            await tx.query(
                `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
                  VALUES ($1, 'create', 'campaign', $2, $3::jsonb)`,
                [
                    sub,
                    row.campaign_id,
                    JSON.stringify({
                        before: null,
                        after: {
                            name,
                            templateId: body.templateId,
                            segmentId: body.segmentId,
                            status: 'draft',
                        },
                    }),
                ],
            );
            return row;
        });

        return ok(201, {
            campaignId: campaign.campaign_id,
            name: campaign.name,
            templateId: campaign.template_id,
            segmentId: campaign.segment_id,
            status: campaign.status,
            createdBy: campaign.created_by,
            createdAt: campaign.created_at,
            updatedAt: campaign.updated_at,
        });
    } catch (err) {
        return toErrorResponse(err);
    }
};
