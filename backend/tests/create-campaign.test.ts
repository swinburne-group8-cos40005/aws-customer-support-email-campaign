import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../src/handlers/create-campaign';
import { withTransaction } from '../src/shared/db';

jest.mock('../src/shared/db', () => ({
  withTransaction: jest.fn(),
  mustExist: jest.requireActual('../src/shared/db').mustExist,
}));

const withTransactionMock = withTransaction as jest.Mock;

const TEMPLATE_ID = '22222222-2222-4000-8000-000000000001';
const SEGMENT_ID = '11111111-1111-4000-8000-000000000001';
const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';

let tx: { query: jest.Mock };

const event = (overrides: Record<string, unknown> = {}): APIGatewayProxyEvent =>
  ({
    requestContext: { authorizer: { claims: { sub: 'usr-agent-1' } } },
    body: JSON.stringify({ name: 'Black Friday', templateId: TEMPLATE_ID, segmentId: SEGMENT_ID }),
    ...overrides,
  } as unknown as APIGatewayProxyEvent);

const parse = (res: { statusCode: number; body: string }) =>
  JSON.parse(res.body) as Record<string, any>;

const callsMatching = (needle: string): unknown[] => {
  const call = tx.query.mock.calls.find(([text]) => (text as string).includes(needle));
  if (!call) throw new Error(`no query containing "${needle}" was executed`);
  return call[1] as unknown[];
};

beforeEach(() => {
  tx = { query: jest.fn() };
  tx.query.mockImplementation(async (text: string) => {
    if (text.includes('FROM templates')) {
      return { rows: [{ found: 1 }], rowCount: 1 };
    }
    if (text.includes('FROM segments')) {
      return { rows: [{ found: 1 }], rowCount: 1 };
    }
    if (text.startsWith('INSERT INTO campaigns')) {
      return {
        rows: [
          {
            campaign_id: CAMPAIGN_ID,
            name: 'Black Friday',
            template_id: TEMPLATE_ID,
            segment_id: SEGMENT_ID,
            status: 'draft',
            created_by: 'usr-agent-1',
            created_at: '2026-11-11T03:00:00.000Z',
            updated_at: '2026-11-11T03:00:00.000Z',
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  });
  withTransactionMock.mockReset().mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
});

describe('POST /campaigns', () => {
  test('201: creates campaign in draft, returns camelCase body', async () => {
    const res = await handler(event());
    expect(res.statusCode).toBe(201);
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

  test('campaign INSERT hard-codes draft and stores created_by from the token', async () => {
    await handler(event());
    const call = tx.query.mock.calls.find(([text]) =>
      (text as string).startsWith('INSERT INTO campaigns'),
    );
    expect(call?.[0]).toContain("'draft'");
    expect(call?.[1]).toEqual(['Black Friday', TEMPLATE_ID, SEGMENT_ID, 'usr-agent-1']);
  });

  test('audit_logs row rides the same transaction: action=create + before/after diff', async () => {
    await handler(event());
    const values = callsMatching('INSERT INTO audit_logs');
    expect(values[0]).toBe('usr-agent-1');
    expect(values[1]).toBe(CAMPAIGN_ID);
    expect(JSON.parse(values[2] as string)).toEqual({
      before: null,
      after: {
        name: 'Black Friday',
        templateId: TEMPLATE_ID,
        segmentId: SEGMENT_ID,
        status: 'draft',
      },
    });
  });

  test('401: missing Cognito claims', async () => {
    const res = await handler(event({ requestContext: {} }));
    expect(res.statusCode).toBe(401);
    expect(parse(res).error.code).toBe('UNAUTHORIZED');
  });

  test('400: invalid JSON body', async () => {
    const res = await handler(event({ body: '{oops' }));
    expect(res.statusCode).toBe(400);
    expect(parse(res).error.code).toBe('VALIDATION_ERROR');
  });

  test('400: missing name', async () => {
    const res = await handler(event({ body: JSON.stringify({ templateId: TEMPLATE_ID, segmentId: SEGMENT_ID }) }));
    expect(res.statusCode).toBe(400);
    expect(parse(res).error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { field: 'name' },
    });
  });

  test('400: name longer than 150 characters', async () => {
    const res = await handler(event({ body: JSON.stringify({ name: 'x'.repeat(151), templateId: TEMPLATE_ID, segmentId: SEGMENT_ID }) }));
    expect(res.statusCode).toBe(400);
    expect(parse(res).error.details).toMatchObject({ field: 'name' });
  });

  test('400: templateId is not a UUID', async () => {
    const res = await handler(event({ body: JSON.stringify({ name: 'Ok', templateId: 'not-a-uuid', segmentId: SEGMENT_ID }) }));
    expect(res.statusCode).toBe(400);
    expect(parse(res).error.details).toMatchObject({ field: 'templateId' });
  });

  test('400: segmentId is not a UUID', async () => {
    const res = await handler(event({ body: JSON.stringify({ name: 'Ok', templateId: TEMPLATE_ID, segmentId: '' }) }));
    expect(res.statusCode).toBe(400);
    expect(parse(res).error.details).toMatchObject({ field: 'segmentId' });
  });

  test('404: template does not exist', async () => {
    tx.query.mockImplementation(async (text: string) =>
      text.includes('FROM templates')
        ? { rows: [], rowCount: 0 }
        : { rows: [{ found: 1 }], rowCount: 1 },
    );
    const res = await handler(event());
    expect(res.statusCode).toBe(404);
    expect(parse(res).error).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      message: expect.stringContaining('template'),
      details: { field: 'templateId' },
    });
  });

  test('404: segment does not exist', async () => {
    tx.query.mockImplementation(async (text: string) =>
      text.includes('FROM segments')
        ? { rows: [], rowCount: 0 }
        : { rows: [{ found: 1 }], rowCount: 1 },
    );
    const res = await handler(event());
    expect(res.statusCode).toBe(404);
    expect(parse(res).error.details).toMatchObject({ field: 'segmentId' });
  });

  test('500: unexpected database failure maps to INTERNAL_ERROR', async () => {
    withTransactionMock.mockReset().mockRejectedValue(new Error('connection refused'));
    const res = await handler(event());
    expect(res.statusCode).toBe(500);
    expect(parse(res).error.code).toBe('INTERNAL_ERROR');
  });
});
