import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

import { handler as cancelCampaignHandler } from '#handlers/cancel-campaign';
import { handler as deleteCampaignHandler } from '#handlers/delete-campaign';
import { handler as getCampaignHandler } from '#handlers/get-campaign';
import { handler as listCampaignLogsHandler } from '#handlers/list-campaign-logs';
import { handler as listCampaignsHandler } from '#handlers/list-campaigns';
import { handler as scheduleCampaignHandler } from '#handlers/schedule-campaign';
import { handler as sendCampaignHandler } from '#handlers/send-campaign';
import { handler as updateCampaignHandler } from '#handlers/update-campaign';

import {
    cancelScheduledCampaign,
    deleteDraftCampaign,
    getCampaignDetail,
    listCampaignLogs,
    listCampaigns,
    scheduleCampaign,
    sendCampaignImmediately,
    updateDraftCampaign,
} from '#services/campaign.service';

import { ConflictError, NotFoundError } from '#utils/errors';




jest.mock('#services/campaign.service', () => ({
    ...jest.requireActual('#services/campaign.service'),
    listCampaigns: jest.fn(),
    getCampaignDetail: jest.fn(),
    updateDraftCampaign: jest.fn(),
    deleteDraftCampaign: jest.fn(),
    scheduleCampaign: jest.fn(),
    sendCampaignImmediately: jest.fn(),
    cancelScheduledCampaign: jest.fn(),
    listCampaignLogs: jest.fn(),
}));

const listCampaignsMock = listCampaigns as jest.Mock;
const getCampaignDetailMock = getCampaignDetail as jest.Mock;
const updateDraftCampaignMock = updateDraftCampaign as jest.Mock;
const deleteDraftCampaignMock = deleteDraftCampaign as jest.Mock;
const scheduleCampaignMock = scheduleCampaign as jest.Mock;
const sendCampaignImmediatelyMock = sendCampaignImmediately as jest.Mock;
const cancelScheduledCampaignMock = cancelScheduledCampaign as jest.Mock;
const listCampaignLogsMock = listCampaignLogs as jest.Mock;

const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';
const TEMPLATE_ID = '22222222-2222-4000-8000-000000000001';
const SEGMENT_ID = '11111111-1111-4000-8000-000000000001';
const SCHEDULED_AT = '2026-11-20T03:00:00.000Z';

const row = (overrides: Record<string, unknown> = {}) => ({
    campaign_id: CAMPAIGN_ID,
    name: 'Black Friday',
    template_id: TEMPLATE_ID,
    segment_id: SEGMENT_ID,
    status: 'draft',
    dispatch_mode: 'scheduled',
    scheduled_at: null,
    created_by: 'usr-agent-1',
    created_at: '2026-11-11T03:00:00.000Z',
    updated_at: '2026-11-11T03:00:00.000Z',
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
    listCampaignsMock.mockReset();
    listCampaignsMock.mockResolvedValue({
        data: [],
        pagination: { currentPage: 1, totalPages: 0, totalItems: 0 },
    });

    getCampaignDetailMock.mockReset();
    getCampaignDetailMock.mockResolvedValue({
        campaignId: CAMPAIGN_ID,
        template: { templateId: TEMPLATE_ID, name: 'Black Friday Announcement' },
        segment: { segmentId: SEGMENT_ID, name: 'Gold Customers in Hanoi' },
    });

    updateDraftCampaignMock.mockReset();
    updateDraftCampaignMock.mockResolvedValue(row({ name: 'November Newsletter' }));

    deleteDraftCampaignMock.mockReset();
    deleteDraftCampaignMock.mockResolvedValue(undefined);

    scheduleCampaignMock.mockReset();
    scheduleCampaignMock.mockResolvedValue(row({
        status: 'scheduled',
        scheduled_at: SCHEDULED_AT,
    }));

    sendCampaignImmediatelyMock.mockReset();
    sendCampaignImmediatelyMock.mockResolvedValue(row({
        status: 'sending',
        dispatch_mode: 'immediate',
        scheduled_at: '2026-11-18T03:00:00.000Z',
    }));

    cancelScheduledCampaignMock.mockReset();
    cancelScheduledCampaignMock.mockResolvedValue(row({ status: 'cancelled' }));

    listCampaignLogsMock.mockReset();
    listCampaignLogsMock.mockResolvedValue({ campaignId: CAMPAIGN_ID, logs: [] });
});

