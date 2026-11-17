import type { Queryable } from '../db/connection';

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
 */
export const recordAudit = async (tx: Queryable, entry: AuditEntry): Promise<void> => {
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
