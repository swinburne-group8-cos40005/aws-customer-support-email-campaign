import { ApiError } from '../utils/errors';
import { buildErrorResponse } from '../utils/http';
import type { Middleware } from './auth';

/**
 * Outermost guard of the middleware chain: converts anything thrown
 * inside the chain into the contract's error envelope
 * (docs/api-contract.md §1.3). ApiError (and subclasses) map
 * field-for-field; anything else is a bug — logged with stack for
 * CloudWatch, answered with a generic 500 so internals never leak.
 *
 * @example
 * const middleware: Middleware[] = [
 *     logRequestSummary,
 *     catchHandlerErrors,
 *     requireCognitoIdentity,
 * ]
 * const handler = composeMiddleware(middleware, controller)
 * const response = await handler(event)
 * console.log(response.statusCode) // Output: 500 with an INTERNAL_ERROR
 *                                  // envelope when a non-ApiError escapes
 */
export const catchHandlerErrors: Middleware = async (event, state, next) => {
    try {
        return await next();
    } catch (err) {
        if (err instanceof ApiError) {
            return buildErrorResponse(err.statusCode, err.code, err.message, err.details);
        }

        console.error('unhandled error', err);
        return buildErrorResponse(500, 'INTERNAL_ERROR', 'Unexpected server error.');
    }
};
