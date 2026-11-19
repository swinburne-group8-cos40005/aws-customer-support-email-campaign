import type { AuditLogRow } from '#repositories/audit-log.repository';
import type { ListAuditLogsQuery } from '#schemas/audit-log.schema';

import {
    listAuditLogRows,
    mapAuditLogRowToResponse,
} from '#repositories/audit-log.repository';

import {
    decodeAuditCursor,
    encodeAuditCursor,
} from '#utils/cursor';




/** GET /audit-logs envelope — docs/api-contract.md §2.5. */
export interface AuditLogListResult {
    data: ReturnType<typeof mapAuditLogRowToResponse>[];
    nextCursor: string | null;
}

/**
 * Turns a row into the keyset position the cursor codec expects. Kept
 * separate so the mapping from storage names happens once.
 *
 * @param row - Last row of the page.
 *
 * @returns The keyset position of that row.
 *
 * @example
 * const cursor = _toAuditCursor(row)
 * console.log(cursor.auditLogId) // Output: 'e1f2a3b4-5678-40ab-cdef-1234567890ab'
 */
const _toAuditCursor = (row: AuditLogRow) => ({
    createdAt: row.created_at,
    auditLogId: row.audit_log_id,
});

/**
 * Reads one keyset page of the audit trail (FR9,
 * docs/api-contract.md §2.5).
 *
 * The page asks the repository for `limit + 1` rows: the extra row is
 * proof that another page exists, and its predecessor becomes the
 * cursor. Without it, a page that happens to end exactly at the last
 * row would still advertise a `nextCursor` and the client would make a
 * pointless empty request.
 *
 * Keyset pagination — not OFFSET — so an audit row written while a
 * reviewer pages cannot shift the boundary and duplicate a record.
 *
 * @param query - Validated filters, the optional opaque cursor and limit.
 *
 * @returns The page plus `nextCursor` (null on the last page).
 *
 * @throws ValidationError When the cursor is not one this API issued.
 *
 * @example
 * const page = await listAuditLogs({ entityType: 'campaign', limit: 20 })
 * console.log(page.data[0]?.action) // Output: 'schedule'
 * console.log(page.nextCursor)      // Output: null — last page
 */
export const listAuditLogs = async (query: ListAuditLogsQuery): Promise<AuditLogListResult> => {
    const cursor = query.cursor ? decodeAuditCursor(query.cursor) : null;

    const rows = await listAuditLogRows({
        entityType: query.entityType,
        entityId: query.entityId,
        userId: query.userId,
        cursorCreatedAt: cursor?.createdAt,
        cursorAuditLogId: cursor?.auditLogId,
        limit: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const lastRow = pageRows.at(-1);

    return {
        data: pageRows.map(mapAuditLogRowToResponse),
        nextCursor: hasMore && lastRow ? encodeAuditCursor(_toAuditCursor(lastRow)) : null,
    };
};

