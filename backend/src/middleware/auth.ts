import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResult } from 'aws-lambda';
import { UnauthorizedError } from '../utils/errors';

/**
 * The event the Lambda receives — HTTP API (infra/api.yaml,
 * PayloadFormatVersion 2.0) with a JWT authorizer. Not the REST API v1
 * shape: claims live under requestContext.authorizer.jwt.claims.
 *
 * @example
 * // What API Gateway actually delivers (abridged):
 * {
 *     version: '2.0',
 *     routeKey: 'POST /v1/campaigns',
 *     rawPath: '/v1/campaigns',
 *     requestContext: {
 *         http: { method: 'POST', path: '/v1/campaigns' },
 *         authorizer: {
 *             jwt: {
 *                 claims: {
 *                     sub: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f',
 *                     email: 'agent@fpt-semail.onmicrosoft.com',
 *                 },
 *             },
 *         },
 *     },
 *     body: '{"name":"Black Friday","templateId":"...","segmentId":"..."}',
 * }
 */
export type ApiEvent = APIGatewayProxyEventV2WithJWTAuthorizer;

/**
 * Identity the auth middleware resolved from the verified JWT claims
 * and hands to controllers. Controllers must never read identity from
 * the request body — userId always comes from here.
 *
 * @example
 * const context = { userId: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f' }
 * console.log(context.userId) // Output: the caller's Cognito sub
 */
export interface RequestContext {
    userId: string;
}

/**
 * A controller: receives the HTTP API v2 event plus the RequestContext
 * resolved by requireCognitoIdentity, and answers with a proxy result.
 *
 * @example
 * const controller: InnerHandler = async (event, context) => {
 *     console.log(context.userId) // Output: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f'
 *     return buildSuccessResponse(201, { name: 'Black Friday' })
 * }
 */
export type InnerHandler = (
    event: ApiEvent,
    context: RequestContext,
) => Promise<APIGatewayProxyResult>;

/**
 * A middleware-wrapped handler in the chain. `context` is optional
 * because the chain entry (the Lambda runtime) has none yet:
 * requireCognitoIdentity builds the real RequestContext from verified
 * claims and ignores whatever the runtime passed as its second argument.
 *
 * @example
 * // The Lambda runtime calls the composed chain with just the event:
 * const result = await composedHandler(event)
 * console.log(result.statusCode) // Output: 201 on success, 401 without claims
 */
export type HandlerFn = (
    event: ApiEvent,
    context?: RequestContext,
) => Promise<APIGatewayProxyResult>;

/**
 * Runtime shape accepted for requestContext.authorizer. Deliberately
 * looser than the generated event type so a stripped or misconfigured
 * authorizer degrades to `null` instead of throwing mid-request.
 *
 * @example
 * // Authenticated request — authorizer present:
 * { jwt: { claims: { sub: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f' } } }
 *
 * // Misconfigured route — authorizer missing:
 * undefined // -> extractCognitoSub returns null -> 401
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
 * const sub = extractCognitoSub(event)
 * console.log(sub) // Output: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f'
 *                  // (null when the authorizer context is stripped)
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
 * const guarded = requireCognitoIdentity(controller)
 * const result = await guarded(event)
 * console.log(result.statusCode) // Output: 201 when claims exist,
 *                                //           401 envelope when they do not
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
