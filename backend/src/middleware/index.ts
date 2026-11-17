import { withErrorBoundary } from './with-error-boundary';
import { withRequestLogging } from './with-request-logging';
import { withAuth, type HandlerFn, type InnerHandler } from './with-auth';

export type { HandlerFn, InnerHandler, RequestContext } from './with-auth';

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
    (event) =>
        withRequestLogging(withErrorBoundary(withAuth(controller)))(event);
