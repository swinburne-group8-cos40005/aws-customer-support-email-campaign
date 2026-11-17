import { createCampaignSchema } from '../schemas/campaign.schema';
import { createDraftCampaign } from '../services/campaign.service';
import { ValidationError } from '../utils/errors';
import { ok } from '../utils/http';
import type { InnerHandler } from '../middleware';

/**
 * POST /v1/campaigns (US01) — docs/api-contract.md §2.1.
 *
 * Controller duties only: decode the body, validate it against the
 * zod schema, delegate to the service, shape the 201 response.
 * Business rules live in the service; SQL lives in repositories.
 */
export const createCampaignController: InnerHandler = async (event, context) => {
    let raw: unknown;
    try {
        raw = JSON.parse(event.body ?? '');
    } catch {
        throw new ValidationError('body', 'Request body is not valid JSON.');
    }

    const parsed = createCampaignSchema.safeParse(raw);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        // Schema is a flat object, so the path is always [field]; the
        // guard keeps the mapping honest if the schema ever nests.
        if (!issue) {
            throw new ValidationError('body', 'Invalid request body.');
        }
        const field = issue.path.length > 0 ? String(issue.path[0]) : 'body';
        throw new ValidationError(field, issue.message);
    }

    const row = await createDraftCampaign({ ...parsed.data, userId: context.userId });
    return ok(201, {
        campaignId: row.campaign_id,
        name: row.name,
        templateId: row.template_id,
        segmentId: row.segment_id,
        status: row.status,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
};
