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
 * const response = buildSuccessResponse(201, { campaignId: '33333333-3333-4000-8000-000000000009' })
 * console.log(response.statusCode) // Output: 201
 * console.log(response.body)       // Output: '{"campaignId":"33333333-3333-4000-8000-000000000009"}'
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
 * const response = buildErrorResponse(
 *     404,
 *     'RESOURCE_NOT_FOUND',
 *     'template with ID 22222222-... does not exist in Aurora database',
 *     { field: 'templateId', reason: 'UUID does not exist in Aurora database' },
 * )
 * console.log(JSON.parse(response.body).error)
 * // Output: {
 * //   code: 'RESOURCE_NOT_FOUND',
 * //   message: 'template with ID 22222222-... does not exist in Aurora database',
 * //   details: { field: 'templateId', reason: 'UUID does not exist in Aurora database' },
 * // }
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
