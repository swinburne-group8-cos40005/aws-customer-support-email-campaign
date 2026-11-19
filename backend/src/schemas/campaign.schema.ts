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

/**
 * Campaign statuses the API accepts as a `GET /v1/campaigns` filter —
 * mirrors the table CHECK constraint and the state machine
 * (docs/email-state-machine.md §1.1).
 */
export const campaignStatusSchema = z.enum([
    'draft',
    'scheduled',
    'sending',
    'completed',
    'failed',
    'cancelled',
], {
    errorMap: () => ({
        message: 'status must be one of draft, scheduled, sending, completed, failed, cancelled.',
    }),
});

/**
 * Query parameters for GET /v1/campaigns — docs/api-contract.md §2.1.
 * API Gateway hands every value over as a string, hence `coerce`;
 * `limit` is capped at 100 so one request can never ask for the table.
 */
export const listCampaignsQuerySchema = z.object({
    status: campaignStatusSchema.optional(),
    page: z.coerce
        .number({ invalid_type_error: 'page must be a number.' })
        .int('page must be an integer.')
        .min(1, 'page must be at least 1.')
        .default(1),
    limit: z.coerce
        .number({ invalid_type_error: 'limit must be a number.' })
        .int('limit must be an integer.')
        .min(1, 'limit must be at least 1.')
        .max(100, 'limit must be at most 100.')
        .default(20),
});

export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;

/** Mutable fields of a draft campaign. Omitted keys keep their stored value. */
const campaignPatchShape = {
    name: z
        .string({ invalid_type_error: 'name must be a string.' })
        .trim()
        .min(1, 'name is required.')
        .max(150, 'name must be at most 150 characters.'),
    templateId: z.string().uuid('templateId must be a UUID.'),
    segmentId: z.string().uuid('segmentId must be a UUID.'),
};

/**
 * Request body for PUT /v1/campaigns/{id} — docs/api-contract.md §2.1.
 * Every field is optional (partial update) but an empty body is
 * rejected: a request that changes nothing is a client bug, not a no-op
 * write that would still emit an audit row.
 */
export const updateCampaignSchema = z
    .object({
        name: campaignPatchShape.name.optional(),
        templateId: campaignPatchShape.templateId.optional(),
        segmentId: campaignPatchShape.segmentId.optional(),
    })
    .refine(
        (body) => body.name !== undefined
            || body.templateId !== undefined
            || body.segmentId !== undefined,
        {
            message: 'At least one of name, templateId or segmentId is required.',
            path: ['body'],
        },
    );

export type UpdateCampaignBody = z.infer<typeof updateCampaignSchema>;

/**
 * Request body for POST /v1/campaigns/{id}/schedule —
 * docs/api-contract.md §2.1. The 5-minute lead time is a business rule
 * (docs/email-state-machine.md §1.2) and lives in the service, not
 * here, so the schema stays clock-independent.
 */
export const scheduleCampaignSchema = z.object({
    scheduledAt: z
        .string({ required_error: 'scheduledAt is required.' })
        .datetime({
            offset: true,
            message: 'scheduledAt must be an ISO 8601 timestamp with a timezone, e.g. 2026-11-01T14:00:00Z.',
        }),
});

export type ScheduleCampaignBody = z.infer<typeof scheduleCampaignSchema>;
