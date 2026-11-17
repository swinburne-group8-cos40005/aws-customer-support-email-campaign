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
 * A middleware-wrapped handler in the chain. `context` is optional because
 * the chain entry (the Lambda runtime) has none yet: withAuth builds the
 * real RequestContext from verified claims and ignores whatever the
 * runtime passed as its second argument.
 */
export type HandlerFn = (
    event: ApiEvent,
    context?: RequestContext,
) => Promise<APIGatewayProxyResult>;

/**
 * Runtime shape we accept for the authorizer context. Deliberately looser
 * than the generated event type so a stripped/misconfigured authorizer
 * degrades to `null` instead of throwing mid-request.
 */
type JwtAuthorizerContext = {
    authorizer?: {
        jwt?: {
            claims?: Record<string, unknown>;
        };
    };
};

/**
 * Cognito `sub` claim injected by the API Gateway JWT authorizer.
 * The gateway already verified the token (infra/api.yaml); this only
 * unpacks the verified claim — no token parsing happens in Lambda.
 */
const cognitoSub = (event: ApiEvent): string | null => {
    const authorizer = (event.requestContext as JwtAuthorizerContext).authorizer;
    const claims = authorizer?.jwt?.claims;
    const sub = claims?.sub;

    if (typeof sub !== 'string') {
        return null;
    }

    return sub;
};

/**
 * Defence in depth: the gateway is the primary gate, but the handler
 * still refuses to run without a resolved identity. Keeps the endpoint
 * safe even if a route is ever misconfigured in the template.
 */
export const withAuth =
    (inner: InnerHandler): HandlerFn =>
    async (event) => {
        const sub = cognitoSub(event);
        if (!sub) {
            throw new UnauthorizedError();
        }
        return inner(event, { userId: sub });
    };
