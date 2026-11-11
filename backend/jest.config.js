/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/**/*.ts'],
  // db.ts is connection plumbing (Pool/BEGIN/COMMIT/ROLLBACK). Unit tests mock
  // it by design; it is exercised by integration tests against the seeded
  // Aurora/pg container instead.
  coveragePathIgnorePatterns: ['<rootDir>/src/shared/db.ts'],
  coverageThreshold: {
    global: { statements: 95, branches: 90, functions: 100, lines: 95 },
  },
};
