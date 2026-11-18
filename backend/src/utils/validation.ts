import { z } from 'zod';

import { ValidationError } from '#utils/errors';




/**
 * Turns the first zod issue into the contract's { field, reason } details
 * shape (docs/api-contract.md §1.3). zod guarantees at least one issue
 * whenever parsing fails, so the non-null assertion is safe.
 *
 * @param error - The ZodError produced by a failed safeParse.
 *
 * @returns A ValidationError ready for the error-mapping step.
 *
 * @example
 * const error = createCampaignSchema.safeParse({}).error
 * console.log(_toValidationError(error).details)
 * // Output: { field: 'name', reason: 'Required' }
 */
const _toValidationError = (error: z.ZodError): ValidationError => {
    const issue = error.issues[0]!;
    const field = issue.path.length > 0
        ? String(issue.path[0])
        : 'body';

    return new ValidationError(field, issue.message);
};

/**
 * Decodes the raw API Gateway body as JSON and validates it against the
 * endpoint's zod schema. Both failures answer the same 400 envelope, so
 * controllers never repeat the try/catch or the issue shaping.
 *
 * @param rawBody - event.body (raw JSON text, or undefined when absent).
 * @param schema - zod schema describing the endpoint's request body.
 *
 * @returns The parsed, validated body.
 *
 * @throws ValidationError When the body is missing, not JSON, or fails
 *         the schema's field rules.
 *
 * @example
 * const body = parseJsonBody(event.body, createCampaignSchema)
 * console.log(body.name) // Output: 'Black Friday' — validated
 */
export const parseJsonBody = <S extends z.ZodTypeAny>(
    rawBody: string | undefined,
    schema: S,
): z.infer<S> => {
    let raw: unknown;
    try {
        raw = JSON.parse(rawBody ?? '');
    } catch {
        throw new ValidationError('body', 'Request body is not valid JSON.');
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
        throw _toValidationError(parsed.error);
    }

    return parsed.data;
};

/**
 * Validates the query string against the endpoint's zod schema. API
 * Gateway delivers every value as a string, so the schemas coerce
 * numeric fields themselves.
 *
 * @param query - event.queryStringParameters (null when the URL has none).
 * @param schema - zod schema describing the endpoint's query parameters.
 *
 * @returns The parsed query, with schema defaults applied.
 *
 * @throws ValidationError When a parameter fails its rule (e.g. page=0).
 *
 * @example
 * const query = parseQueryParameters(event.queryStringParameters, listCampaignsQuerySchema)
 * console.log(query.limit) // Output: 20 — the default when omitted
 */
export const parseQueryParameters = <S extends z.ZodTypeAny>(
    query: Record<string, string | undefined> | null | undefined,
    schema: S,
): z.infer<S> => {
    const parsed = schema.safeParse(query ?? {});
    if (!parsed.success) {
        throw _toValidationError(parsed.error);
    }

    return parsed.data;
};

/**
 * Validates a UUID path parameter before any SQL runs. Missing and
 * malformed ids both answer 400 — a non-UUID can never name a row.
 *
 * @param value - The raw path parameter, e.g. event.pathParameters.id.
 * @param field - Field name reported in the error details.
 *
 * @returns The validated UUID string.
 *
 * @throws ValidationError When the parameter is absent or not a UUID.
 *
 * @example
 * const campaignId = parseUuidPathParameter(event.pathParameters?.id, 'id')
 * console.log(campaignId) // Output: '33333333-3333-4000-8000-000000000009'
 */
export const parseUuidPathParameter = (value: string | undefined, field: string): string => {
    const parsed = z.string().uuid(`${field} must be a UUID.`).safeParse(value);
    if (!parsed.success) {
        const issue = parsed.error.issues[0]!;
        throw new ValidationError(field, issue.message);
    }

    return parsed.data;
};
