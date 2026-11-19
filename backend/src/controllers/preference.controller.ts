import type { APIGatewayProxyResult } from 'aws-lambda';

import type { ApiEvent, AuthenticatedState } from '#http/auth';

import { updatePreferenceSchema } from '#schemas/preference.schema';

import {
    getCustomerPreference,
    updateCustomerPreference,
} from '#services/preference.service';

import { buildSuccessResponse } from '#utils/http';
import { parseJsonBody, parseUuidPathParameter } from '#utils/validation';




/**
 * GET /v1/customers/{id}/preferences — US05,
 * docs/api-contract.md §2.4.
 *
 * @param event - HTTP API v2 event with the customer id in pathParameters.
 * @param _state - Authenticated state; reads still require a valid token.
 *
 * @returns 200 with the current opt-in/opt-out state.
 *
 * @throws ValidationError When the path id is not a UUID.
 * @throws NotFoundError When the customer does not exist.
 *
 * @example
 * const response = await handleGetCustomerPreferencesRequest(event, state)
 * console.log(JSON.parse(response.body).isOptedOut) // Output: true
 */
export const handleGetCustomerPreferencesRequest = async (
    event: ApiEvent,
    _state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const customerId = parseUuidPathParameter(event.pathParameters?.id, 'id');

    const preference = await getCustomerPreference(customerId);

    return buildSuccessResponse(200, preference);
};

/**
 * PUT /v1/customers/{id}/preferences — US05,
 * docs/api-contract.md §2.4. Opting out upserts an
 * `email_suppressions` row; opting in removes it, unless the row came
 * from a bounce or complaint (then 409).
 *
 * @param event - HTTP API v2 event with the id and the preference body.
 * @param state - Authenticated state supplying the audit user id.
 *
 * @returns 200 with the resulting preference state.
 *
 * @throws ValidationError When the id or body fails validation, including
 *         a `reason` sent with `isOptedOut: false`.
 * @throws NotFoundError When the customer does not exist.
 * @throws ConflictError When opting in to an address suppressed by
 *         SES feedback.
 *
 * @example
 * const response = await handleUpdateCustomerPreferencesRequest(event, state)
 * console.log(JSON.parse(response.body).isOptedOut) // Output: true
 */
export const handleUpdateCustomerPreferencesRequest = async (
    event: ApiEvent,
    state: AuthenticatedState,
): Promise<APIGatewayProxyResult> => {
    const customerId = parseUuidPathParameter(event.pathParameters?.id, 'id');
    const body = parseJsonBody(event.body, updatePreferenceSchema);

    const preference = await updateCustomerPreference({
        customerId,
        isOptedOut: body.isOptedOut,
        reason: body.reason,
        userId: state.userId,
    });

    return buildSuccessResponse(200, preference);
};
