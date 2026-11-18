import type { Queryable } from '#db/connection';
import { runReadQuery } from '#db/connection';

import type { AuditLogRow } from '#repositories/audit-log.repository';
import {
    insertAuditRecord,
    listAuditLogRows,
    mapAuditLogRowToResponse,
} from '#repositories/audit-log.repository';




jest.mock('#db/connection', () => ({
    runReadQuery: jest.fn(),
}));

const runReadQueryMock = runReadQuery as jest.Mock;

const tx: { query: jest.Mock } = { query: jest.fn() };

const asTx = (): Queryable => tx as unknown as Queryable;

const AUDIT_LOG_ID = 'e1f2a3b4-5678-40ab-cdef-1234567890ab';

const auditRow = (): AuditLogRow => ({
    audit_log_id: AUDIT_LOG_ID,
    user_id: 'usr-agent-1',
    action: 'schedule',
    entity_type: 'campaign',
    entity_id: '33333333-3333-4000-8000-000000000009',
    changes: { before: { status: 'draft' }, after: { status: 'scheduled' } },
    created_at: '2026-10-25T14:30:00.000Z',
});

beforeEach(() => {
    tx.query.mockReset();
    tx.query.mockResolvedValue({ rows: [], rowCount: 1 });
    runReadQueryMock.mockReset();
});

describe('insertAuditRecord', () => {
    test('writes one row with action and a jsonb before/after snapshot', async () => {
        await insertAuditRecord(asTx(), {
            userId: 'usr-agent-1',
            action: 'create',
            entityType: 'campaign',
            entityId: '33333333-3333-4000-8000-000000000009',
            changes: { before: null, after: { status: 'draft' } },
        });

        const [text, params] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('INSERT INTO audit_logs');
        expect(params[0]).toBe('usr-agent-1');
        expect(params[1]).toBe('create');
        expect(params[2]).toBe('campaign');
        expect(params[3]).toBe('33333333-3333-4000-8000-000000000009');
        // Changes travel as a JSON string; the ::jsonb cast in the SQL
        // turns it into a jsonb column value.
        expect(JSON.parse(params[4] as string)).toEqual({
            before: null,
            after: { status: 'draft' },
        });
    });
});

describe('listAuditLogRows', () => {
    test('binds every filter plus the keyset position and the limit', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [auditRow()], rowCount: 1 });

        const rows = await listAuditLogRows({
            entityType: 'campaign',
            entityId: '33333333-3333-4000-8000-000000000009',
            userId: 'usr-agent-1',
            cursorCreatedAt: '2026-10-25T14:30:00.000Z',
            cursorAuditLogId: AUDIT_LOG_ID,
            limit: 21,
        });

        const [text, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('(created_at, audit_log_id) <');
        expect(text).toContain('ORDER BY created_at DESC, audit_log_id DESC');
        expect(params).toEqual([
            'campaign',
            '33333333-3333-4000-8000-000000000009',
            'usr-agent-1',
            '2026-10-25T14:30:00.000Z',
            AUDIT_LOG_ID,
            21,
        ]);
        expect(rows).toHaveLength(1);
    });

    test('passes NULL for every omitted filter and cursor', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        const rows = await listAuditLogRows({ limit: 20 });

        const [, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(params).toEqual([null, null, null, null, null, 20]);
        expect(rows).toEqual([]);
    });
});

describe('mapAuditLogRowToResponse', () => {
    test('maps the snake_case row onto the contract entry (§2.5)', () => {
        expect(mapAuditLogRowToResponse(auditRow())).toEqual({
            auditLogId: AUDIT_LOG_ID,
            userId: 'usr-agent-1',
            action: 'schedule',
            entityType: 'campaign',
            entityId: '33333333-3333-4000-8000-000000000009',
            changes: { before: { status: 'draft' }, after: { status: 'scheduled' } },
            createdAt: '2026-10-25T14:30:00.000Z',
        });
    });
});
