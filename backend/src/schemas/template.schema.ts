import { z } from 'zod';




/**
 * Request body for POST /v1/templates — docs/api-contract.md §2.2.
 * `bodyHtml` and `bodyText` are both optional (a template may be
 * HTML-only or text-only); the subject and name are mandatory because
 * neither has a sensible default.
 */
export const createTemplateSchema = z.object({
    name: z
        .string({ invalid_type_error: 'name must be a string.' })
        .trim()
        .min(1, 'name is required.')
        .max(150, 'name must be at most 150 characters.'),
    subjectTemplate: z
        .string({ invalid_type_error: 'subjectTemplate must be a string.' })
        .trim()
        .min(1, 'subjectTemplate is required.')
        .max(255, 'subjectTemplate must be at most 255 characters.'),
    bodyHtml: z
        .string({ invalid_type_error: 'bodyHtml must be a string.' })
        .optional(),
    bodyText: z
        .string({ invalid_type_error: 'bodyText must be a string.' })
        .optional(),
});

export type CreateTemplateBody = z.infer<typeof createTemplateSchema>;

/**
 * Request body for PUT /v1/templates/{id} — docs/api-contract.md §2.2.
 * Every field is optional (partial update) but an empty body is
 * rejected: a no-op write would still emit an audit row.
 */
export const updateTemplateSchema = z
    .object({
        name: createTemplateSchema.shape.name.optional(),
        subjectTemplate: createTemplateSchema.shape.subjectTemplate.optional(),
        bodyHtml: createTemplateSchema.shape.bodyHtml,
        bodyText: createTemplateSchema.shape.bodyText,
    })
    .refine(
        (body) => body.name !== undefined
            || body.subjectTemplate !== undefined
            || body.bodyHtml !== undefined
            || body.bodyText !== undefined,
        {
            message: 'At least one template field is required.',
            path: ['body'],
        },
    );

export type UpdateTemplateBody = z.infer<typeof updateTemplateSchema>;
