import { withErrorBoundary } from './with-error-boundary';
import { withRequestLogging } from './with-request-logging';
import { withAuth, type InnerHandler } from './with-auth';

export type { InnerHandler, RequestContext } from './with-auth';

/**
 * Standard middleware chain, outermost first:
 *   logging -> error boundary -> auth -> controller
 *
 * Order matters: auth runs inside the error boundary so a missing
 * identity still answers with the contract's 401 envelope, and logging
 * sees the final status code.
 */
export const composeMiddleware =
    (inner: InnerHandler): InnerHandler =>
    (event, context) =>
        withRequestLogging(withErrorBoundary(withAuth(inner)))(event, context);
