import type { APIGatewayProxyResult } from 'aws-lambda';

import type { ApiEvent, AuthenticatedState } from '#http/auth';

import { createSegmentSchema } from '#schemas/segment.schema';

import {
    createSegment,
    listSegments,
    mapSegmentRowToResponse,
    previewSegment,
} from '#services/segment.service';

import { buildSuccessResponse } from '#utils/http';
import { parseJsonBody, parseUuidPathParameter } from '#utils/validation';




/**
 * GET /v1/segments — docs/api-contract.md §2.3.
 *
 * @param _event - HTTP API v2 event; the list has no query parameters.
 * @param _state - Authenticated state; reads still require a valid token.
 *
 * @returns 200 with `{ data }` holding every segment.
 *
 * @example
 * const response = await handleListSegmentsRequest(event, state)
 * console.log(JSON.parse(response.body).data.length) // Output: 3
 */
export const handleListSegmentsRequest = async (
    _event: ApiEvent,
    _state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const result = await listSegments();

    return buildSuccessResponse(200, result);
};

/**
 * POST /v1/segments — docs/api-contract.md §2.3.
 *
 * @param event - HTTP API v2 event carrying the segment body.
 * @param state - Authenticated state supplying the audit user id.
 *
 * @returns 201 with the created segment.
 *
 * @throws ValidationError When name/description/rules fail their rules.
 *
 * @example
 * const response = await handleCreateSegmentRequest(event, state)
 * console.log(response.statusCode) // Output: 201
 */
export const handleCreateSegmentRequest = async (
    event: ApiEvent,
    state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const body = parseJsonBody(event.body, createSegmentSchema);

    const row = await createSegment({
        ...body,
        userId: state.userId,
    });

    return buildSuccessResponse(201, mapSegmentRowToResponse(row));
};

/**
 * POST /v1/segments/{id}/preview — docs/api-contract.md §2.3
 * (requested by Trong Hieu for the scheduling UX). Read-only: no audit
 * row is written because nothing changes.
 *
 * @param event - HTTP API v2 event with the segment id in pathParameters.
 * @param _state - Authenticated state; reads still require a valid token.
 *
 * @returns 200 with estimatedRecipients/suppressedExcluded/netAudience.
 *
 * @throws ValidationError When the path id is not a UUID.
 * @throws NotFoundError When the segment does not exist.
 *
 * @example
 * const response = await handlePreviewSegmentRequest(event, state)
 * console.log(JSON.parse(response.body).netAudience) // Output: 8278
 */
export const handlePreviewSegmentRequest = async (
    event: ApiEvent,
    _state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const segmentId = parseUuidPathParameter(event.pathParameters?.id, 'id');

    const preview = await previewSegment(segmentId);

    return buildSuccessResponse(200, preview);
};
