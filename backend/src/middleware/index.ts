import { catchHandlerErrors } from './error-boundary';
import { logRequestSummary } from './request-logging';
import { requireCognitoIdentity, type HandlerFn, type InnerHandler } from './auth';

export type { HandlerFn, InnerHandler, RequestContext } from './auth';

/**
 * Standard middleware chain, outermost first:
 *   logging -> error boundary -> auth -> controller
 *
 * Order matters: auth runs inside the error boundary so a missing
 * identity still answers with the contract's 401 envelope, and logging
 * sees the final status code.
 *
 * The composed result is a HandlerFn: callable straight from the Lambda
 * runtime with just the event, and the identity is rebuilt inside auth.
 */
export const composeMiddleware =
    (controller: InnerHandler): HandlerFn =>
    (event) => {
        const chain = logRequestSummary(catchHandlerErrors(requireCognitoIdentity(controller)));
        return chain(event);
    };
