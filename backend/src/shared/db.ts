import { Pool, PoolClient } from 'pg';
import { NotFoundError } from './errors';

export interface Row {
  [key: string]: unknown;
}
export interface QueryResult {
  rows: Row[];
  rowCount: number | null;
}
export interface Queryable {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
}

let pool: Pool | null = null;

/** Lazily created; reused across warm Lambda invocations. */
export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

/**
 * Runs fn inside a single transaction. audit_logs inserts ride the same
 * transaction as the mutation they describe (docs/audit-log-strategy.md §5):
 * if the mutation fails, the audit row rolls back with it.
 */
export async function withTransaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client as unknown as Queryable);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // connection already unusable; releasing below is still required
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * SELECT existence check -> 404 when missing (docs/api-contract.md §1.3).
 * table/column come from handler code only, never from request input.
 */
export async function mustExist(
  tx: Queryable,
  table: 'templates' | 'segments',
  column: 'template_id' | 'segment_id',
  id: string,
  entity: string,
): Promise<void> {
  const res = await tx.query(`SELECT 1 AS found FROM ${table} WHERE ${column} = $1`, [id]);
  if (!res.rows[0]) {
    throw new NotFoundError(entity, id);
  }
}