describe('GET /v1/campaigns (handler composition)', () => {
    test('200: forwards status/page/limit to the service with defaults applied', async () => {
        const res = await listCampaignsHandler(
            event('GET', '/v1/campaigns', {
                queryStringParameters: { status: 'draft', page: '2', limit: '5' },
            }),
        );

        expect(res.statusCode).toBe(200);
        expect(listCampaignsMock).toHaveBeenCalledWith({
            status: 'draft',
            page: 2,
            limit: 5,
        });
        expect(parse(res).pagination).toEqual({
            currentPage: 1,
            totalPages: 0,
            totalItems: 0,
        });
    });

    test('200: defaults page=1 and limit=20 when the query string is absent', async () => {
        await listCampaignsHandler(event('GET', '/v1/campaigns'));

        expect(listCampaignsMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    test('400: unknown status filter', async () => {
        const res = await listCampaignsHandler(
            event('GET', '/v1/campaigns', { queryStringParameters: { status: 'paused' } }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: { field: 'status' },
        });
    });

    test('400: limit above the contract maximum', async () => {
        const res = await listCampaignsHandler(
            event('GET', '/v1/campaigns', { queryStringParameters: { limit: '101' } }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'limit' });
    });

    test('401: missing Cognito claims', async () => {
        const stripped = {
            ...event('GET', '/v1/campaigns'),
            requestContext: { http: { method: 'GET', path: '/v1/campaigns' } },
        } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

        const res = await listCampaignsHandler(stripped);

        expect(res.statusCode).toBe(401);
        expect(parse(res).error.code).toBe('UNAUTHORIZED');
    });
});

describe('GET /v1/campaigns/{id} (handler composition)', () => {
    test('200: returns the campaign with template and segment summaries', async () => {
        const res = await getCampaignHandler(
            event('GET', '/v1/campaigns/{id}', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(200);
        expect(getCampaignDetailMock).toHaveBeenCalledWith(CAMPAIGN_ID);
        expect(parse(res).template.name).toBe('Black Friday Announcement');
    });

    test('400: path id is not a UUID', async () => {
        const res = await getCampaignHandler(
            event('GET', '/v1/campaigns/{id}', { pathParameters: { id: 'nope' } }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'id' });
    });

    test('404: campaign does not exist', async () => {
        getCampaignDetailMock.mockRejectedValue(new NotFoundError('campaign', CAMPAIGN_ID));

        const res = await getCampaignHandler(
            event('GET', '/v1/campaigns/{id}', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(404);
        expect(parse(res).error).toMatchObject({
            code: 'RESOURCE_NOT_FOUND',
            details: { field: 'campaignId' },
        });
    });
});

describe('PUT /v1/campaigns/{id} (handler composition)', () => {
    test('200: validates the patch and passes the caller identity to the service', async () => {
        const res = await updateCampaignHandler(
            event('PUT', '/v1/campaigns/{id}', {
                pathParameters: { id: CAMPAIGN_ID },
                body: JSON.stringify({ name: 'November Newsletter' }),
            }),
        );

        expect(res.statusCode).toBe(200);
        expect(updateDraftCampaignMock).toHaveBeenCalledWith({
            campaignId: CAMPAIGN_ID,
            name: 'November Newsletter',
            userId: 'usr-agent-1',
        });
        expect(parse(res).name).toBe('November Newsletter');
    });

    test('400: empty patch is rejected instead of writing nothing', async () => {
        const res = await updateCampaignHandler(
            event('PUT', '/v1/campaigns/{id}', {
                pathParameters: { id: CAMPAIGN_ID },
                body: JSON.stringify({}),
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: { field: 'body' },
        });
        expect(updateDraftCampaignMock).not.toHaveBeenCalled();
    });

    test('409: campaign is no longer a draft', async () => {
        updateDraftCampaignMock.mockRejectedValue(
            new ConflictError('Campaign is scheduled and cannot be updated.'),
        );

        const res = await updateCampaignHandler(
            event('PUT', '/v1/campaigns/{id}', {
                pathParameters: { id: CAMPAIGN_ID },
                body: JSON.stringify({ name: 'x' }),
            }),
        );

        expect(res.statusCode).toBe(409);
        expect(parse(res).error.code).toBe('CONFLICT');
    });
});

describe('DELETE /v1/campaigns/{id} (handler composition)', () => {
    test('204: deletes with an empty body', async () => {
        const res = await deleteCampaignHandler(
            event('DELETE', '/v1/campaigns/{id}', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(204);
        expect(res.body).toBe('');
        expect(deleteDraftCampaignMock).toHaveBeenCalledWith(CAMPAIGN_ID, 'usr-agent-1');
    });

    test('409: only drafts are deletable', async () => {
        deleteDraftCampaignMock.mockRejectedValue(
            new ConflictError('Campaign is completed and cannot be deleted.'),
        );

        const res = await deleteCampaignHandler(
            event('DELETE', '/v1/campaigns/{id}', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(409);
        expect(parse(res).error.code).toBe('CONFLICT');
    });
});

describe('POST /v1/campaigns/{id}/schedule (handler composition)', () => {
    test('200: passes the validated timestamp and caller identity', async () => {
        const res = await scheduleCampaignHandler(
            event('POST', '/v1/campaigns/{id}/schedule', {
                pathParameters: { id: CAMPAIGN_ID },
                body: JSON.stringify({ scheduledAt: SCHEDULED_AT }),
            }),
        );

        expect(res.statusCode).toBe(200);
        expect(scheduleCampaignMock).toHaveBeenCalledWith(CAMPAIGN_ID, SCHEDULED_AT, 'usr-agent-1');
        expect(parse(res).status).toBe('scheduled');
    });

    test('400: scheduledAt is not an ISO 8601 timestamp', async () => {
        const res = await scheduleCampaignHandler(
            event('POST', '/v1/campaigns/{id}/schedule', {
                pathParameters: { id: CAMPAIGN_ID },
                body: JSON.stringify({ scheduledAt: 'tomorrow at noon' }),
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'scheduledAt' });
        expect(scheduleCampaignMock).not.toHaveBeenCalled();
    });

    test('409: campaign is not a draft', async () => {
        scheduleCampaignMock.mockRejectedValue(
            new ConflictError('Campaign is cancelled and cannot be scheduled.'),
        );

        const res = await scheduleCampaignHandler(
            event('POST', '/v1/campaigns/{id}/schedule', {
                pathParameters: { id: CAMPAIGN_ID },
                body: JSON.stringify({ scheduledAt: SCHEDULED_AT }),
            }),
        );

        expect(res.statusCode).toBe(409);
    });
});

describe('POST /v1/campaigns/{id}/send (handler composition)', () => {
    test('200: returns the campaign in sending with immediate dispatch mode', async () => {
        const res = await sendCampaignHandler(
            event('POST', '/v1/campaigns/{id}/send', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(200);
        expect(sendCampaignImmediatelyMock).toHaveBeenCalledWith(CAMPAIGN_ID, 'usr-agent-1');
        expect(parse(res)).toMatchObject({ status: 'sending', dispatchMode: 'immediate' });
    });

    test('409: campaign is not a draft', async () => {
        sendCampaignImmediatelyMock.mockRejectedValue(
            new ConflictError('Campaign is sending and cannot be sent again.'),
        );

        const res = await sendCampaignHandler(
            event('POST', '/v1/campaigns/{id}/send', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(409);
    });
});

describe('POST /v1/campaigns/{id}/cancel (handler composition)', () => {
    test('200: returns the cancelled campaign', async () => {
        const res = await cancelCampaignHandler(
            event('POST', '/v1/campaigns/{id}/cancel', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(200);
        expect(cancelScheduledCampaignMock).toHaveBeenCalledWith(CAMPAIGN_ID, 'usr-agent-1');
        expect(parse(res).status).toBe('cancelled');
    });

    test('409: schedule already fired', async () => {
        cancelScheduledCampaignMock.mockRejectedValue(
            new ConflictError('Campaign is already due to send and can no longer be cancelled.'),
        );

        const res = await cancelCampaignHandler(
            event('POST', '/v1/campaigns/{id}/cancel', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(409);
    });
});

describe('GET /v1/campaigns/{id}/logs (handler composition)', () => {
    test('200: returns the campaign id and its log entries', async () => {
        listCampaignLogsMock.mockResolvedValue({
            campaignId: CAMPAIGN_ID,
            logs: [{ emailLogId: 'c4d5e6f7-a8b9-4c1d-8e3f-4a5b6c7d8e9f', sendStatus: 'delivered' }],
        });

        const res = await listCampaignLogsHandler(
            event('GET', '/v1/campaigns/{id}/logs', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(200);
        expect(parse(res).logs[0].sendStatus).toBe('delivered');
    });

    test('404: campaign does not exist', async () => {
        listCampaignLogsMock.mockRejectedValue(new NotFoundError('campaign', CAMPAIGN_ID));

        const res = await listCampaignLogsHandler(
            event('GET', '/v1/campaigns/{id}/logs', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(404);
    });

    test('500: unexpected failure maps to INTERNAL_ERROR', async () => {
        listCampaignLogsMock.mockRejectedValue(new Error('connection refused'));

        const res = await listCampaignLogsHandler(
            event('GET', '/v1/campaigns/{id}/logs', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(500);
        expect(parse(res).error).toEqual({
            code: 'INTERNAL_ERROR',
            message: 'Unexpected server error.',
        });
    });
});
