import { z } from 'zod';




/**
 * Entity types the audit trail can be filtered by — exactly the values
 * the `audit_logs.entity_type` CHECK allows (db/schema.sql). The
 * contract lists campaign/template/segment (§2.5); `customer_preference`
 * is included because the preference endpoints write it, and omitting
 * it would make their history unfilterable.
 */
export const auditEntityTypeSchema = z.enum(
    ['campaign', 'template', 'segment', 'customer_preference'],
    {
        errorMap: () => ({
            message: 'entityType must be one of campaign, template, segment, customer_preference.',
        }),
    },
);

/**
 * Query parameters for GET /v1/audit-logs — docs/api-contract.md §2.5.
 * API Gateway delivers every value as a string, hence `coerce` on
 * `limit`; the cap keeps one request from reading the whole table.
 */
export const listAuditLogsQuerySchema = z.object({
    entityType: auditEntityTypeSchema.optional(),
    entityId: z.string().uuid('entityId must be a UUID.').optional(),
    userId: z
        .string()
        .trim()
        .min(1, 'userId must not be empty.')
        .max(100, 'userId must be at most 100 characters.')
        .optional(),
    cursor: z
        .string()
        .min(1, 'cursor must not be empty.')
        .optional(),
    limit: z.coerce
        .number({ invalid_type_error: 'limit must be a number.' })
        .int('limit must be an integer.')
        .min(1, 'limit must be at least 1.')
        .max(100, 'limit must be at most 100.')
        .default(20),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
