import type { APIGatewayProxyResult } from 'aws-lambda';
import type { ApiEvent, AuthenticatedState } from '#http/auth';
import { createCampaignSchema } from '#schemas/campaign.schema';
import { createDraftCampaign, mapCampaignRowToResponse } from '#services/campaign.service';
import { ValidationError } from '#utils/errors';
import { buildSuccessResponse } from '#utils/http';

/**
 * POST /v1/campaigns (US01) — docs/api-contract.md §2.1.
 *
 * Controller duties only: decode the body, validate it against the
 * zod schema, delegate to the service, shape the 201 response.
 * Business rules live in the service; SQL lives in repositories.
 *
 * @param event - HTTP API v2 event (body is raw JSON text).
 * @param state - Authenticated state resolved by resolveAuthenticatedUser.
 *
 * @returns 201 with the created campaign in contract field names.
 *
 * @throws ValidationError When the body is not JSON or fails the §2.1
 *         field rules (code VALIDATION_ERROR, HTTP 400).
 * @throws NotFoundError When the template or segment is missing
 *         (bubbled from the service, HTTP 404).
 *
 * @example
 * const state = { userId: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f' }
 * const response = await handleCreateCampaignRequest(event, state)
 * console.log(response.statusCode) // Output: 201 — or 400/404/500 as
 *                                  // an error envelope per §1.3
 */
export const handleCreateCampaignRequest = async (
    event: ApiEvent,
    state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
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
        userId: state.userId,
    };

    const row = await createDraftCampaign(command);

    // Mapping reuse: the repository owns the snake_case -> camelCase shape
    // (§2.1); the controller must not duplicate it.
    return buildSuccessResponse(201, mapCampaignRowToResponse(row));
};
