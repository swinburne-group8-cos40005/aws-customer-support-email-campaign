import { loadEnv } from '../../src/config/env';

describe('loadEnv', () => {
    test('iam mode: DB coordinates without DATABASE_URL, port defaults to 5432', () => {
        const env = loadEnv({
            DB_HOST: 'csep-data-proxy.aws.com',
            DB_NAME: 'csep',
            DB_USER: 'csep_app',
            AWS_REGION: 'ap-southeast-2',
        });

        expect(env).toMatchObject({
            mode: 'iam',
            DB_HOST: 'csep-data-proxy.aws.com',
            DB_PORT: 5432,
            DB_NAME: 'csep',
            DB_USER: 'csep_app',
            AWS_REGION: 'ap-southeast-2',
        });
    });

    test('iam mode: explicit DB_PORT is coerced to a number', () => {
        const env = loadEnv({
            DB_HOST: 'h',
            DB_PORT: '5433',
            DB_NAME: 'csep',
            DB_USER: 'u',
            AWS_REGION: 'ap-southeast-2',
        });
        expect(env).toMatchObject({ mode: 'iam', DB_PORT: 5433 });
    });

    test('local mode: DATABASE_URL only', () => {
        expect(loadEnv({ DATABASE_URL: 'postgres://localhost:5432/csep' })).toEqual({
            mode: 'local',
            databaseUrl: 'postgres://localhost:5432/csep',
        });
    });

    test('throws a configuration error when neither mode is satisfied', () => {
        expect(() => loadEnv({})).toThrow('Database environment is not configured');
    });
});
