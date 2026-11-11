import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiError } from './errors';

const json = (statusCode: number, payload: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

export const ok = (statusCode: number, data: unknown): APIGatewayProxyResult =>
  json(statusCode, data);

/** Standard error envelope — docs/api-contract.md §1.3. */
export const fail = (
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): APIGatewayProxyResult =>
  json(statusCode, { error: { code, message, ...(details ? { details } : {}) } });

export const toErrorResponse = (err: unknown): APIGatewayProxyResult => {
  if (err instanceof ApiError) {
    return fail(err.statusCode, err.code, err.message, err.details);
  }
  console.error('unhandled error', err);
  return fail(500, 'INTERNAL_ERROR', 'Unexpected server error.');
};
