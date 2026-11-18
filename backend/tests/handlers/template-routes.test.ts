import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

import { handler as createTemplateHandler } from '#handlers/create-template';
import { handler as deleteTemplateHandler } from '#handlers/delete-template';
import { handler as getTemplateHandler } from '#handlers/get-template';
import { handler as listTemplatesHandler } from '#handlers/list-templates';
import { handler as updateTemplateHandler } from '#handlers/update-template';

import {
    createTemplate,
    deleteTemplate,
    getTemplate,
    listTemplates,
    updateTemplate,
} from '#services/template.service';

import { ConflictError, NotFoundError } from '#utils/errors';




jest.mock('#services/template.service', () => ({
    ...jest.requireActual('#services/template.service'),
    listTemplates: jest.fn(),
    getTemplate: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
}));

const listTemplatesMock = listTemplates as jest.Mock;
const getTemplateMock = getTemplate as jest.Mock;
const createTemplateMock = createTemplate as jest.Mock;
const updateTemplateMock = updateTemplate as jest.Mock;
const deleteTemplateMock = deleteTemplate as jest.Mock;

const TEMPLATE_ID = '22222222-2222-4000-8000-000000000001';

const row = (overrides: Record<string, unknown> = {}) => ({
    template_id: TEMPLATE_ID,
    name: 'Black Friday Announcement',
    subject_template: 'Black Friday starts now',
    body_text: 'Hello {{firstName}}',
    body_html: '<p>Hello {{firstName}}</p>',
    created_at: '2026-11-01T03:00:00.000Z',
    updated_at: '2026-11-01T03:00:00.000Z',
    ...overrides,
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
    listTemplatesMock.mockReset();
    listTemplatesMock.mockResolvedValue({ data: [{ templateId: TEMPLATE_ID }] });

    getTemplateMock.mockReset();
    getTemplateMock.mockResolvedValue({ templateId: TEMPLATE_ID, subjectTemplate: 'Black Friday starts now' });

    createTemplateMock.mockReset();
    createTemplateMock.mockResolvedValue(row());

    updateTemplateMock.mockReset();
    updateTemplateMock.mockResolvedValue(row({ subject_template: 'Last chance' }));

    deleteTemplateMock.mockReset();
    deleteTemplateMock.mockResolvedValue(undefined);
});

describe('GET /v1/templates (handler composition)', () => {
    test('200: returns the template list', async () => {
        const res = await listTemplatesHandler(event('GET', '/v1/templates'));

        expect(res.statusCode).toBe(200);
        expect(parse(res).data).toHaveLength(1);
    });

    test('500: unexpected failure maps to INTERNAL_ERROR', async () => {
        listTemplatesMock.mockRejectedValue(new Error('connection refused'));

        const res = await listTemplatesHandler(event('GET', '/v1/templates'));

        expect(res.statusCode).toBe(500);
        expect(parse(res).error).toEqual({
            code: 'INTERNAL_ERROR',
            message: 'Unexpected server error.',
        });
    });
});

describe('POST /v1/templates (handler composition)', () => {
    test('201: validates the body and passes the caller identity', async () => {
        const res = await createTemplateHandler(
            event('POST', '/v1/templates', {
                body: JSON.stringify({
                    name: 'Black Friday Announcement',
                    subjectTemplate: 'Black Friday starts now',
                    bodyHtml: '<p>Hello</p>',
                }),
            }),
        );

        expect(res.statusCode).toBe(201);
        expect(createTemplateMock).toHaveBeenCalledWith({
            name: 'Black Friday Announcement',
            subjectTemplate: 'Black Friday starts now',
            bodyHtml: '<p>Hello</p>',
            userId: 'usr-agent-1',
        });
        expect(parse(res).templateId).toBe(TEMPLATE_ID);
    });

    test('400: missing subjectTemplate', async () => {
        const res = await createTemplateHandler(
            event('POST', '/v1/templates', {
                body: JSON.stringify({ name: 'Missing subject' }),
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: { field: 'subjectTemplate' },
        });
    });
});

describe('GET /v1/templates/{id} (handler composition)', () => {
    test('200: returns the template', async () => {
        const res = await getTemplateHandler(
            event('GET', '/v1/templates/{id}', { pathParameters: { id: TEMPLATE_ID } }),
        );

        expect(res.statusCode).toBe(200);
        expect(getTemplateMock).toHaveBeenCalledWith(TEMPLATE_ID);
    });

    test('400: path id is not a UUID', async () => {
        const res = await getTemplateHandler(
            event('GET', '/v1/templates/{id}', { pathParameters: { id: 'nope' } }),
        );

        expect(res.statusCode).toBe(400);
        expect(parse(res).error.details).toMatchObject({ field: 'id' });
    });

    test('404: template does not exist', async () => {
        getTemplateMock.mockRejectedValue(new NotFoundError('template', TEMPLATE_ID));

        const res = await getTemplateHandler(
            event('GET', '/v1/templates/{id}', { pathParameters: { id: TEMPLATE_ID } }),
        );

        expect(res.statusCode).toBe(404);
        expect(parse(res).error.details).toMatchObject({ field: 'templateId' });
    });
});

describe('PUT /v1/templates/{id} (handler composition)', () => {
    test('200: validates the patch and returns the updated template', async () => {
        const res = await updateTemplateHandler(
            event('PUT', '/v1/templates/{id}', {
                pathParameters: { id: TEMPLATE_ID },
                body: JSON.stringify({ subjectTemplate: 'Last chance' }),
            }),
        );

        expect(res.statusCode).toBe(200);
        expect(updateTemplateMock).toHaveBeenCalledWith({
            templateId: TEMPLATE_ID,
            subjectTemplate: 'Last chance',
            userId: 'usr-agent-1',
        });
        expect(parse(res).subjectTemplate).toBe('Last chance');
    });

    test('400: empty patch is rejected', async () => {
        const res = await updateTemplateHandler(
            event('PUT', '/v1/templates/{id}', {
                pathParameters: { id: TEMPLATE_ID },
                body: JSON.stringify({}),
            }),
        );

        expect(res.statusCode).toBe(400);
        expect(updateTemplateMock).not.toHaveBeenCalled();
    });
});

describe('DELETE /v1/templates/{id} (handler composition)', () => {
    test('204: deletes an unused template', async () => {
        const res = await deleteTemplateHandler(
            event('DELETE', '/v1/templates/{id}', { pathParameters: { id: TEMPLATE_ID } }),
        );

        expect(res.statusCode).toBe(204);
        expect(res.body).toBe('');
        expect(deleteTemplateMock).toHaveBeenCalledWith(TEMPLATE_ID, 'usr-agent-1');
    });

    test('409: template still referenced by a campaign', async () => {
        deleteTemplateMock.mockRejectedValue(
            new ConflictError('Template is used by 2 campaign(s) and cannot be deleted.'),
        );

        const res = await deleteTemplateHandler(
            event('DELETE', '/v1/templates/{id}', { pathParameters: { id: TEMPLATE_ID } }),
        );

        expect(res.statusCode).toBe(409);
        expect(parse(res).error.code).toBe('CONFLICT');
    });
});
