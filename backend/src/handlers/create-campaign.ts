import { handleCreateCampaignRequest } from '../controllers/campaign.controller';
import { catchHandlerErrors } from '../middleware/error-boundary';
import { requireCognitoIdentity } from '../middleware/auth';
import { logRequestSummary } from '../middleware/request-logging';
import { composeMiddleware, type Middleware } from '../middleware';

/**
 * Standard chain, outermost first — declared like Express's app.use:
 * every request is logged, every failure becomes the contract error
 * envelope, and no controller runs without a verified identity.
 */
const middleware: Middleware[] = [
    logRequestSummary,
    catchHandlerErrors,
    requireCognitoIdentity,
];

/**
 * Lambda entry point wired to POST /v1/campaigns in infra/api.yaml
 * (Handler: create-campaign.handler). Deliberately thin: the middleware
 * array plus the controller — so the remaining eight endpoints inherit
 * the exact same wiring pattern.
 *
 * @param event - HTTP API v2 event forwarded by API Gateway.
 *
 * @returns The handler's response; never rejects (the error boundary
 *          turns every failure into the contract error envelope).
 *
 * @example
 * const response = await handler(event)
 * console.log(response.statusCode) // Output: 201 — never rejects; every
 *                                  // failure arrives as an error envelope
 */
export const handler = composeMiddleware(middleware, handleCreateCampaignRequest);
