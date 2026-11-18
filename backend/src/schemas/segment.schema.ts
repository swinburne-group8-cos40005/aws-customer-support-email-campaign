import { z } from 'zod';




/**
 * Request body for POST /v1/segments — docs/api-contract.md §2.3.
 * `rules` is the audience filter tree the dispatcher evaluates at
 * dispatch time (db/schema.sql); the API validates that it is a JSON
 * object and otherwise stores it verbatim, because the rule vocabulary
 * belongs to the segment domain, not to this endpoint.
 */
export const createSegmentSchema = z.object({
    name: z
        .string({ invalid_type_error: 'name must be a string.' })
        .trim()
        .min(1, 'name is required.')
        .max(150, 'name must be at most 150 characters.'),
    description: z
        .string({ invalid_type_error: 'description must be a string.' })
        .max(2000, 'description must be at most 2000 characters.')
        .optional(),
    rules: z
        .record(z.unknown())
        .default({}),
});

export type CreateSegmentBody = z.infer<typeof createSegmentSchema>;
