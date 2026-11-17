import type { APIGatewayProxyResult } from 'aws-lambda';

const json = (statusCode: number, payload: unknown): APIGatewayProxyResult => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
});

export const ok = (statusCode: number, data: unknown): APIGatewayProxyResult =>
    json(statusCode, data);

/**
 * Standard error envelope — docs/api-contract.md §1.3.
 * Build the response body only; middleware decides when to use it.
 */
export const fail = (
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
): APIGatewayProxyResult =>
    json(statusCode, { error: { code, message, ...(details ? { details } : {}) } });
