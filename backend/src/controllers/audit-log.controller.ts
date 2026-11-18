import type { APIGatewayProxyResult } from 'aws-lambda';

import type { ApiEvent, AuthenticatedState } from '#http/auth';

import { listAuditLogsQuerySchema } from '#schemas/audit-log.schema';

import { listAuditLogs } from '#services/audit-log.service';

import { buildSuccessResponse } from '#utils/http';
import { parseQueryParameters } from '#utils/validation';




/**
 * GET /v1/audit-logs — FR9, docs/api-contract.md §2.5.
 *
 * Read-only: no audit row is written for reading the audit trail.
 *
 * @param event - HTTP API v2 event carrying the optional filters and cursor.
 * @param _state - Authenticated state; reads still require a valid token.
 *
 * @returns 200 with one keyset page and `nextCursor`.
 *
 * @throws ValidationError When a filter, the limit or the cursor is invalid.
 *
 * @example
 * const response = await handleListAuditLogsRequest(event, state)
 * console.log(JSON.parse(response.body).data.length) // Output: 20
 */
export const handleListAuditLogsRequest = async (
    event: ApiEvent,
    _state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const query = parseQueryParameters(event.queryStringParameters, listAuditLogsQuerySchema);

    const page = await listAuditLogs(query);

    return buildSuccessResponse(200, page);
};
