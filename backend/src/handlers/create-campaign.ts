import type { APIGatewayProxyResult } from 'aws-lambda';
import type { ApiEvent } from '#http/auth';
import { handleCreateCampaignRequest } from '#controllers/campaign.controller';
import { resolveAuthenticatedUser } from '#http/auth';
import { mapErrorToResponse } from '#http/error-mapping';
import { logRequestSummary } from '#http/request-logging';

/**
 * Lambda entry point wired to POST /v1/campaigns in infra/api.yaml
 * (Handler: create-campaign.handler). A straight sequential pipeline,
 * no middleware framework:
 *
 *   1. auth — resolve the caller identity, or fail with a 401 envelope
 *   2. controller — decode, validate, create the draft
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
 * console.log(response.statusCode) // Output: 201 — never rejects; every
 *                                  // failure arrives as an error envelope
 */
export const handler = async (event: ApiEvent): Promise<APIGatewayProxyResult> => {
    const startedAtMs = Date.now();

    let response: APIGatewayProxyResult;
    try {
        const state = resolveAuthenticatedUser(event);
        response = await handleCreateCampaignRequest(event, state);
    } catch (err) {
        response = mapErrorToResponse(err);
    }

    logRequestSummary(event, response, startedAtMs);
    return response;
};
