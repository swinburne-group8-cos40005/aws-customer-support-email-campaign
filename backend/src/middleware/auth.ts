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
 * Per-request state flowing through the middleware chain. Middleware
 * populate it as the request travels inward (Express mutates `req` the
 * same way); the controller reads the final result.
 *
 * @example
 * // Before the auth middleware ran:
 * {}
 *
 * // After requireCognitoIdentity ran:
 * { userId: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f' }
 */
export interface RequestState {
    userId?: string;
}

/**
 * The state a controller may rely on: the auth middleware has already
 * run, so userId is guaranteed to be present.
 *
 * @example
 * const state = { userId: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f' }
 * console.log(state.userId) // Output: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f'
 */
export type AuthenticatedState = RequestState & { userId: string };

/**
 * Passes control to the next stage of the chain. A middleware that does
 * not call next() short-circuits the chain (e.g. an early 401).
 *
 * @example
 * const result = await next()
 * console.log(result.statusCode) // Output: 201 on a successful create
 */
export type Next = () => Promise<APIGatewayProxyResult>;

/**
 * One stage of the chain, in the style of Express middleware:
 * receives the event, the shared RequestState and a next() callback.
 * Call next() to continue; return a response instead to short-circuit.
 *
 * @example
 * const latencyProbe: Middleware = async (event, state, next) => {
 *     const started = Date.now()
 *     const result = await next()
 *     console.log(Date.now() - started) // Output: e.g. 42
 *     return result
 * }
 */
export type Middleware = (
    event: ApiEvent,
    state: RequestState,
    next: Next,
) => Promise<APIGatewayProxyResult>;

/**
 * A controller: the last stage of the chain. It receives the event and
 * the authenticated state (userId guaranteed by requireCognitoIdentity).
 *
 * @example
 * const controller: InnerHandler = async (event, state) => {
 *     console.log(state.userId) // Output: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f'
 *     return buildSuccessResponse(201, { name: 'Black Friday' })
 * }
 */
export type InnerHandler = (
    event: ApiEvent,
    state: AuthenticatedState,
) => Promise<APIGatewayProxyResult>;

/**
 * The composed chain, callable straight from the Lambda runtime with
 * just the event.
 *
 * @example
 * const response = await handler(event)
 * console.log(response.statusCode) // Output: 201 on success
 */
export type ComposedHandler = (event: ApiEvent) => Promise<APIGatewayProxyResult>;

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
 * Auth middleware: resolves the caller's identity from the verified
 * JWT claims, stores it on the shared state, then continues the chain.
 * The gateway is the primary gate, but this keeps the endpoint safe
 * even if a route is ever misconfigured in the template.
 *
 * @example
 * const middleware: Middleware[] = [
 *     logRequestSummary,
 *     catchHandlerErrors,
 *     requireCognitoIdentity,
 * ]
 * const handler = composeMiddleware(middleware, controller)
 * const response = await handler(event)
 * console.log(response.statusCode) // Output: 201 when claims exist,
 *                                  //           401 envelope otherwise
 */
export const requireCognitoIdentity: Middleware = async (event, state, next) => {
    const sub = extractCognitoSub(event);
    if (!sub) {
        throw new UnauthorizedError();
    }

    state.userId = sub;

    return next();
};
