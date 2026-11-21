import type { APIGatewayProxyResult } from 'aws-lambda';

import type { ApiEvent, AuthenticatedState } from '#http/auth';

import { statsOverviewQuerySchema } from '#schemas/stats.schema';

import { getCampaignStats, getStatsOverview } from '#services/stats.service';

import { buildSuccessResponse } from '#utils/http';
import { parseQueryParameters, parseUuidPathParameter } from '#utils/validation';




/**
 * GET /v1/stats/overview (US04, US05) — docs/api-contract.md §2.6.
 *
 * Read-only: no audit row is written. Controller duties only: validate
 * the `limit` query, delegate to the service, shape the 200 response.
 *
 * @param event - HTTP API v2 event carrying the optional `limit` query.
 * @param _state - Authenticated state; reads still require a valid token.
 *
 * @returns 200 with totals, rates, alerts, status breakdown and recent campaigns.
 *
 * @throws ValidationError When `limit` is not an integer between 1 and 50.
 *
 * @example
 * const response = await handleGetStatsOverviewRequest(event, state)
 * console.log(JSON.parse(response.body).totals.sent) // Output: 48210
 */
export const handleGetStatsOverviewRequest = async (
    event: ApiEvent,
    _state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const query = parseQueryParameters(event.queryStringParameters, statsOverviewQuerySchema);

    const overview = await getStatsOverview(query.limit);

    return buildSuccessResponse(200, overview);
};

/**
 * GET /v1/campaigns/{id}/stats (US04, US05) — docs/api-contract.md §2.6.
 *
 * @param event - HTTP API v2 event with the campaign id in pathParameters.
 * @param _state - Authenticated state; reads still require a valid token.
 *
 * @returns 200 with counters, rates, alerts, thresholds and status history.
 *
 * @throws ValidationError When the path id is not a UUID.
 * @throws NotFoundError When the campaign does not exist.
 *
 * @example
 * const response = await handleGetCampaignStatsRequest(event, state)
 * console.log(JSON.parse(response.body).statusHistory.length) // Output: 3
 */
export const handleGetCampaignStatsRequest = async (
    event: ApiEvent,
    _state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const campaignId = parseUuidPathParameter(event.pathParameters?.id, 'id');

    const stats = await getCampaignStats(campaignId);

    return buildSuccessResponse(200, stats);
};
