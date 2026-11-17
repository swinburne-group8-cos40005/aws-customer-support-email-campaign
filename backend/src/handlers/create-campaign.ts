import { handleCreateCampaignRequest } from '../controllers/campaign.controller';
import { composeMiddleware } from '../middleware';

/**
 * Lambda entry point wired to POST /v1/campaigns in infra/api.yaml
 * (Handler: create-campaign.handler). Deliberately thin: middleware
 * composition plus the controller — so the remaining eight endpoints
 * inherit the exact same wiring pattern.
 *
 * @param event - HTTP API v2 event forwarded by API Gateway.
 *
 * @returns The handler's response; never rejects (the error boundary
 *          turns every failure into the contract error envelope).
 *
 * @example
 * const result = await handler({ version: '2.0', ... });
 */
export const handler = composeMiddleware(handleCreateCampaignRequest);
