import { createCampaignSchema } from '../schemas/campaign.schema';
import { createDraftCampaign, mapCampaignRowToResponse } from '../services/campaign.service';
import { ValidationError } from '../utils/errors';
import { buildSuccessResponse } from '../utils/http';
import type { InnerHandler } from '../middleware';

/**
 * POST /v1/campaigns (US01) — docs/api-contract.md §2.1.
 *
 * Controller duties only: decode the body, validate it against the
 * zod schema, delegate to the service, shape the 201 response.
 * Business rules live in the service; SQL lives in repositories.
 *
 * @param event - HTTP API v2 event (body is raw JSON text).
 * @param context - Request context resolved by the auth middleware.
 *
 * @returns 201 with the created campaign in contract field names.
 *
 * @throws ValidationError When the body is not JSON or fails the §2.1
 *         field rules (code VALIDATION_ERROR, HTTP 400).
 * @throws NotFoundError When the template or segment is missing
 *         (bubbled from the service, HTTP 404).
 *
 * @example
 * // wired in src/handlers/create-campaign.ts:
 * export const handler = composeMiddleware(handleCreateCampaignRequest);
 */
export const handleCreateCampaignRequest: InnerHandler = async (event, context) => {
    let raw: unknown;
    try {
        raw = JSON.parse(event.body ?? '');
    } catch {
        throw new ValidationError('body', 'Request body is not valid JSON.');
    }

    const parsed = createCampaignSchema.safeParse(raw);
    if (!parsed.success) {
        // zod guarantees at least one issue whenever parsing fails.
        const issue = parsed.error.issues[0]!;
        const field = issue.path.length > 0
            ? String(issue.path[0])
            : 'body';
        throw new ValidationError(field, issue.message);
    }

    const command = {
        ...parsed.data,
        userId: context.userId,
    };

    const row = await createDraftCampaign(command);

    // Mapping reuse: the repository owns the snake_case -> camelCase shape
    // (§2.1); the controller must not duplicate it.
    return buildSuccessResponse(201, mapCampaignRowToResponse(row));
};
