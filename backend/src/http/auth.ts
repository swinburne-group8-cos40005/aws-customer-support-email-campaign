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
 * Identity the auth step resolved from the verified JWT claims, handed
 * to controllers. Controllers must never read identity from the request
 * body — userId always comes from here.
 *
 * @example
 * const state = { userId: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f' }
 * console.log(state.userId) // Output: the caller's Cognito sub
 */
export type AuthenticatedState = { userId: string };

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
 * undefined // -> resolveAuthenticatedUser answers 401
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
 * Auth step of the request pipeline: resolves the caller's identity
 * from the verified JWT claims. The gateway is the primary gate, but
 * this keeps the endpoint safe even if a route is ever misconfigured
 * in the template.
 *
 * @param event - HTTP API v2 event carrying the verified JWT claims.
 *
 * @returns The authenticated state the controller receives.
 *
 * @throws UnauthorizedError When the event carries no Cognito `sub`.
 *
 * @example
 * const state = resolveAuthenticatedUser(event)
 * console.log(state.userId) // Output: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f'
 *                           // (throws UnauthorizedError -> 401 without claims)
 */
export const resolveAuthenticatedUser = (event: ApiEvent): AuthenticatedState => {
    const sub = extractCognitoSub(event);
    if (!sub) {
        throw new UnauthorizedError();
    }

    return { userId: sub };
};
