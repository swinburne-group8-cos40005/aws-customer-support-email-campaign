import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

import { handler as createSegmentHandler } from '#handlers/create-segment';
import { handler as listSegmentsHandler } from '#handlers/list-segments';
import { handler as previewSegmentHandler } from '#handlers/preview-segment';

import {
    createSegment,
    listSegments,
    previewSegment,
} from '#services/segment.service';

import { NotFoundError } from '#utils/errors';




jest.mock('#services/segment.service', () => ({
    ...jest.requireActual('#services/segment.service'),
    listSegments: jest.fn(),
    createSegment: jest.fn(),
    previewSegment: jest.fn(),
}));

const listSegmentsMock = listSegments as jest.Mock;
const createSegmentMock = createSegment as jest.Mock;
const previewSegmentMock = previewSegment as jest.Mock;

const SEGMENT_ID = '11111111-1111-4000-8000-000000000001';

const row = () => ({
    segment_id: SEGMENT_ID,
    name: 'Gold Customers in Hanoi',
    description: 'Loyalty tier gold, city Hanoi',
    rules: { city: 'Hanoi', tier: 'gold' },
    created_at: '2026-10-01T03:00:00.000Z',
});

const event = (
    method: string,
    path: string,
    options: {
        body?: string;
        pathParameters?: Record<string, string>;
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
        body: options.body,
    }) as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

const parse = (res: { statusCode: number; body: string }) =>
    JSON.parse(res.body) as Record<string, any>;

beforeEach(() => {
    listSegmentsMock.mockReset();
    listSegmentsMock.mockResolvedValue({ data: [{ segmentId: SEGMENT_ID }] });

    createSegmentMock.mockReset();
    createSegmentMock.mockResolvedValue(row());

    previewSegmentMock.mockReset();
    previewSegmentMock.mockResolvedValue({
        segmentId: SEGMENT_ID,
        segmentName: 'Gold Customers in Hanoi',
        estimatedRecipients: 8420,
        suppressedExcluded: 142,
        netAudience: 8278,
        calculatedAt: '2026-11-18T03:00:00.000Z',
    });
});

describe('GET /v1/segments (handler composition)', () => {
    test('200: returns the segment list', async () => {
        const res = await listSegmentsHandler(event('GET', '/v1/segments'));

        expect(res.statusCode).toBe(200);
        expect(parse(res).data).toHaveLength(1);
    });

    test('500: unexpected failure maps to INTERNAL_ERROR', async () => {
        listSegmentsMock.mockRejectedValue(new Error('connection refused'));

        const res = await listSegmentsHandler(event('GET', '/v1/segments'));

        expect(res.statusCode).toBe(500);
        expect(parse(res).error).toEqual({
            code: 'INTERNAL_ERROR',
            message: 'Unexpected server error.',
        });
    });
});

describe('POST /v1/segments (handler composition)', () => {
    test('201: validates the rules tree and passes the caller identity', async () => {
        const res = await createSegmentHandler(
            event('POST', '/v1/segments', {
                body: JSON.stringify({
                    name: 'Gold Customers in Hanoi',
                    description: 'Loyalty tier gold, city Hanoi',
                    rules: { city: 'Hanoi', tier: 'gold' },
                }),
            }),
        );

        expect(res.statusCode).toBe(201);
        expect(createSegmentMock).toHaveBeenCalledWith({
            name: 'Gold Customers in Hanoi',
            description: 'Loyalty tier gold, city Hanoi',
            rules: { city: 'Hanoi', tier: 'gold' },
            userId: 'usr-agent-1',
        });
        expect(parse(res).segmentId).toBe(SEGMENT_ID);
    });

    test('201: rules default to an empty object when omitted', async () => {
        await createSegmentHandler(
            event('POST', '/v1/segments', {
                body: JSON.stringify({ name: 'Everyone' }),
            }),
        );

        expect(createSegmentMock).toHaveBeenCalledWith({
            name: 'Everyone',
            rules: {},
            userId: 'usr-agent-1',
        });
    });

    test('400: missing name', async () => {
        const res = await createSegmentHandler(
            event('POST', '/v1/segments', {
                body: JSON.stringify({ rules: {} }),
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'name' });
    });

    test('400: rules is an array, not an object', async () => {
        const res = await createSegmentHandler(
            event('POST', '/v1/segments', {
                body: JSON.stringify({ name: 'Bad rules', rules: ['city', 'Hanoi'] }),
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'rules' });
    });
});

describe('POST /v1/segments/{id}/preview (handler composition)', () => {
    test('200: returns the audience estimate', async () => {
        const res = await previewSegmentHandler(
            event('POST', '/v1/segments/{id}/preview', {
                pathParameters: { id: SEGMENT_ID },
            }),
        );

        expect(res.statusCode).toBe(200);
        expect(previewSegmentMock).toHaveBeenCalledWith(SEGMENT_ID);
        expect(parse(res)).toMatchObject({
            estimatedRecipients: 8420,
            suppressedExcluded: 142,
            netAudience: 8278,
        });
    });

    test('400: path id is not a UUID', async () => {
        const res = await previewSegmentHandler(
            event('POST', '/v1/segments/{id}/preview', {
                pathParameters: { id: 'nope' },
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'id' });
    });

    test('404: segment does not exist', async () => {
        previewSegmentMock.mockRejectedValue(new NotFoundError('segment', SEGMENT_ID));

        const res = await previewSegmentHandler(
            event('POST', '/v1/segments/{id}/preview', {
                pathParameters: { id: SEGMENT_ID },
            }),
        );

        expect(res.statusCode).toBe(404);
        expect(parse(res).error.details).toMatchObject({ field: 'segmentId' });
    });
});
