import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

import { handler as listAuditLogsHandler } from '#handlers/list-audit-logs';
import { handler as getPreferencesHandler } from '#handlers/get-customer-preferences';
import { handler as updatePreferencesHandler } from '#handlers/update-customer-preferences';

import {
    getCustomerPreference,
    updateCustomerPreference,
} from '#services/preference.service';

import { listAuditLogs } from '#services/audit-log.service';

import { ConflictError, NotFoundError } from '#utils/errors';




jest.mock('#services/preference.service', () => ({
    ...jest.requireActual('#services/preference.service'),
    getCustomerPreference: jest.fn(),
    updateCustomerPreference: jest.fn(),
}));

jest.mock('#services/audit-log.service', () => ({
    ...jest.requireActual('#services/audit-log.service'),
    listAuditLogs: jest.fn(),
}));

const getCustomerPreferenceMock = getCustomerPreference as jest.Mock;
const updateCustomerPreferenceMock = updateCustomerPreference as jest.Mock;
const listAuditLogsMock = listAuditLogs as jest.Mock;

const CUSTOMER_ID = '00000000-0000-4000-8000-000000000006';

const preference = (overrides: Record<string, unknown> = {}) => ({
    customerId: CUSTOMER_ID,
    email: 'khoa.vo@example.com',
    isOptedOut: false,
    reason: null,
    suppressedAt: null,
    ...overrides,
});

