import type { AuditLogRow } from '#repositories/audit-log.repository';

import { listAuditLogs } from '#services/audit-log.service';

import { listAuditLogRows } from '#repositories/audit-log.repository';

import { decodeAuditCursor, encodeAuditCursor } from '#utils/cursor';




jest.mock('#repositories/audit-log.repository', () => ({
    ...jest.requireActual('#repositories/audit-log.repository'),
    listAuditLogRows: jest.fn(),
}));

const listAuditLogRowsMock = listAuditLogRows as jest.Mock;

const AUDIT_LOG_ID = 'e1f2a3b4-5678-40ab-cdef-1234567890ab';

const row = (overrides: Partial<AuditLogRow> = {}): AuditLogRow => ({
    audit_log_id: AUDIT_LOG_ID,
    user_id: 'usr-agent-1',
    action: 'schedule',
    entity_type: 'campaign',
    entity_id: '33333333-3333-4000-8000-000000000009',
    changes: { before: { status: 'draft' }, after: { status: 'scheduled' } },
    created_at: '2026-10-25T14:30:00.000Z',
    ...overrides,
});

beforeEach(() => {
    listAuditLogRowsMock.mockReset();
});

describe('listAuditLogs', () => {
    test('asks for limit + 1 rows and maps a page without a cursor', async () => {
        listAuditLogRowsMock.mockResolvedValue([row()]);

        const page = await listAuditLogs({
            entityType: 'campaign',
            limit: 20,
        });

        expect(listAuditLogRowsMock).toHaveBeenCalledWith({
            entityType: 'campaign',
            entityId: undefined,
            userId: undefined,
            cursorCreatedAt: undefined,
            cursorAuditLogId: undefined,
            limit: 21,
        });
        expect(page.data).toHaveLength(1);
        expect(page.data[0]?.auditLogId).toBe(AUDIT_LOG_ID);
        expect(page.nextCursor).toBeNull();
    });

    test('returns a cursor for the last row when the extra row proves another page', async () => {
        listAuditLogRowsMock.mockResolvedValue([
            row(),
            row({
                audit_log_id: 'f2a3b4c5-6789-41bc-def0-234567890abc',
                created_at: '2026-10-24T14:30:00.000Z',
            }),
        ]);

        const page = await listAuditLogs({ limit: 1 });

        expect(page.data).toHaveLength(1);
        expect(page.data[0]?.auditLogId).toBe(AUDIT_LOG_ID);

        const cursor = decodeAuditCursor(page.nextCursor!);
        expect(cursor).toEqual({
            createdAt: '2026-10-25T14:30:00.000Z',
            auditLogId: AUDIT_LOG_ID,
        });
    });

    test('stops at the last page instead of advertising an empty one', async () => {
        listAuditLogRowsMock.mockResolvedValue([row()]);

        const page = await listAuditLogs({ limit: 1 });

        expect(page.nextCursor).toBeNull();
    });

    test('decodes the incoming cursor and forwards its keyset position', async () => {
        const cursor = encodeAuditCursor({
            createdAt: '2026-10-24T14:30:00.000Z',
            auditLogId: 'f2a3b4c5-6789-41bc-def0-234567890abc',
        });
        listAuditLogRowsMock.mockResolvedValue([]);

        await listAuditLogs({ cursor, limit: 5 });

        expect(listAuditLogRowsMock).toHaveBeenCalledWith({
            entityType: undefined,
            entityId: undefined,
            userId: undefined,
            cursorCreatedAt: '2026-10-24T14:30:00.000Z',
            cursorAuditLogId: 'f2a3b4c5-6789-41bc-def0-234567890abc',
            limit: 6,
        });
    });

    test('400 when the cursor was not issued by this API', async () => {
        await expect(listAuditLogs({ cursor: 'garbage', limit: 20 })).rejects.toMatchObject({
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: { field: 'cursor' },
        });
        expect(listAuditLogRowsMock).not.toHaveBeenCalled();
    });
});
