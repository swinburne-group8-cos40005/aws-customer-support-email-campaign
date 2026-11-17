import type { APIGatewayProxyResult } from 'aws-lambda';
import { ApiError } from '#utils/errors';
import { buildErrorResponse } from '#utils/http';

/**
 * Error-mapping step of the request pipeline: converts anything the
 * controller threw into the contract's error envelope
 * (docs/api-contract.md §1.3). ApiError (and subclasses) map
 * field-for-field; anything else is a bug — logged with stack for
 * CloudWatch, answered with a generic 500 so internals never leak.
 * Never throws, so the handler can log and answer unconditionally.
 *
 * @param err - Whatever the pipeline steps threw.
 *
 * @returns A complete error response per the contract envelope.
 *
 * @example
 * const response = mapErrorToResponse(new NotFoundError('template', TEMPLATE_ID))
 * console.log(response.statusCode) // Output: 404
 * console.log(JSON.parse(response.body).error.code) // Output: 'RESOURCE_NOT_FOUND'
 */
export const mapErrorToResponse = (err: unknown): APIGatewayProxyResult => {
    if (err instanceof ApiError) {
        return buildErrorResponse(err.statusCode, err.code, err.message, err.details);
    }

    console.error('unhandled error', err);
    return buildErrorResponse(500, 'INTERNAL_ERROR', 'Unexpected server error.');
};
