import type { APIGatewayProxyResult } from 'aws-lambda';

import type { ApiEvent } from '#http/auth';

import { handleGetStatsOverviewRequest } from '#controllers/stats.controller';

import { resolveAuthenticatedUser } from '#http/auth';
import { mapErrorToResponse } from '#http/error-mapping';
import { logRequestSummary } from '#http/request-logging';




/**
 * Lambda entry point wired to GET /v1/stats/overview in infra/api.yaml
 * (Handler: get-stats-overview.handler). Same straight sequential pipeline as every
 * campaign route, no middleware framework:
 *
 *   1. auth — resolve the caller identity, or fail with a 401 envelope
 *   2. controller — decode, validate, delegate to the service
 *   3. error mapping — any throw becomes the contract error envelope
 *   4. logging — one line per request, then answer
 *
 * @param event - HTTP API v2 event forwarded by API Gateway.
 *
 * @returns The handler's response; never rejects (step 3 turns every
 *          failure into the contract error envelope).
 *
 * @example
 * const response = await handler(event)
 * console.log(response.statusCode) // Output: 200 — Returns totals, rates, alerts and the recent campaigns
 */
export const handler = async (event: ApiEvent): Promise<APIGatewayProxyResult> => {
    const startedAtMs = Date.now();

    let response: APIGatewayProxyResult;
    try {
        const state = resolveAuthenticatedUser(event);
        response = await handleGetStatsOverviewRequest(event, state);
    } catch (err) {
        response = mapErrorToResponse(err);
    }

    logRequestSummary(event, response, startedAtMs);
    return response;
};
