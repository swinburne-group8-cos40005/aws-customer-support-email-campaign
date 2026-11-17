/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    collectCoverageFrom: ['src/**/*.ts'],
    // db/connection.ts is connection plumbing (IAM signer, Pool, BEGIN/
    // COMMIT/ROLLBACK). Unit tests mock it by design; it is exercised by
    // integration tests against the seeded Aurora/pg container instead.
    coveragePathIgnorePatterns: ['<rootDir>/src/db/connection.ts'],
    coverageThreshold: {
        global: { statements: 95, branches: 90, functions: 100, lines: 95 },
    },
};
