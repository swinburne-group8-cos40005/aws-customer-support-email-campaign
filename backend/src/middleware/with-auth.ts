import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResult } from 'aws-lambda';
import { UnauthorizedError } from '../utils/errors';

/**
 * The API is an HTTP API (infra/api.yaml, PayloadFormatVersion 2.0) with
 * a JWT authorizer, so Lambda receives this exact event shape: claims
 * live under requestContext.authorizer.jwt.claims — not the v1
 * authorizer.claims path used by REST API events.
 */
export type ApiEvent = APIGatewayProxyEventV2WithJWTAuthorizer;

/** Identity resolved by the JWT authorizer and handed to controllers. */
export interface RequestContext {
    userId: string;
}

/** Controllers receive the event plus the resolved request context. */
export type InnerHandler = (
    event: ApiEvent,
    context: RequestContext,
) => Promise<APIGatewayProxyResult>;

/**
 * Cognito `sub` claim injected by the API Gateway JWT authorizer.
 * The gateway already verified the token (infra/api.yaml); this only
 * unpacks the verified claim — no token parsing happens in Lambda.
 * The optional chain is runtime safety: a misconfigured route that
 * drops the authorizer must degrade to 401, not blow up as a 500.
 */
const cognitoSub = (event: ApiEvent): string | null => {
    const claims = (
        event.requestContext as { authorizer?: { jwt?: { claims?: Record<string, unknown> } } }
    ).authorizer?.jwt?.claims;
    const sub = claims?.sub;
    return typeof sub === 'string' ? sub : null;
};

/**
 * Defence in depth: the gateway is the primary gate, but the handler
 * still refuses to run without a resolved identity. Keeps the endpoint
 * safe even if a route is ever misconfigured in the template.
 */
export const withAuth =
    (inner: InnerHandler): InnerHandler =>
    async (event, context) => {
        const sub = cognitoSub(event);
        if (!sub) {
            throw new UnauthorizedError();
        }
        return inner(event, { userId: sub });
    };
