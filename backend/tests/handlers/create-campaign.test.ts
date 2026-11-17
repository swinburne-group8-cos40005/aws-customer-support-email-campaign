import { handler } from '../../src/handlers/create-campaign';
import { createDraftCampaign } from '../../src/services/campaign.service';
import { NotFoundError } from '../../src/utils/errors';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

jest.mock('../../src/services/campaign.service', () => ({
    createDraftCampaign: jest.fn(),
    // The controller maps the 201 body through the repository mapper that
    // the service re-exports; keep the real one so the contract shape is
    // asserted end-to-end.
    toCampaignResponse: jest.requireActual('../../src/services/campaign.service')
        .toCampaignResponse,
}));

const createDraftCampaignMock = createDraftCampaign as jest.Mock;

const TEMPLATE_ID = '22222222-2222-4000-8000-000000000001';
const SEGMENT_ID = '11111111-1111-4000-8000-000000000001';
const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';

/**
 * The deployed API is an HTTP API with PayloadFormatVersion 2.0 and a JWT
 * authorizer (infra/api.yaml), so Lambda receives the v2 event: claims sit
 * under requestContext.authorizer.jwt.claims.
 */
const event = (overrides: Record<string, unknown> = {}): APIGatewayProxyEventV2WithJWTAuthorizer =>
    ({
        version: '2.0',
        routeKey: 'POST /v1/campaigns',
        rawPath: '/v1/campaigns',
        requestContext: {
            http: { method: 'POST', path: '/v1/campaigns' },
            authorizer: { jwt: { claims: { sub: 'usr-agent-1' } } },
        },
        body: JSON.stringify({ name: 'Black Friday', templateId: TEMPLATE_ID, segmentId: SEGMENT_ID }),
        ...overrides,
    }) as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

const row = () => ({
    campaign_id: CAMPAIGN_ID,
    name: 'Black Friday',
    template_id: TEMPLATE_ID,
    segment_id: SEGMENT_ID,
    status: 'draft',
    created_by: 'usr-agent-1',
    created_at: '2026-11-11T03:00:00.000Z',
    updated_at: '2026-11-11T03:00:00.000Z',
});

const parse = (res: { statusCode: number; body: string }) =>
    JSON.parse(res.body) as Record<string, any>;

beforeEach(() => {
    createDraftCampaignMock.mockReset().mockResolvedValue(row());
});

describe('POST /v1/campaigns (handler composition)', () => {
    test('201: creates campaign in draft, returns camelCase body', async () => {
        const res = await handler(event());
        expect(res.statusCode).toBe(201);
        expect(createDraftCampaignMock).toHaveBeenCalledWith({
            name: 'Black Friday',
            templateId: TEMPLATE_ID,
            segmentId: SEGMENT_ID,
            userId: 'usr-agent-1',
        });
        expect(parse(res)).toEqual({
            campaignId: CAMPAIGN_ID,
            name: 'Black Friday',
            templateId: TEMPLATE_ID,
            segmentId: SEGMENT_ID,
            status: 'draft',
            createdBy: 'usr-agent-1',
            createdAt: '2026-11-11T03:00:00.000Z',
            updatedAt: '2026-11-11T03:00:00.000Z',
        });
    });

    test('401: missing Cognito claims', async () => {
        const res = await handler(
            event({ requestContext: { http: { method: 'POST', path: '/v1/campaigns' } } }),
        );
        expect(res.statusCode).toBe(401);
        expect(parse(res).error.code).toBe('UNAUTHORIZED');
    });

    test('401: claims without a sub value', async () => {
        const res = await handler(
            event({
                requestContext: {
                    http: { method: 'POST', path: '/v1/campaigns' },
                    authorizer: { jwt: { claims: { sub: 42 } } },
                },
            }),
        );
        expect(res.statusCode).toBe(401);
        expect(parse(res).error.code).toBe('UNAUTHORIZED');
    });

    test('400: invalid JSON body', async () => {
        const res = await handler(event({ body: '{oops' }));
        expect(res.statusCode).toBe(400);
        expect(parse(res).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: { field: 'body' },
        });
    });

    test('400: body is not a JSON object', async () => {
        const res = await handler(event({ body: '[]' }));
        expect(res.statusCode).toBe(400);
        expect(parse(res).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: { field: 'body' },
        });
    });

    test('400: missing name', async () => {
        const res = await handler(
            event({ body: JSON.stringify({ templateId: TEMPLATE_ID, segmentId: SEGMENT_ID }) }),
        );
        expect(res.statusCode).toBe(400);
        expect(parse(res).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: { field: 'name' },
        });
    });

    test('400: name longer than 150 characters', async () => {
        const res = await handler(
            event({
                body: JSON.stringify({
                    name: 'x'.repeat(151),
                    templateId: TEMPLATE_ID,
                    segmentId: SEGMENT_ID,
                }),
            }),
        );
        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'name' });
    });

    test('400: templateId is not a UUID', async () => {
        const res = await handler(
            event({
                body: JSON.stringify({ name: 'Ok', templateId: 'not-a-uuid', segmentId: SEGMENT_ID }),
            }),
        );
        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'templateId' });
    });

    test('400: segmentId is not a UUID', async () => {
        const res = await handler(
            event({
                body: JSON.stringify({ name: 'Ok', templateId: TEMPLATE_ID, segmentId: '' }),
            }),
        );
        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'segmentId' });
    });

    test('404: template does not exist (service raises NotFoundError)', async () => {
        createDraftCampaignMock.mockRejectedValue(new NotFoundError('template', TEMPLATE_ID));

        const res = await handler(event());
        expect(res.statusCode).toBe(404);
        expect(parse(res).error).toMatchObject({
            code: 'RESOURCE_NOT_FOUND',
            message: expect.stringContaining('template'),
            details: { field: 'templateId' },
        });
    });

    test('500: unexpected failure maps to INTERNAL_ERROR without leaking internals', async () => {
        createDraftCampaignMock.mockRejectedValue(new Error('connection refused'));

        const res = await handler(event());
        expect(res.statusCode).toBe(500);
        expect(parse(res).error).toEqual({
            code: 'INTERNAL_ERROR',
            message: 'Unexpected server error.',
        });
    });
});
