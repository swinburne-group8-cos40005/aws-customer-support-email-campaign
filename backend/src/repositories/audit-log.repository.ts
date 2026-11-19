import type { Queryable } from '#db/connection';




export interface AuditEntry {
    userId: string;
    action: 'create' | 'update' | 'cancel' | 'send' | 'opt_in' | 'opt_out';
    entityType: string;
    entityId: string;
    /** Full before/after snapshot per docs/audit-log-strategy.md §4. */
    changes: Record<string, unknown>;
}

/**
 * Appends one audit row. The caller must hold the transaction: audit
 * rows ride the same transaction as the mutation they describe
 * (docs/audit-log-strategy.md §5) so the pair commits or rolls back
 * together — FR9 guarantees an auditable history with no blind spots.
 *
 * @param tx - The same transaction the mutation runs on.
 * @param entry - Who did what to which entity, with a before/after
 *                snapshot per docs/audit-log-strategy.md §4.
 *
 * @example
 * const entry = {
 *     userId: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f',
 *     action: 'create',
 *     entityType: 'campaign',
 *     entityId: '33333333-3333-4000-8000-000000000009',
 *     changes: { before: null, after: { status: 'draft' } },
 * }
 * console.log(entry.changes) // Output: { before: null, after: { status: 'draft' } }
 * await insertAuditRecord(tx, entry)
 */
export const insertAuditRecord = async (tx: Queryable, entry: AuditEntry): Promise<void> => {
    await tx.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
            entry.userId,
            entry.action,
            entry.entityType,
            entry.entityId,
            JSON.stringify(entry.changes),
        ],
    );
};
