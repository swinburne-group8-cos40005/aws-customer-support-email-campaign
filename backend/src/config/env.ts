import { z } from 'zod';

/**
 * Environment contract for the campaign API Lambda.
 *
 * Two database modes exist on purpose (ADR-0005 / ADR-0006 D3):
 *  - `iam` (deployed): connection coordinates imported from the csep-data
 *    stack (infra/api.yaml). No password is ever configured; credentials
 *    are short-lived IAM tokens signed per connection by db/pool.ts.
 *  - `local` (development): plain DATABASE_URL to a local Postgres, as
 *    promised in infra/README.md design notes.
 *
 * AWS_REGION is injected by the Lambda runtime and only matters in `iam`
 * mode (the signer scopes tokens to the database's region).
 */
const iamModeSchema = z.object({
    DB_HOST: z.string().min(1, 'DB_HOST (RDS Proxy endpoint) is required'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_NAME: z.string().min(1, 'DB_NAME is required'),
    DB_USER: z.string().min(1, 'DB_USER is required'),
    DATABASE_URL: z.undefined().optional(),
    AWS_REGION: z.string().min(1, 'AWS_REGION is required in deployed Lambdas'),
});

const localModeSchema = z.object({
    DB_HOST: z.undefined().optional(),
    DB_PORT: z.undefined().optional(),
    DB_NAME: z.undefined().optional(),
    DB_USER: z.undefined().optional(),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL must not be empty'),
});

export type IamEnv = z.infer<typeof iamModeSchema> & { mode: 'iam' };
export type LocalEnv = { mode: 'local'; databaseUrl: string };
export type Env = IamEnv | LocalEnv;

/** Path is resolved from the package root; bundled next to the code at deploy. */
export const RDS_CA_BUNDLE_PATH = 'assets/rds-ca-global-bundle.pem';

/**
 * Parses and validates the process environment exactly once per Lambda
 * container. Two database modes exist on purpose (ADR-0005 / ADR-0006
 * D3): `iam` (deployed, credentials signed per connection) and `local`
 * (development, plain DATABASE_URL).
 *
 * @param source - Environment map to parse; defaults to process.env,
 *                 which is what the Lambda runtime provides.
 *
 * @returns A discriminated Env describing which mode is active.
 *
 * @throws Error When neither mode's variables are satisfied — this is a
 *         configuration defect, not a client problem, so it never
 *         becomes an HTTP response.
 *
 * @example
 * const env = loadDatabaseEnv()
 * console.log(env.mode)
 * // Output: 'iam'  when DB_HOST/DB_NAME/DB_USER/AWS_REGION are set
 * //         'local' when only DATABASE_URL is set
 */
export const loadDatabaseEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
    const iam = iamModeSchema.safeParse(source);
    if (iam.success) {
        return { mode: 'iam', ...iam.data };
    }

    const local = localModeSchema.safeParse(source);
    if (local.success) {
        return { mode: 'local', databaseUrl: local.data.DATABASE_URL };
    }

    const expected = [
        'iam mode: DB_HOST, DB_NAME, DB_USER (+ optional DB_PORT) and AWS_REGION',
        'local mode: DATABASE_URL',
    ].join(' — or — ');

    throw new Error(`Database environment is not configured. Expected ${expected}`);
};
