import type { PoolClient } from 'pg';

import type { Env } from '#config/env';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Signer } from '@aws-sdk/rds-signer';
import { Pool } from 'pg';

import { loadDatabaseEnv, RDS_CA_BUNDLE_PATH } from '#config/env';




export interface Row {
    [key: string]: unknown;
}

export interface QueryResult {
    rows: Row[];
    rowCount: number | null;
}

/**
 * The narrow surface repositories are allowed to use. Hiding PoolClient
 * behind this interface keeps the transaction seam mockable in tests and
 * prevents repository code from reaching into driver internals.
 */
export interface Queryable {
    query(text: string, values?: unknown[]): Promise<QueryResult>;
}

let pool: Pool | null = null;

const _createPool = (env: Env): Pool => {
    if (env.mode === 'local') {
        // Local dev only (ADR-0006 D3): plain connection string to a
        // local Postgres; no IAM, no TLS requirement.
        return new Pool({ connectionString: env.databaseUrl });
    }

    // IAM token (ADR-0005, issue #22): signed per new connection by the
    // Lambda's own execution role. Tokens are valid for 15 minutes, so a
    // warm container renewing them per connect is never expired mid-use.
    const signer = new Signer({
        hostname: env.DB_HOST,
        port: env.DB_PORT,
        username: env.DB_USER,
        region: env.AWS_REGION,
    });

    return new Pool({
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: () => signer.getAuthToken(),
        // Lambda containers are short-lived and the Proxy does the real
        // pooling (ADR-0001 consequence / ADR-0005). Two clients is a
        // safe ceiling per container without stressing the Proxy.
        max: 2,
        ssl: {
            // Strict TLS (issue #22): fail closed on certificate
            // validation instead of silently accepting any cert.
            rejectUnauthorized: true,
            // Public trust store pinned in-repo; refresh alongside
            // ADR reviews so rotation cannot surprise a demo.
            ca: readFileSync(resolve(RDS_CA_BUNDLE_PATH), 'utf8'),
        },
        connectionTimeoutMillis: 10_000,
    });
};

/**
 * Lazily creates the process-wide Pool and reuses it across warm Lambda
 * invocations. In iam mode every new connection gets a freshly signed
 * IAM token; in local mode it connects with DATABASE_URL.
 *
 * @returns The shared pg Pool for this container.
 *
 * @throws Error When the environment satisfies neither mode
 *         (propagated from loadDatabaseEnv).
 *
 * @example
 * const pool = getDatabasePool()
 * console.log(pool.totalCount) // Output: 0 — rises only once the first
 *                              //         connection is actually opened
 */
export const getDatabasePool = (): Pool => {
    if (!pool) {
        pool = _createPool(loadDatabaseEnv());
    }
    return pool;
};

/**
 * Read helper for GET endpoints: runs one statement on the shared pool
 * and returns the same narrow QueryResult repositories already speak.
 * No transaction — reads never need BEGIN/COMMIT and the Proxy pools
 * the real connections (ADR-0005).
 *
 * @param text - SQL statement with $1..$n placeholders.
 * @param values - Positional values for those placeholders.
 *
 * @returns Rows and affected-row count exactly as the driver reports them.
 *
 * @example
 * const result = await runReadQuery('SELECT COUNT(*) AS count FROM campaigns')
 * console.log(Number(result.rows[0].count)) // Output: 12
 */
export const runReadQuery = async (text: string, values?: unknown[]): Promise<QueryResult> => {
    const result = await getDatabasePool().query(text, values);

    return {
        rows: result.rows as Row[],
        rowCount: result.rowCount,
    };
};

/**
 * Closes the pool and forgets it, so the next getDatabasePool call
 * builds a fresh one. Used by integration tests between scenarios.
 *
 * @example
 * await closeDatabasePool()
 * console.log('pool closed') // Output: 'pool closed' — the next
 *                            // getDatabasePool() builds a fresh pool
 */
export const closeDatabasePool = async (): Promise<void> => {
    if (pool) {
        await pool.end();
        pool = null;
    }
};

/**
 * Runs fn inside a single transaction: BEGIN, fn, COMMIT — and ROLLBACK
 * when fn throws or the COMMIT fails. audit_logs inserts ride the same
 * transaction as the mutation they describe (docs/audit-log-strategy.md
 * §5): if the mutation fails, the audit row rolls back with it.
 *
 * @param fn - Callback receiving the transaction-scoped Queryable; all
 *             of its SQL must run through that handle.
 *
 * @returns Whatever fn resolves with.
 *
 * @throws Unknown Whatever fn throws, after the ROLLBACK — callers see
 *         the original business error, never a transaction artifact.
 *
 * @example
 * const row = await runInTransaction(async (tx) => {
 *     const created = await insertCampaignRow(tx, input)
 *     await insertAuditRecord(tx, auditEntry)
 *     return created
 * })
 * console.log(row.status) // Output: 'draft' — committed only when every
 *                         // step succeeded; any throw rolls it all back
 */
export async function runInTransaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const client: PoolClient = await getDatabasePool().connect();
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
