import type { APIGatewayProxyResult } from 'aws-lambda';
import type { HandlerFn } from './with-auth';

/**
 * One log line per invocation: method, path and duration. Kept minimal
 * on purpose — richer metrics belong to the csep-observability stack
 * (issue #14/#27), not scattered console.log calls in handlers.
 */
export const withRequestLogging =
    (inner: HandlerFn): HandlerFn =>
    async (event, context) => {
        const started = Date.now();
        const result: APIGatewayProxyResult = await inner(event, context);
        console.log(
            `${event.requestContext.http?.method ?? 'UNKNOWN'} ${
                event.requestContext.http?.path ?? ''
            } -> ${result.statusCode} (${Date.now() - started}ms)`,
        );
        return result;
    };
