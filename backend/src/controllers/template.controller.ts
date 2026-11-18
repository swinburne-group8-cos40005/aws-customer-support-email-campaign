import type { APIGatewayProxyResult } from 'aws-lambda';

import type { ApiEvent, AuthenticatedState } from '#http/auth';

import { createTemplateSchema, updateTemplateSchema } from '#schemas/template.schema';

import {
    createTemplate,
    deleteTemplate,
    getTemplate,
    listTemplates,
    mapTemplateRowToResponse,
    updateTemplate,
} from '#services/template.service';

import { buildNoContentResponse, buildSuccessResponse } from '#utils/http';
import { parseJsonBody, parseUuidPathParameter } from '#utils/validation';




/**
 * GET /v1/templates — docs/api-contract.md §2.2.
 *
 * @param _event - HTTP API v2 event; the list has no query parameters.
 * @param _state - Authenticated state; reads still require a valid token.
 *
 * @returns 200 with `{ data }` holding every template.
 *
 * @example
 * const response = await handleListTemplatesRequest(event, state)
 * console.log(JSON.parse(response.body).data.length) // Output: 4
 */
export const handleListTemplatesRequest = async (
    _event: ApiEvent,
    _state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const result = await listTemplates();

    return buildSuccessResponse(200, result);
};

/**
 * POST /v1/templates — docs/api-contract.md §2.2.
 *
 * @param event - HTTP API v2 event carrying the template body.
 * @param state - Authenticated state supplying the audit user id.
 *
 * @returns 201 with the created template.
 *
 * @throws ValidationError When name/subjectTemplate fail their rules.
 *
 * @example
 * const response = await handleCreateTemplateRequest(event, state)
 * console.log(response.statusCode) // Output: 201
 */
export const handleCreateTemplateRequest = async (
    event: ApiEvent,
    state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const body = parseJsonBody(event.body, createTemplateSchema);

    const row = await createTemplate({
        ...body,
        userId: state.userId,
    });

    return buildSuccessResponse(201, mapTemplateRowToResponse(row));
};

/**
 * GET /v1/templates/{id} — docs/api-contract.md §2.2.
 *
 * @param event - HTTP API v2 event with the template id in pathParameters.
 * @param _state - Authenticated state; reads still require a valid token.
 *
 * @returns 200 with the template.
 *
 * @throws ValidationError When the path id is not a UUID.
 * @throws NotFoundError When the template does not exist.
 *
 * @example
 * const response = await handleGetTemplateRequest(event, state)
 * console.log(JSON.parse(response.body).subjectTemplate) // Output: 'Black Friday starts now'
 */
export const handleGetTemplateRequest = async (
    event: ApiEvent,
    _state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const templateId = parseUuidPathParameter(event.pathParameters?.id, 'id');

    const template = await getTemplate(templateId);

    return buildSuccessResponse(200, template);
};

/**
 * PUT /v1/templates/{id} — docs/api-contract.md §2.2. Partial update,
 * `update` audit row.
 *
 * @param event - HTTP API v2 event with the id and the partial body.
 * @param state - Authenticated state supplying the audit user id.
 *
 * @returns 200 with the updated template.
 *
 * @throws ValidationError When the id or body fails validation (empty patch included).
 * @throws NotFoundError When the template does not exist.
 *
 * @example
 * const response = await handleUpdateTemplateRequest(event, state)
 * console.log(JSON.parse(response.body).subjectTemplate) // Output: 'Last chance: Black Friday'
 */
export const handleUpdateTemplateRequest = async (
    event: ApiEvent,
    state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const templateId = parseUuidPathParameter(event.pathParameters?.id, 'id');
    const body = parseJsonBody(event.body, updateTemplateSchema);

    const row = await updateTemplate({
        templateId,
        ...body,
        userId: state.userId,
    });

    return buildSuccessResponse(200, mapTemplateRowToResponse(row));
};

/**
 * DELETE /v1/templates/{id} — docs/api-contract.md §2.2. Deletes an
 * unused template; a referenced one answers 409.
 *
 * @param event - HTTP API v2 event with the template id in pathParameters.
 * @param state - Authenticated state supplying the audit user id.
 *
 * @returns 204 with an empty body.
 *
 * @throws ValidationError When the path id is not a UUID.
 * @throws NotFoundError When the template does not exist.
 * @throws ConflictError When a campaign still references the template.
 *
 * @example
 * const response = await handleDeleteTemplateRequest(event, state)
 * console.log(response.statusCode, response.body) // Output: 204 ''
 */
export const handleDeleteTemplateRequest = async (
    event: ApiEvent,
    state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const templateId = parseUuidPathParameter(event.pathParameters?.id, 'id');

    await deleteTemplate(templateId, state.userId);

    return buildNoContentResponse();
};
