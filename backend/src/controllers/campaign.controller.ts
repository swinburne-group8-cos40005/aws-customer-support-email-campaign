import type { APIGatewayProxyResult } from 'aws-lambda';

import type { ApiEvent, AuthenticatedState } from '#http/auth';

import {
    createCampaignSchema,
    listCampaignsQuerySchema,
    scheduleCampaignSchema,
    updateCampaignSchema,
} from '#schemas/campaign.schema';

import {
    cancelScheduledCampaign,
    createDraftCampaign,
    deleteDraftCampaign,
    getCampaignDetail,
    listCampaignLogs,
    listCampaigns,
    mapCampaignRowToResponse,
    scheduleCampaign,
    sendCampaignImmediately,
    updateDraftCampaign,
} from '#services/campaign.service';

import { buildNoContentResponse, buildSuccessResponse } from '#utils/http';
import {
    parseJsonBody,
    parseQueryParameters,
    parseUuidPathParameter,
} from '#utils/validation';




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
    const body = parseJsonBody(event.body, createCampaignSchema);

    const row = await createDraftCampaign({
        ...body,
        userId: state.userId,
    });

    // Mapping reuse: the repository owns the snake_case -> camelCase shape
    // (§2.1); the controller must not duplicate it.
    return buildSuccessResponse(201, mapCampaignRowToResponse(row));
};

/**
 * GET /v1/campaigns (US01, US04) — docs/api-contract.md §2.1.
 *
 * @param event - HTTP API v2 event carrying the optional status/page/limit query.
 * @param _state - Authenticated state; reads still require a valid token.
 *
 * @returns 200 with the page of campaigns and the pagination block.
 *
 * @throws ValidationError When status/page/limit fail their rules.
 *
 * @example
 * const response = await handleListCampaignsRequest(event, state)
 * console.log(response.statusCode) // Output: 200
 */
export const handleListCampaignsRequest = async (
    event: ApiEvent,
    _state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const query = parseQueryParameters(event.queryStringParameters, listCampaignsQuerySchema);

    const result = await listCampaigns(query);

    return buildSuccessResponse(200, result);
};

/**
 * GET /v1/campaigns/{id} — docs/api-contract.md §2.1.
 *
 * @param event - HTTP API v2 event with the campaign id in pathParameters.
 * @param _state - Authenticated state; reads still require a valid token.
 *
 * @returns 200 with the campaign plus template and segment summaries.
 *
 * @throws ValidationError When the path id is not a UUID.
 * @throws NotFoundError When the campaign does not exist.
 *
 * @example
 * const response = await handleGetCampaignRequest(event, state)
 * console.log(JSON.parse(response.body).template.name)
 * // Output: 'Black Friday Announcement'
 */
export const handleGetCampaignRequest = async (
    event: ApiEvent,
    _state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const campaignId = parseUuidPathParameter(event.pathParameters?.id, 'id');

    const campaign = await getCampaignDetail(campaignId);

    return buildSuccessResponse(200, campaign);
};

/**
 * PUT /v1/campaigns/{id} — docs/api-contract.md §2.1. Draft-only;
 * every other state answers 409 (docs/email-state-machine.md).
 *
 * @param event - HTTP API v2 event with the id and the partial body.
 * @param state - Authenticated state supplying the audit user id.
 *
 * @returns 200 with the updated campaign.
 *
 * @throws ValidationError When the id or body fails validation (empty patch included).
 * @throws NotFoundError When the campaign, template or segment does not exist.
 * @throws ConflictError When the campaign is no longer a draft.
 *
 * @example
 * const response = await handleUpdateCampaignRequest(event, state)
 * console.log(JSON.parse(response.body).status) // Output: 'draft'
 */
export const handleUpdateCampaignRequest = async (
    event: ApiEvent,
    state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const campaignId = parseUuidPathParameter(event.pathParameters?.id, 'id');
    const body = parseJsonBody(event.body, updateCampaignSchema);

    const row = await updateDraftCampaign({
        campaignId,
        ...body,
        userId: state.userId,
    });

    return buildSuccessResponse(200, mapCampaignRowToResponse(row));
};

/**
 * DELETE /v1/campaigns/{id} — docs/api-contract.md §2.1. Draft-only,
 * 204 with no body on success.
 *
 * @param event - HTTP API v2 event with the campaign id in pathParameters.
 * @param state - Authenticated state supplying the audit user id.
 *
 * @returns 204 with an empty body.
 *
 * @throws ValidationError When the path id is not a UUID.
 * @throws NotFoundError When the campaign does not exist.
 * @throws ConflictError When the campaign is not a draft.
 *
 * @example
 * const response = await handleDeleteCampaignRequest(event, state)
 * console.log(response.statusCode, response.body) // Output: 204 ''
 */
