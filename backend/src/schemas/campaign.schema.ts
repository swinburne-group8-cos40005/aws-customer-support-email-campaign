import { z } from 'zod';

/**
 * Request body for POST /v1/campaigns — docs/api-contract.md §2.1.
 *
 * Kept in one place so the contract's field rules have a single source
 * of truth the controller, tests and future docs can all reference.
 * `trim` runs before length checks so whitespace-only names are caught
 * by min(1) rather than passing as "valid".
 */
export const createCampaignSchema = z.object({
    name: z
        .string({ invalid_type_error: 'name must be a string.' })
        .trim()
        .min(1, 'name is required.')
        .max(150, 'name must be at most 150 characters.'),
    templateId: z.string().uuid('templateId must be a UUID.'),
    segmentId: z.string().uuid('segmentId must be a UUID.'),
});

export type CreateCampaignBody = z.infer<typeof createCampaignSchema>;
