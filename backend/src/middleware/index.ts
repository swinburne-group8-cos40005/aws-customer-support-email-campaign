import { catchHandlerErrors } from './error-boundary';
import { logRequestSummary } from './request-logging';
import { requireCognitoIdentity, type HandlerFn, type InnerHandler } from './auth';

export type { HandlerFn, InnerHandler, RequestContext } from './auth';

/**
 * Builds the standard middleware chain for a controller, outermost first:
 *   logRequestSummary -> catchHandlerErrors -> requireCognitoIdentity
 *
 * Order matters: auth runs inside the error boundary so a missing
 * identity still answers with the contract's 401 envelope, and logging
 * sees the final status code.
 *
 * @param controller - InnerHandler to wrap with the standard chain.
 *
 * @returns A chain handler callable straight from the Lambda runtime
 *          with just the event; the identity is rebuilt inside auth.
 *
 * @example
 * const handler = composeMiddleware(handleCreateCampaignRequest)
 * const result = await handler(event)
 * console.log(result.statusCode) // Output: 201
 */
export const composeMiddleware = (controller: InnerHandler): HandlerFn => {
    return (event) => {
        const authenticating = requireCognitoIdentity(controller);
        const guardingErrors = catchHandlerErrors(authenticating);
        const loggingRequests = logRequestSummary(guardingErrors);

        return loggingRequests(event);
    };
};
