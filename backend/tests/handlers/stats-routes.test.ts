import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

import { handler as getCampaignStatsHandler } from '#handlers/get-campaign-stats';
import { handler as getStatsOverviewHandler } from '#handlers/get-stats-overview';

import { getCampaignStats, getStatsOverview } from '#services/stats.service';

import { NotFoundError } from '#utils/errors';




jest.mock('#services/stats.service', () => ({
    ...jest.requireActual('#services/stats.service'),
    getStatsOverview: jest.fn(),
    getCampaignStats: jest.fn(),
}));

const getStatsOverviewMock = getStatsOverview as jest.Mock;
const getCampaignStatsMock = getCampaignStats as jest.Mock;

const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';

const event = (
    method: string,
    path: string,
    options: {
        pathParameters?: Record<string, string>;
        queryStringParameters?: Record<string, string>;
        authenticated?: boolean;
    } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer =>
    ({
        version: '2.0',
        routeKey: `${method} ${path}`,
        rawPath: path,
        requestContext: {
            http: { method, path },
            authorizer: options.authenticated === false
                ? undefined
                : { jwt: { claims: { sub: 'usr-agent-1' } } },
        },
        pathParameters: options.pathParameters,
        queryStringParameters: options.queryStringParameters,
    }) as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

const parse = (res: { statusCode: number; body: string }) =>
    JSON.parse(res.body) as Record<string, any>;

beforeEach(() => {
    getStatsOverviewMock.mockReset();
    getStatsOverviewMock.mockResolvedValue({ totals: { campaigns: 2, sent: 10 }, recentCampaigns: [] });

    getCampaignStatsMock.mockReset();
    getCampaignStatsMock.mockResolvedValue({ campaignId: CAMPAIGN_ID, statusHistory: [] });
});

describe('GET /v1/stats/overview (handler composition)', () => {
    test('200: defaults the recent-campaign limit to 10', async () => {
        const res = await getStatsOverviewHandler(event('GET', '/v1/stats/overview'));

        expect(res.statusCode).toBe(200);
        expect(getStatsOverviewMock).toHaveBeenCalledWith(10);
        expect(parse(res).totals).toMatchObject({ campaigns: 2, sent: 10 });
    });

    test('200: forwards a coerced limit', async () => {
        const res = await getStatsOverviewHandler(
            event('GET', '/v1/stats/overview', { queryStringParameters: { limit: '25' } }),
        );

        expect(res.statusCode).toBe(200);
        expect(getStatsOverviewMock).toHaveBeenCalledWith(25);
    });

    test('400: limit above the cap', async () => {
        const res = await getStatsOverviewHandler(
            event('GET', '/v1/stats/overview', { queryStringParameters: { limit: '51' } }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'limit' });
        expect(getStatsOverviewMock).not.toHaveBeenCalled();
    });

    test('401: missing authorizer claims never reach the service', async () => {
        const res = await getStatsOverviewHandler(
            event('GET', '/v1/stats/overview', { authenticated: false }),
        );

        expect(res.statusCode).toBe(401);
        expect(getStatsOverviewMock).not.toHaveBeenCalled();
    });

    test('500: unexpected failure is mapped to the error envelope', async () => {
        getStatsOverviewMock.mockRejectedValue(new Error('boom'));

        const res = await getStatsOverviewHandler(event('GET', '/v1/stats/overview'));

        expect(res.statusCode).toBe(500);
        expect(parse(res).error).toBeDefined();
    });
});

describe('GET /v1/campaigns/{id}/stats (handler composition)', () => {
    test('200: returns the campaign statistics', async () => {
        const res = await getCampaignStatsHandler(
            event('GET', '/v1/campaigns/{id}/stats', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(200);
        expect(getCampaignStatsMock).toHaveBeenCalledWith(CAMPAIGN_ID);
        expect(parse(res)).toMatchObject({ campaignId: CAMPAIGN_ID });
    });

    test('400: path id is not a UUID', async () => {
        const res = await getCampaignStatsHandler(
            event('GET', '/v1/campaigns/{id}/stats', { pathParameters: { id: 'nope' } }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'id' });
        expect(getCampaignStatsMock).not.toHaveBeenCalled();
    });

    test('404: campaign does not exist', async () => {
        getCampaignStatsMock.mockRejectedValue(new NotFoundError('campaign', CAMPAIGN_ID));

        const res = await getCampaignStatsHandler(
            event('GET', '/v1/campaigns/{id}/stats', { pathParameters: { id: CAMPAIGN_ID } }),
        );

        expect(res.statusCode).toBe(404);
        expect(parse(res).error).toMatchObject({
            code: 'RESOURCE_NOT_FOUND',
            details: { field: 'campaignId' },
        });
    });

    test('401: missing authorizer claims', async () => {
        const res = await getCampaignStatsHandler(
            event('GET', '/v1/campaigns/{id}/stats', {
                pathParameters: { id: CAMPAIGN_ID },
                authenticated: false,
            }),
        );

        expect(res.statusCode).toBe(401);
    });
});
