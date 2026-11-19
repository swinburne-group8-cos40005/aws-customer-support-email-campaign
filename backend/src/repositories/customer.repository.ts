import type { Queryable } from '#db/connection';
import { runReadQuery } from '#db/connection';




/** Shape of the `customers` columns the preferences endpoints need. */
export interface CustomerRow {
    customer_id: string;
    email: string;
    created_at: string;
}

/** Shape of an `email_suppressions` row — opt-out is membership of this table. */
export interface SuppressionRow {
    email_normalized: string;
    reason: string;
    created_at: string;
}

/**
 * Reads one customer and locks it until the transaction ends, so a
 * concurrent preference change cannot interleave with this one. The
 * lock also pins the email address that is about to be normalised.
 *
 * @param tx - Open transaction performing the mutation.
 * @param customerId - Primary key to lock.
 *
 * @returns The stored row, or null when the customer does not exist.
 *
 * @example
 * const row = await findCustomerRowForUpdate(tx, customerId)
 * console.log(row?.email) // Output: 'hang.le@example.com'
 */
export const findCustomerRowForUpdate = async (
    tx: Queryable,
    customerId: string,
): Promise<CustomerRow | null> => {
    const result = await tx.query(
        `SELECT customer_id, email, created_at
         FROM customers
         WHERE customer_id = $1
         FOR UPDATE`,
        [customerId],
    );

    return (result.rows[0] as unknown as CustomerRow | undefined) ?? null;
};

/**
 * Reads one customer without locking — the GET preferences path.
 *
 * @param customerId - Primary key to look for.
 *
 * @returns The stored row, or null when it does not exist.
 *
 * @example
 * const row = await findCustomerRowById(customerId)
 * console.log(row?.email) // Output: 'hang.le@example.com'
 */
export const findCustomerRowById = async (customerId: string): Promise<CustomerRow | null> => {
    const result = await runReadQuery(
        `SELECT customer_id, email, created_at
         FROM customers
         WHERE customer_id = $1`,
        [customerId],
    );

    return (result.rows[0] as unknown as CustomerRow | undefined) ?? null;
};

/**
 * Looks up the suppression row for a normalised email. Opt-out has no
 * column on `customers` (db/schema.sql): membership of
 * `email_suppressions` *is* the opt-out state, which keeps one global
 * list for every sending path.
 *
 * @param emailNormalized - lower(trim(email)) of the customer.
 *
 * @returns The suppression row, or null when the address is not suppressed.
 *
 * @example
 * const row = await findSuppressionByEmail('hang.le@example.com')
 * console.log(row?.reason) // Output: 'bounce'
 */
export const findSuppressionByEmail = async (
    emailNormalized: string,
): Promise<SuppressionRow | null> => {
    const result = await runReadQuery(
        `SELECT email_normalized, reason, created_at
         FROM email_suppressions
         WHERE email_normalized = $1`,
        [emailNormalized],
    );

    return (result.rows[0] as unknown as SuppressionRow | undefined) ?? null;
};

/**
 * Reads one suppression row inside the preference transaction and locks
 * it until commit. The customer row is already locked by
 * findCustomerRowForUpdate, so this second lock keeps two different
 * callers from racing on the same address (two customers can share an
 * address only in theory, but the suppression table is global).
 *
 * @param tx - Open transaction holding the customer lock.
 * @param emailNormalized - lower(trim(email)) of the customer.
 *
 * @returns The suppression row, or null when the address is not suppressed.
 *
 * @example
 * const row = await findSuppressionRowForUpdate(tx, 'hang.le@example.com')
 * console.log(row?.reason) // Output: 'bounce'
 */
export const findSuppressionRowForUpdate = async (
    tx: Queryable,
    emailNormalized: string,
): Promise<SuppressionRow | null> => {
    const result = await tx.query(
        `SELECT email_normalized, reason, created_at
         FROM email_suppressions
         WHERE email_normalized = $1
         FOR UPDATE`,
        [emailNormalized],
    );

    return (result.rows[0] as unknown as SuppressionRow | undefined) ?? null;
};

/**
 * Adds or refreshes one suppression row. Re-opting out with a different
 * reason replaces the stored reason, so the list always says *why* the
 * address is blocked. `created_at` is preserved for an existing row
 * (ON CONFLICT leaves it untouched).
 *
 * @param tx - Open transaction holding the customer lock.
 * @param emailNormalized - lower(trim(email)) of the customer.
 * @param reason - Why the address is suppressed (table CHECK values).
 *
 * @returns The stored suppression row.
 *
 * @example
 * const row = await upsertSuppression(tx, 'hang.le@example.com', 'customer_requested')
 * console.log(row.reason) // Output: 'customer_requested'
 */
export const upsertSuppression = async (
    tx: Queryable,
    emailNormalized: string,
    reason: string,
): Promise<SuppressionRow> => {
    const result = await tx.query(
        `INSERT INTO email_suppressions (email_normalized, reason)
         VALUES ($1, $2)
         ON CONFLICT (email_normalized)
         DO UPDATE SET reason = EXCLUDED.reason
         RETURNING email_normalized, reason, created_at`,
        [emailNormalized, reason],
    );

    const row = result.rows[0];
    if (!row) {
        throw new Error('suppression UPSERT RETURNING produced no row');
    }

    return row as unknown as SuppressionRow;
};

/**
 * Removes the suppression row, which is what "opt back in" means for
 * this schema. Returns false when the address was not suppressed, so
 * the service can still report the resulting state honestly.
 *
 * @param tx - Open transaction holding the customer lock.
 * @param emailNormalized - lower(trim(email)) of the customer.
 *
 * @returns True when a suppression row was removed.
 *
 * @example
 * const removed = await deleteSuppression(tx, 'hang.le@example.com')
 * console.log(removed) // Output: true
 */
export const deleteSuppression = async (
    tx: Queryable,
    emailNormalized: string,
): Promise<boolean> => {
    const result = await tx.query(
        `DELETE FROM email_suppressions
         WHERE email_normalized = $1`,
        [emailNormalized],
    );

    return (result.rowCount ?? 0) > 0;
};
