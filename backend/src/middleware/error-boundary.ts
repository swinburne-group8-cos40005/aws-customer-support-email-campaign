import type { APIGatewayProxyResult } from 'aws-lambda';
import { ApiError } from '../utils/errors';
import { buildErrorResponse } from '../utils/http';
import type { HandlerFn } from './auth';

/**
 * Outermost guard: converts anything thrown inside the handler into the
 * contract's error envelope (docs/api-contract.md §1.3). ApiError (and
 * subclasses) map field-for-field; anything else is a bug — logged with
 * stack for CloudWatch, answered with a generic 500 so internals never
 * leak into the response.
 */
export const catchHandlerErrors =
    (inner: HandlerFn): HandlerFn =>
    async (event, context) => {
        try {
            return await inner(event, context);
        } catch (err) {
            if (err instanceof ApiError) {
                return buildErrorResponse(err.statusCode, err.code, err.message, err.details);
            }
            console.error('unhandled error', err);
            return buildErrorResponse(500, 'INTERNAL_ERROR', 'Unexpected server error.');
        }
    };