const event = (
    method: string,
    path: string,
    options: {
        body?: string;
        pathParameters?: Record<string, string>;
        queryStringParameters?: Record<string, string>;
    } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer =>
    ({
        version: '2.0',
        routeKey: `${method} ${path}`,
        rawPath: path,
        requestContext: {
            http: { method, path },
            authorizer: { jwt: { claims: { sub: 'usr-agent-1' } } },
        },
        pathParameters: options.pathParameters,
        queryStringParameters: options.queryStringParameters,
        body: options.body,
    }) as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

const parse = (res: { statusCode: number; body: string }) =>
    JSON.parse(res.body) as Record<string, any>;

beforeEach(() => {
    getCustomerPreferenceMock.mockReset();
    getCustomerPreferenceMock.mockResolvedValue(preference());

    updateCustomerPreferenceMock.mockReset();
    updateCustomerPreferenceMock.mockResolvedValue(
        preference({ isOptedOut: true, reason: 'manual_opt_out', suppressedAt: '2026-11-18T03:00:00.000Z' }),
    );

    listAuditLogsMock.mockReset();
    listAuditLogsMock.mockResolvedValue({ data: [], nextCursor: null });
});

describe('GET /v1/customers/{id}/preferences (handler composition)', () => {
    test('200: returns the current preference state', async () => {
        const res = await getPreferencesHandler(
            event('GET', '/v1/customers/{id}/preferences', {
                pathParameters: { id: CUSTOMER_ID },
            }),
        );

        expect(res.statusCode).toBe(200);
        expect(getCustomerPreferenceMock).toHaveBeenCalledWith(CUSTOMER_ID);
        expect(parse(res)).toMatchObject({ customerId: CUSTOMER_ID, isOptedOut: false });
    });

    test('400: path id is not a UUID', async () => {
        const res = await getPreferencesHandler(
            event('GET', '/v1/customers/{id}/preferences', {
                pathParameters: { id: 'nope' },
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'id' });
    });

    test('404: customer does not exist', async () => {
        getCustomerPreferenceMock.mockRejectedValue(new NotFoundError('customer', CUSTOMER_ID));

        const res = await getPreferencesHandler(
            event('GET', '/v1/customers/{id}/preferences', {
                pathParameters: { id: CUSTOMER_ID },
            }),
        );

        expect(res.statusCode).toBe(404);
        expect(parse(res).error).toMatchObject({
            code: 'RESOURCE_NOT_FOUND',
            details: { field: 'customerId' },
        });
    });
});

describe('PUT /v1/customers/{id}/preferences (handler composition)', () => {
    test('200: forwards the desired state, reason and caller identity', async () => {
        const res = await updatePreferencesHandler(
            event('PUT', '/v1/customers/{id}/preferences', {
                pathParameters: { id: CUSTOMER_ID },
                body: JSON.stringify({ isOptedOut: true, reason: 'customer_requested' }),
            }),
        );

        expect(res.statusCode).toBe(200);
        expect(updateCustomerPreferenceMock).toHaveBeenCalledWith({
            customerId: CUSTOMER_ID,
            isOptedOut: true,
            reason: 'customer_requested',
            userId: 'usr-agent-1',
        });
        expect(parse(res).reason).toBe('manual_opt_out');
    });

    test('200: opt-in sends no reason', async () => {
        updateCustomerPreferenceMock.mockResolvedValue(preference());

        const res = await updatePreferencesHandler(
            event('PUT', '/v1/customers/{id}/preferences', {
                pathParameters: { id: CUSTOMER_ID },
                body: JSON.stringify({ isOptedOut: false }),
            }),
        );

        expect(res.statusCode).toBe(200);
        expect(updateCustomerPreferenceMock).toHaveBeenCalledWith({
            customerId: CUSTOMER_ID,
            isOptedOut: false,
            reason: undefined,
            userId: 'usr-agent-1',
        });
    });

    test('400: missing isOptedOut', async () => {
        const res = await updatePreferencesHandler(
            event('PUT', '/v1/customers/{id}/preferences', {
                pathParameters: { id: CUSTOMER_ID },
                body: JSON.stringify({ reason: 'manual_opt_out' }),
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'isOptedOut' });
        expect(updateCustomerPreferenceMock).not.toHaveBeenCalled();
    });

    test('400: reason sent with isOptedOut false', async () => {
        const res = await updatePreferencesHandler(
            event('PUT', '/v1/customers/{id}/preferences', {
                pathParameters: { id: CUSTOMER_ID },
                body: JSON.stringify({ isOptedOut: false, reason: 'customer_requested' }),
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'reason' });
        expect(updateCustomerPreferenceMock).not.toHaveBeenCalled();
    });

    test('400: bounce is not an API-writable reason', async () => {
        const res = await updatePreferencesHandler(
            event('PUT', '/v1/customers/{id}/preferences', {
                pathParameters: { id: CUSTOMER_ID },
                body: JSON.stringify({ isOptedOut: true, reason: 'bounce' }),
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'reason' });
    });

    test('409: the address is suppressed by SES feedback', async () => {
        updateCustomerPreferenceMock.mockRejectedValue(
            new ConflictError('Customer cannot be opted in: the address is suppressed as bounce.'),
        );

        const res = await updatePreferencesHandler(
            event('PUT', '/v1/customers/{id}/preferences', {
                pathParameters: { id: CUSTOMER_ID },
                body: JSON.stringify({ isOptedOut: false }),
            }),
        );

        expect(res.statusCode).toBe(409);
        expect(parse(res).error.code).toBe('CONFLICT');
    });
});

describe('GET /v1/audit-logs (handler composition)', () => {
    test('200: forwards the validated filters and returns one page', async () => {
        listAuditLogsMock.mockResolvedValue({
            data: [{ auditLogId: 'e1f2a3b4-5678-40ab-cdef-1234567890ab' }],
            nextCursor: null,
        });

        const res = await listAuditLogsHandler(
            event('GET', '/v1/audit-logs', {
                queryStringParameters: {
                    entityType: 'campaign',
                    entityId: '33333333-3333-4000-8000-000000000009',
                    userId: 'usr-agent-1',
                    limit: '5',
                },
            }),
        );

        expect(res.statusCode).toBe(200);
        expect(listAuditLogsMock).toHaveBeenCalledWith({
            entityType: 'campaign',
            entityId: '33333333-3333-4000-8000-000000000009',
            userId: 'usr-agent-1',
            limit: 5,
        });
        expect(parse(res).data).toHaveLength(1);
    });

    test('200: defaults limit to 20 when the query string is absent', async () => {
        await listAuditLogsHandler(event('GET', '/v1/audit-logs'));

        expect(listAuditLogsMock).toHaveBeenCalledWith({ limit: 20 });
    });

    test('400: unknown entityType', async () => {
        const res = await listAuditLogsHandler(
            event('GET', '/v1/audit-logs', {
                queryStringParameters: { entityType: 'invoice' },
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'entityType' });
        expect(listAuditLogsMock).not.toHaveBeenCalled();
    });

    test('400: entityId is not a UUID', async () => {
        const res = await listAuditLogsHandler(
            event('GET', '/v1/audit-logs', {
                queryStringParameters: { entityId: 'nope' },
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'entityId' });
    });

    test('400: limit above the cap', async () => {
        const res = await listAuditLogsHandler(
            event('GET', '/v1/audit-logs', {
                queryStringParameters: { limit: '101' },
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'limit' });
    });

    test('500: unexpected failure maps to INTERNAL_ERROR', async () => {
        listAuditLogsMock.mockRejectedValue(new Error('connection refused'));

        const res = await listAuditLogsHandler(event('GET', '/v1/audit-logs'));

        expect(res.statusCode).toBe(500);
        expect(parse(res).error).toEqual({
            code: 'INTERNAL_ERROR',
            message: 'Unexpected server error.',
        });
    });
});
