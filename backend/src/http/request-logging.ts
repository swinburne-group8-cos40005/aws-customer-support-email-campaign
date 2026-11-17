import type { APIGatewayProxyResult } from 'aws-lambda';
import type { ApiEvent } from './auth';

/**
 * Logging step of the request pipeline: one line per invocation with
 * method, path, status and duration. Kept minimal on purpose — richer
 * metrics belong to the csep-observability stack (issue #14/#27), not
 * scattered console.log calls in handlers.
 *
 * @param event - HTTP API v2 event that produced the response.
 * @param response - Final response of the pipeline.
 * @param startedAtMs - Date.now() captured before the pipeline ran.
 *
 * @example
 * const startedAtMs = Date.now()
 * const response = await handleCreateCampaignRequest(event, state)
 * logRequestSummary(event, response, startedAtMs)
 * console.log(response.statusCode) // Output: 201 — and one log line:
 *                                  // "POST /v1/campaigns -> 201 (42ms)"
 */
export const logRequestSummary = (
    event: ApiEvent,
    response: APIGatewayProxyResult,
    startedAtMs: number,
): void => {
    const method = event.requestContext.http?.method ?? 'UNKNOWN';
    const path = event.requestContext.http?.path ?? '';
    const durationMs = Date.now() - startedAtMs;

    console.log(`${method} ${path} -> ${response.statusCode} (${durationMs}ms)`);
};
