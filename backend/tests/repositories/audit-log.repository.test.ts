import type { Queryable } from '#db/connection';
import { insertAuditRecord } from '#repositories/audit-log.repository';

const tx: { query: jest.Mock } = { query: jest.fn() };

const asTx = (): Queryable => tx as unknown as Queryable;

beforeEach(() => {
    tx.query.mockReset();
    tx.query.mockResolvedValue({ rows: [], rowCount: 1 });
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
