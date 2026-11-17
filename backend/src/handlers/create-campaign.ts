import { handleCreateCampaignRequest } from '../controllers/campaign.controller';
import { composeMiddleware } from '../middleware';

/**
 * Lambda entry point wired to POST /v1/campaigns in infra/api.yaml
 * (Handler: create-campaign.handler). Deliberately thin: middleware
 * composition plus the controller — so the remaining eight endpoints
 * inherit the exact same wiring pattern.
 */
export const handler = composeMiddleware(handleCreateCampaignRequest);
