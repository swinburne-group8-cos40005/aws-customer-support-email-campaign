import type { APIGatewayProxyResult } from 'aws-lambda';
import { ApiError } from '../utils/errors';
import { fail } from '../utils/http';
import type { InnerHandler } from './with-auth';

/**
 * Outermost guard: converts anything thrown inside the handler into the
 * contract's error envelope (docs/api-contract.md §1.3). ApiError (and
 * subclasses) map field-for-field; anything else is a bug — logged with
 * stack for CloudWatch, answered with a generic 500 so internals never
 * leak into the response.
 */
export const withErrorBoundary =
    (inner: InnerHandler): InnerHandler =>
    async (event, context) => {
        try {
            return await inner(event, context);
        } catch (err) {
            if (err instanceof ApiError) {
                return fail(err.statusCode, err.code, err.message, err.details);
            }
            console.error('unhandled error', err);
            return fail(500, 'INTERNAL_ERROR', 'Unexpected server error.');
        }
    };
