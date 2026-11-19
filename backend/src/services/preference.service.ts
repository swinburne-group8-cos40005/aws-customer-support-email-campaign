import type { ApiOptOutReason } from '#schemas/preference.schema';
import type { SuppressionRow } from '#repositories/customer.repository';

import { runInTransaction } from '#db/connection';

import { insertAuditRecord } from '#repositories/audit-log.repository';
import {
    deleteSuppression,
    findCustomerRowById,
    findCustomerRowForUpdate,
    findSuppressionByEmail,
    findSuppressionRowForUpdate,
    upsertSuppression,
} from '#repositories/customer.repository';

import { ConflictError, NotFoundError } from '#utils/errors';




/** Reasons written by SES event feedback, not by this API (db/schema.sql). */
const _DELIVERABILITY_REASONS: readonly string[] = ['bounce', 'complaint'];

/**
 * Normalises an email the same way `email_suppressions` is keyed
 * (db/schema.sql, `email_normalized`). One definition here means GET
 * and PUT can never disagree about which row they are looking at.
 *
 * @param email - The customer's stored address.
 *
 * @returns lower(trim(email)).
 *
 * @example
 * const key = _normaliseEmail('  Hang.Le@Example.com ')
 * console.log(key) // Output: 'hang.le@example.com'
 */
const _normaliseEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Builds the preference body both endpoints return. Opt-out is
 * membership of `email_suppressions`, so a missing row is the
 * opted-in state and its metadata fields are null.
 *
 * @param customerId - Customer the preference belongs to.
 * @param email - The customer's stored address.
 * @param suppression - Suppression row when the address is opted out.
 *
 * @returns Preference body in contract field names.
 *
 * @example
 * const body = _mapPreferenceResponse(customerId, 'hang.le@example.com', null)
 * console.log(body.isOptedOut) // Output: false
 */
const _mapPreferenceResponse = (
    customerId: string,
    email: string,
    suppression: SuppressionRow | null,
) => ({
    customerId,
    email,
    isOptedOut: suppression !== null,
    reason: suppression?.reason ?? null,
    suppressedAt: suppression?.created_at ?? null,
});

/** PUT /customers/{id}/preferences command: the desired state plus who asked for it. */
export interface UpdatePreferenceCommand {
    customerId: string;
    isOptedOut: boolean;
    reason?: ApiOptOutReason;
    userId: string;
}

/**
 * Reads one customer's opt-in/opt-out state (US05,
 * docs/api-contract.md §2.4).
 *
 * @param customerId - Customer UUID from the path.
 *
 * @returns `{ customerId, email, isOptedOut, reason, suppressedAt }`.
 *
 * @throws NotFoundError When the customer does not exist.
 *
 * @example
 * const preference = await getCustomerPreference('00000000-0000-4000-8000-000000000006')
 * console.log(preference.isOptedOut) // Output: true
 */
export const getCustomerPreference = async (customerId: string) => {
    const customer = await findCustomerRowById(customerId);
    if (!customer) {
        throw new NotFoundError('customer', customerId);
    }

    const suppression = await findSuppressionByEmail(_normaliseEmail(customer.email));

    return _mapPreferenceResponse(customer.customer_id, customer.email, suppression);
};

/**
 * Audit snapshot of the preference state before a change: only the
 * fields a reviewer needs to reconstruct the decision.
 *
 * @param suppression - Suppression row as read under the lock, if any.
 *
 * @returns `{ isOptedOut }` plus `reason` when the address was suppressed.
 *
 * @example
 * const snapshot = _toPreferenceSnapshot(null)
 * console.log(snapshot) // Output: { isOptedOut: false }
 */
const _toPreferenceSnapshot = (suppression: SuppressionRow | null) => {
    if (!suppression) {
        return { isOptedOut: false };
    }

    return {
        isOptedOut: true,
        reason: suppression.reason,
    };
};

/**
 * Applies an opt-out or opt-in (US05, docs/api-contract.md §2.4). The
 * suppression table stays the single source of truth: opting out
 * upserts a row for the normalised address, opting in deletes it.
 *
 * Two rules keep the global list honest:
 *  - opting out defaults `reason` to `manual_opt_out`; the API can only
 *    ever write the two reasons it is allowed to claim
 *    (docs/api-contract.md §2.4);
 *  - opting **in** is refused with 409 when the existing suppression
 *    came from SES feedback (`bounce`/`complaint`), because that
 *    address is undeliverable — a preference change must not resurrect
 *    it. Only the deliverability path may lift those rows.
 *
 * The customer row is locked and a suppression upsert/delete plus the
 * `opt_out`/`opt_in` audit row share its transaction (FR9,
 * docs/audit-log-strategy.md §5).
 *
 * @param command - Desired state, optional reason, and the caller's identity.
 *
 * @returns The resulting preference body.
 *
 * @throws NotFoundError When the customer does not exist.
 * @throws ConflictError When opting in to an address suppressed by a
 *         bounce or complaint.
 *
 * @example
 * const preference = await updateCustomerPreference({
 *     customerId: '00000000-0000-4000-8000-000000000001',
 *     isOptedOut: true,
 *     reason: 'customer_requested',
 *     userId: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f',
 * })
 * console.log(preference.isOptedOut) // Output: true
 */
export const updateCustomerPreference = async (command: UpdatePreferenceCommand) => {
    return runInTransaction(async (tx) => {
        const customer = await findCustomerRowForUpdate(tx, command.customerId);
        if (!customer) {
            throw new NotFoundError('customer', command.customerId);
        }

        const emailNormalized = _normaliseEmail(customer.email);
        const existing = await findSuppressionRowForUpdate(tx, emailNormalized);

        if (command.isOptedOut) {
            const reason = command.reason ?? 'manual_opt_out';

            const suppression = await upsertSuppression(tx, emailNormalized, reason);

            await insertAuditRecord(tx, {
                userId: command.userId,
                action: 'opt_out',
                entityType: 'customer_preference',
                entityId: customer.customer_id,
                changes: {
                    before: _toPreferenceSnapshot(existing),
                    after: { isOptedOut: true, reason },
                },
            });

            return _mapPreferenceResponse(customer.customer_id, customer.email, suppression);
        }

        if (existing && _DELIVERABILITY_REASONS.includes(existing.reason)) {
            throw new ConflictError(
                `Customer ${command.customerId} cannot be opted in: the address is suppressed as '${existing.reason}'.`,
                { field: 'isOptedOut', reason: `address suppressed by ${existing.reason}` },
            );
        }

        await deleteSuppression(tx, emailNormalized);

        await insertAuditRecord(tx, {
            userId: command.userId,
            action: 'opt_in',
            entityType: 'customer_preference',
            entityId: customer.customer_id,
            changes: {
                before: _toPreferenceSnapshot(existing),
                after: { isOptedOut: false },
            },
        });

        return _mapPreferenceResponse(customer.customer_id, customer.email, null);
    });
};

