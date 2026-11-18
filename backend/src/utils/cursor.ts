import { z } from 'zod';

import { ValidationError } from '#utils/errors';




/**
 * Keyset position of the last row of an audit page
 * (docs/api-contract.md §2.5). The pair matches the ORDER BY key
 * `(created_at, audit_log_id)`, so a row inserted between two requests
 * cannot shift the boundary.
 */
export interface AuditCursor {
    createdAt: string;
    auditLogId: string;
}

/** Wire shape kept short (`id`) so the encoded cursor stays compact. */
const auditCursorSchema = z.object({
    createdAt: z.string().datetime({ offset: true }),
    id: z.string().uuid(),
});

/**
 * Encodes the last row's keyset position as an opaque, URL-safe
 * cursor. base64url avoids `+`, `/` and `=` tripping over query-string
 * encoding.
 *
 * @param cursor - Position of the last row of the page just returned.
 *
 * @returns base64url text safe to put in `?cursor=`.
 *
 * @example
 * const cursor = encodeAuditCursor({
 *     createdAt: '2026-10-25T14:30:00.000Z',
 *     auditLogId: 'e1f2a3b4-5678-40ab-cdef-1234567890ab',
 * })
 * console.log(cursor) // Output: 'eyJjcmVhdGVkQXQiOiIyMDI2LTEwLTI1VDE0OjMwOjAwLjAwMFoiLCJpZCI6ImUxZjJhM2I0LTU2NzgtNDBhYi1jZGVmLTEyMzQ1Njc4OTBhYiJ9'
 */
export const encodeAuditCursor = (cursor: AuditCursor): string => {
    const payload = JSON.stringify({
        createdAt: cursor.createdAt,
        id: cursor.auditLogId,
    });

    return Buffer.from(payload, 'utf8').toString('base64url');
};

/**
 * Decodes a `?cursor=` value back into the keyset position. Anything
 * that is not a well-formed cursor — bad base64, bad JSON, missing or
 * malformed fields — answers the same 400 validation envelope, because
 * a cursor is opaque to the client and cannot be repaired by guessing.
 *
 * @param raw - The `cursor` query parameter as received.
 *
 * @returns The decoded keyset position.
 *
 * @throws ValidationError When the cursor is not one this API issued.
 *
 * @example
 * const cursor = decodeAuditCursor('eyJjcmVhdGVkQXQiOi...')
 * console.log(cursor.auditLogId) // Output: 'e1f2a3b4-5678-40ab-cdef-1234567890ab'
 */
export const decodeAuditCursor = (raw: string): AuditCursor => {
    let decoded: unknown;
    try {
        const text = Buffer.from(raw, 'base64url').toString('utf8');
        decoded = JSON.parse(text);
    } catch {
        throw new ValidationError('cursor', 'cursor is not a valid page cursor.');
    }

    const parsed = auditCursorSchema.safeParse(decoded);
    if (!parsed.success) {
        throw new ValidationError('cursor', 'cursor is not a valid page cursor.');
    }

    return {
        createdAt: parsed.data.createdAt,
        auditLogId: parsed.data.id,
    };
};
