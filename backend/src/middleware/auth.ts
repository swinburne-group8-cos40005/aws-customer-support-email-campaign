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
 * the chain entry (the Lambda runtime) has none yet: requireCognitoIdentity builds the
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
 * Unpacks the Cognito `sub` claim the API Gateway JWT authorizer already
 * verified (infra/api.yaml). No token parsing happens in Lambda — this
 * only reads the verified claim. Returns null when the authorizer
 * context is stripped or the sub is not a string, so a misconfigured
 * route degrades to a 401 instead of crashing into a 500.
 *
 * @param event - HTTP API v2 event carrying the verified JWT claims.
 *
 * @returns The verified Cognito subject, or null when absent.
 *
 * @example
 * const sub = extractCognitoSub(event); // 'usr-agent-1'
 */
const extractCognitoSub = (event: ApiEvent): string | null => {
    const authorizer = (event.requestContext as JwtAuthorizerContext).authorizer;
    const claims = authorizer?.jwt?.claims;
    const sub = claims?.sub;

    if (typeof sub !== 'string') {
        return null;
    }

    return sub;
};

/**
 * Middleware guarding every endpoint: refuses to run the inner handler
 * without a resolved identity. The gateway is the primary gate, but this
 * keeps the endpoint safe even if a route is ever misconfigured in the
 * template.
 *
 * @param inner - Controller to run once the identity is resolved.
 *
 * @returns A chain handler that throws UnauthorizedError when no valid
 *          Cognito claims are present, otherwise calls the controller
 *          with the resolved RequestContext.
 *
 * @throws UnauthorizedError When the event carries no Cognito `sub`.
 *
 * @example
 * export const handler = composeMiddleware(createCampaignController);
 * // requireCognitoIdentity runs inside that composition.
 */
export const requireCognitoIdentity = (inner: InnerHandler): HandlerFn => {
    return async (event) => {
        const sub = extractCognitoSub(event);
        if (!sub) {
            throw new UnauthorizedError();
        }

        const context: RequestContext = {
            userId: sub,
        };

        return inner(event, context);
    };
};
