import type { APIGatewayProxyResult } from 'aws-lambda';
import {
    requireCognitoIdentity,
    type AuthenticatedState,
    type ComposedHandler,
    type InnerHandler,
    type Middleware,
    type Next,
    type RequestState,
} from './auth';

export type {
    ApiEvent,
    AuthenticatedState,
    ComposedHandler,
    InnerHandler,
    Middleware,
    Next,
    RequestState,
} from './auth';

/**
 * Builds the middleware chain Express-style: the array lists middleware
 * outermost first, every stage receives (event, state, next) and calls
 * next() to continue; the controller runs last with the state the chain
 * collected.
 *
 * Order matters: auth runs inside the error boundary so a missing
 * identity still answers with the contract's 401 envelope, and logging
 * sees the final status code.
 *
 * @param middleware - Chain stages, outermost first.
 * @param controller - InnerHandler to run at the end of the chain.
 *
 * @returns A composed handler callable straight from the Lambda runtime
 *          with just the event.
 *
 * @example
 * const middleware: Middleware[] = [
 *     logRequestSummary,
 *     catchHandlerErrors,
 *     requireCognitoIdentity,
 * ]
 * const handler = composeMiddleware(middleware, handleCreateCampaignRequest)
 * const response = await handler(event)
 * console.log(response.statusCode) // Output: 201
 */
export const composeMiddleware = (
    middleware: Middleware[],
    controller: InnerHandler,
): ComposedHandler => {
    return (event) => {
        const runFrom = (index: number, state: RequestState): Promise<APIGatewayProxyResult> => {
            // Past the last middleware: hand the controller the state the
            // chain collected. requireCognitoIdentity guarantees userId.
            if (index === middleware.length) {
                return controller(event, state as AuthenticatedState);
            }

            const current = middleware[index]!;
            const next: Next = () => runFrom(index + 1, state);

            return current(event, state, next);
        };

        return runFrom(0, {});
    };
};
