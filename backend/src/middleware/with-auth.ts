import type { APIGatewayProxyEvent } from 'aws-lambda';
import { UnauthorizedError } from '../utils/errors';

/** Identity resolved by the JWT authorizer and handed to controllers. */
export interface RequestContext {
    userId: string;
}

/** Controllers receive the event plus the resolved request context. */
export type InnerHandler = (
    event: APIGatewayProxyEvent,
    context: RequestContext,
) => Promise<APIGatewayProxyResult>;

/**
 * Cognito `sub` claim injected by the API Gateway JWT authorizer.
 * The gateway already verified the token (infra/api.yaml); this only
 * unpacks the verified claim — no token parsing happens in Lambda.
 */
const cognitoSub = (event: APIGatewayProxyEvent): string | null => {
    const authorizer = (
        event.requestContext as unknown as {
            authorizer?: { claims?: Record<string, string> };
        }
    ).authorizer;
    return authorizer?.claims?.sub ?? null;
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
