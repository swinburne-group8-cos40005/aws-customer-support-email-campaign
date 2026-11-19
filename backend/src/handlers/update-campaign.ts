import type { APIGatewayProxyResult } from 'aws-lambda';

import type { ApiEvent } from '#http/auth';

import { handleUpdateCampaignRequest } from '#controllers/campaign.controller';

import { resolveAuthenticatedUser } from '#http/auth';
import { mapErrorToResponse } from '#http/error-mapping';
import { logRequestSummary } from '#http/request-logging';




/**
 * Lambda entry point wired to PUT /v1/campaigns/{id}. in infra/api.yaml
 * (Handler: update-campaign.handler). Same straight sequential pipeline as every
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
 * console.log(response.statusCode) // Output: 200 — Returns the updated draft
 */
export const handler = async (event: ApiEvent): Promise<APIGatewayProxyResult> => {
    const startedAtMs = Date.now();

    let response: APIGatewayProxyResult;
    try {
        const state = resolveAuthenticatedUser(event);
        response = await handleUpdateCampaignRequest(event, state);
    } catch (err) {
        response = mapErrorToResponse(err);
    }

    logRequestSummary(event, response, startedAtMs);
    return response;
};
