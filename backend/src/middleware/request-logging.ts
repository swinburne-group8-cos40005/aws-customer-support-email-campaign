import type { Middleware } from './auth';

/**
 * One log line per invocation: method, path, status and duration. Kept
 * minimal on purpose — richer metrics belong to the csep-observability
 * stack (issue #14/#27), not scattered console.log calls in handlers.
 *
 * @example
 * const middleware: Middleware[] = [logRequestSummary, catchHandlerErrors]
 * const handler = composeMiddleware(middleware, controller)
 * const response = await handler(event)
 * console.log(response.statusCode) // Output: 201 — and one log line:
 *                                  // "POST /v1/campaigns -> 201 (42ms)"
 */
export const logRequestSummary: Middleware = async (event, state, next) => {
    const started = Date.now();
    const result = await next();

    const method = event.requestContext.http?.method ?? 'UNKNOWN';
    const path = event.requestContext.http?.path ?? '';
    const durationMs = Date.now() - started;

    console.log(`${method} ${path} -> ${result.statusCode} (${durationMs}ms)`);

    return result;
};
