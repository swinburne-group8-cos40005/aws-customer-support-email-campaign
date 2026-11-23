import { z } from 'zod';




/**
 * Query parameters for GET /v1/stats/overview — docs/api-contract.md §2.6.
 * API Gateway hands every value over as a string, hence `coerce`;
 * `limit` is capped at 50 so the dashboard home page can never ask for
 * the whole campaign table in one request.
 */
export const statsOverviewQuerySchema = z.object({
    limit: z.coerce
        .number({ invalid_type_error: 'limit must be a number.' })
        .int('limit must be an integer.')
        .min(1, 'limit must be at least 1.')
        .max(50, 'limit must be at most 50.')
        .default(10),
});

export type StatsOverviewQuery = z.infer<typeof statsOverviewQuerySchema>;
