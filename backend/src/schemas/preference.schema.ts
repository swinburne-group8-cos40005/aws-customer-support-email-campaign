import { z } from 'zod';




/**
 * Opt-out reasons this API is allowed to write
 * (docs/api-contract.md §2.4). `bounce` and `complaint` exist in
 * `email_suppressions` too, but they are written by SES event
 * feedback, never by a preference request.
 */
export const apiOptOutReasonSchema = z.enum(['customer_requested', 'manual_opt_out'], {
    errorMap: () => ({
        message: 'reason must be one of customer_requested, manual_opt_out.',
    }),
});

export type ApiOptOutReason = z.infer<typeof apiOptOutReasonSchema>;

/**
 * Request body for PUT /v1/customers/{id}/preferences — US05,
 * docs/api-contract.md §2.4.
 *
 * `reason` is only meaningful when opting out; sending it with
 * `isOptedOut: false` is rejected rather than silently ignored, so a
 * client cannot believe it explained an opt-in that has no reason.
 * When omitted on an opt-out the default is `manual_opt_out` — the
 * change was made from the API, not by the customer in a downstream
 * flow.
 */
export const updatePreferenceSchema = z
    .object({
        isOptedOut: z.boolean({
            required_error: 'isOptedOut is required.',
            invalid_type_error: 'isOptedOut must be a boolean.',
        }),
        reason: apiOptOutReasonSchema.optional(),
    })
    .superRefine((body, ctx) => {
        if (body.isOptedOut === false && body.reason !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['reason'],
                message: 'reason is only allowed when isOptedOut is true.',
            });
        }
    });

export type UpdatePreferenceBody = z.infer<typeof updatePreferenceSchema>;