export const handleDeleteCampaignRequest = async (
    event: ApiEvent,
    state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const campaignId = parseUuidPathParameter(event.pathParameters?.id, 'id');

    await deleteDraftCampaign(campaignId, state.userId);

    return buildNoContentResponse();
};

/**
 * POST /v1/campaigns/{id}/schedule (US02) —
 * docs/api-contract.md §2.1. The 5-minute lead time is enforced by the
 * service, next to the state-machine rules it belongs to.
 *
 * @param event - HTTP API v2 event with the id and scheduledAt body.
 * @param state - Authenticated state supplying the audit user id.
 *
 * @returns 200 with the campaign now in `scheduled`.
 *
 * @throws ValidationError When the id, body or lead time is invalid.
 * @throws NotFoundError When the campaign does not exist.
 * @throws ConflictError When the campaign is not a draft.
 *
 * @example
 * const response = await handleScheduleCampaignRequest(event, state)
 * console.log(JSON.parse(response.body).status) // Output: 'scheduled'
 */
export const handleScheduleCampaignRequest = async (
    event: ApiEvent,
    state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const campaignId = parseUuidPathParameter(event.pathParameters?.id, 'id');
    const body = parseJsonBody(event.body, scheduleCampaignSchema);

    const row = await scheduleCampaign(campaignId, body.scheduledAt, state.userId);

    return buildSuccessResponse(200, mapCampaignRowToResponse(row));
};

/**
 * POST /v1/campaigns/{id}/send (US03) — docs/api-contract.md §2.1.
 * Immediate dispatch from draft: no `scheduled` state, no EventBridge
 * rule (issue #4 amendment).
 *
 * @param event - HTTP API v2 event with the campaign id in pathParameters.
 * @param state - Authenticated state supplying the audit user id.
 *
 * @returns 200 with the campaign now in `sending`, dispatchMode `immediate`.
 *
 * @throws ValidationError When the path id is not a UUID.
 * @throws NotFoundError When the campaign does not exist.
 * @throws ConflictError When the campaign is not a draft.
 *
 * @example
 * const response = await handleSendCampaignRequest(event, state)
 * console.log(JSON.parse(response.body).dispatchMode) // Output: 'immediate'
 */
export const handleSendCampaignRequest = async (
    event: ApiEvent,
    state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const campaignId = parseUuidPathParameter(event.pathParameters?.id, 'id');

    const row = await sendCampaignImmediately(campaignId, state.userId);

    return buildSuccessResponse(200, mapCampaignRowToResponse(row));
};

/**
 * POST /v1/campaigns/{id}/cancel (US02) — docs/api-contract.md §2.1.
 * Cancellable only while `scheduled` and before the execution time.
 *
 * @param event - HTTP API v2 event with the campaign id in pathParameters.
 * @param state - Authenticated state supplying the audit user id.
 *
 * @returns 200 with the campaign now in `cancelled`.
 *
 * @throws ValidationError When the path id is not a UUID.
 * @throws NotFoundError When the campaign does not exist.
 * @throws ConflictError When the campaign is not scheduled or already due.
 *
 * @example
 * const response = await handleCancelCampaignRequest(event, state)
 * console.log(JSON.parse(response.body).status) // Output: 'cancelled'
 */
export const handleCancelCampaignRequest = async (
    event: ApiEvent,
    state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const campaignId = parseUuidPathParameter(event.pathParameters?.id, 'id');

    const row = await cancelScheduledCampaign(campaignId, state.userId);

    return buildSuccessResponse(200, mapCampaignRowToResponse(row));
};

/**
 * GET /v1/campaigns/{id}/logs (US04) — docs/api-contract.md §2.1.
 *
 * @param event - HTTP API v2 event with the campaign id in pathParameters.
 * @param _state - Authenticated state; reads still require a valid token.
 *
 * @returns 200 with `{ campaignId, logs }` per the contract example.
 *
 * @throws ValidationError When the path id is not a UUID.
 * @throws NotFoundError When the campaign does not exist.
 *
 * @example
 * const response = await handleListCampaignLogsRequest(event, state)
 * console.log(JSON.parse(response.body).logs.length) // Output: 2
 */
export const handleListCampaignLogsRequest = async (
    event: ApiEvent,
    _state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const campaignId = parseUuidPathParameter(event.pathParameters?.id, 'id');

    const result = await listCampaignLogs(campaignId);

    return buildSuccessResponse(200, result);
};
