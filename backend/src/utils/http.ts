import type { APIGatewayProxyResult } from 'aws-lambda';

const buildJsonResponse = (statusCode: number, payload: unknown): APIGatewayProxyResult => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
});

export const buildSuccessResponse = (statusCode: number, data: unknown): APIGatewayProxyResult =>
    buildJsonResponse(statusCode, data);

/**
 * Standard error envelope — docs/api-contract.md §1.3.
 * Build the response body only; middleware decides when to use it.
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
