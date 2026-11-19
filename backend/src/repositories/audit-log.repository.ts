import type { Queryable } from '#db/connection';
import { runReadQuery } from '#db/connection';




export interface AuditEntry {
    userId: string;
    action:
        | 'create'
        | 'update'
        | 'delete'
        | 'schedule'
        | 'send'
        | 'cancel'
        | 'opt_in'
        | 'opt_out';
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

/** Shape of an `audit_logs` row as GET /audit-logs returns it (docs/api-contract.md §2.5). */
export interface AuditLogRow {
    audit_log_id: string;
    user_id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    changes: Record<string, unknown>;
    created_at: string;
}

export interface AuditLogFilters {
    entityType?: string;
    entityId?: string;
    userId?: string;
    /** Keyset position: last row's created_at, from the decoded cursor. */
    cursorCreatedAt?: string;
    /** Keyset position: last row's audit_log_id, from the decoded cursor. */
    cursorAuditLogId?: string;
    limit: number;
}

const _AUDIT_LOG_COLUMNS = `audit_log_id, user_id, action, entity_type, entity_id,
                            changes, created_at`;

/**
 * Reads one keyset page of the audit trail, newest first
 * (docs/api-contract.md §2.5). Keyset — not OFFSET — so a row inserted
 * between two pages cannot shift the boundary and duplicate/skip a
 * record. The row comparison `(created_at, audit_log_id) < (cursor...)`
 * is stable because audit_log_id breaks created_at ties.
 *
 * @param filters - Optional entity/user filters plus the decoded cursor and limit.
 *
 * @returns At most `filters.limit` rows, newest first.
 *
 * @example
 * const rows = await listAuditLogRows({ entityType: 'campaign', limit: 21 })
 * console.log(rows[0]?.action) // Output: 'schedule'
 */
export const listAuditLogRows = async (filters: AuditLogFilters): Promise<AuditLogRow[]> => {
    const result = await runReadQuery(
        `SELECT ${_AUDIT_LOG_COLUMNS}
         FROM audit_logs
         WHERE ($1::text IS NULL OR entity_type = $1)
           AND ($2::uuid IS NULL OR entity_id = $2)
           AND ($3::text IS NULL OR user_id = $3)
           AND (
               $4::timestamptz IS NULL
               OR (created_at, audit_log_id) < ($4::timestamptz, $5::uuid)
           )
         ORDER BY created_at DESC, audit_log_id DESC
         LIMIT $6`,
        [
            filters.entityType ?? null,
            filters.entityId ?? null,
            filters.userId ?? null,
            filters.cursorCreatedAt ?? null,
            filters.cursorAuditLogId ?? null,
            filters.limit,
        ],
    );

    return result.rows as unknown as AuditLogRow[];
};

/**
 * Maps an audit row onto the camelCase contract body
 * (docs/api-contract.md §2.5).
 *
 * @param row - Row read from audit_logs.
 *
 * @returns One entry of the response's `data` array.
 *
 * @example
 * const entry = mapAuditLogRowToResponse(row)
 * console.log(entry.action) // Output: 'schedule'
 */
export const mapAuditLogRowToResponse = (row: AuditLogRow) => ({
    auditLogId: row.audit_log_id,
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    changes: row.changes,
    createdAt: row.created_at,
});
