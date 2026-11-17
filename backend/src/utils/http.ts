import type { APIGatewayProxyResult } from 'aws-lambda';

const buildJsonResponse = (statusCode: number, payload: unknown): APIGatewayProxyResult => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
});

/**
 * Builds a success response in the contract envelope shape —
 * docs/api-contract.md §2.x success bodies.
 *
 * @param statusCode - HTTP status to answer with (e.g. 201).
 * @param data - Body payload, already mapped to contract field names.
 *
 * @returns A complete APIGatewayProxyResult ready to return from Lambda.
 *
 * @example
 * return buildSuccessResponse(201, mapCampaignRowToResponse(row));
 */
export const buildSuccessResponse = (statusCode: number, data: unknown): APIGatewayProxyResult =>
    buildJsonResponse(statusCode, data);

/**
 * Standard error envelope — docs/api-contract.md §1.3.
 * Build the response body only; the error-boundary middleware decides
 * when to use it.
 *
 * @param statusCode - HTTP status to answer with.
 * @param code - Stable machine-readable error code (e.g. VALIDATION_ERROR).
 * @param message - Human-readable explanation.
 * @param details - Optional per-field details, e.g. { field, reason }.
 *
 * @returns A complete APIGatewayProxyResult ready to return from Lambda.
 *
 * @example
 * return buildErrorResponse(400, 'VALIDATION_ERROR', 'name is required.', {
 *     field: 'name',
 *     reason: 'name is required.',
 * });
 */
export const buildErrorResponse = (
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
): APIGatewayProxyResult => {
    const error: Record<string, unknown> = {
        code,
        message,
    };

    if (details) {
        error.details = details;
    }

    return buildJsonResponse(statusCode, { error });
};
