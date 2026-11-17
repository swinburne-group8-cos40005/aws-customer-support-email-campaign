import type { APIGatewayProxyResult } from 'aws-lambda';
import type { HandlerFn } from './auth';

/**
 * One log line per invocation: method, path, status and duration. Kept
 * minimal on purpose — richer metrics belong to the csep-observability
 * stack (issue #14/#27), not scattered console.log calls in handlers.
 *
 * @param inner - Handler to wrap; its result is returned unchanged.
 *
 * @returns A chain handler that logs then delegates.
 *
 * @example
 * const logged = logRequestSummary(inner)
 * const result = await logged(event)
 * console.log(result.statusCode) // Output: 201 — and one log line:
 *                                // "POST /v1/campaigns -> 201 (42ms)"
 */
export const logRequestSummary = (inner: HandlerFn): HandlerFn => {
    return async (event, context) => {
        const started = Date.now();
        const result: APIGatewayProxyResult = await inner(event, context);

        const method = event.requestContext.http?.method ?? 'UNKNOWN';
        const path = event.requestContext.http?.path ?? '';
        const durationMs = Date.now() - started;

        console.log(`${method} ${path} -> ${result.statusCode} (${durationMs}ms)`);

        return result;
    };
};
