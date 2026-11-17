import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Signer } from '@aws-sdk/rds-signer';
import { Pool, type PoolClient } from 'pg';
import { loadEnv, RDS_CA_BUNDLE_PATH, type Env } from '../config/env';

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

const createPool = (env: Env): Pool => {
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

/** Lazily created; reused across warm Lambda invocations. */
export const getPool = (): Pool => {
    if (!pool) {
        pool = createPool(loadEnv());
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
