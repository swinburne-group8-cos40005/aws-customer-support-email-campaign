# Unit Test Evidence — POST /campaigns handler (2026-11-11)

**What:** Jest unit tests for `backend/src/handlers/create-campaign.ts` (Issue #5, endpoint 1/9). DB layer mocked (`withTransaction`); every acceptance path of `docs/api-contract.md` §2.1 `POST /campaigns` is exercised: 201 draft creation, audit `create` row in the same transaction, 401/400/404/500 envelopes.

**Command:** `cd backend && npm run test:coverage` (Jest 29 + ts-jest, Node 22)

**Result:** 12 tests passed. Coverage: 100% statements, 100% functions, 100% lines, 94.44% branches (thresholds 95/90/100/95). `src/shared/db.ts` is excluded from the threshold by design — it is connection plumbing (Pool/BEGIN/COMMIT/ROLLBACK) covered by integration tests; see `jest.config.js` comment.

**Full verbatim output:**

```text

> campaign-api@0.1.0 test:coverage
> jest --coverage

  console.error
    unhandled error Error: connection refused
        at Object.<anonymous> (/home/zen/Documents/aws-customer-support-email-campaign/backend/tests/create-campaign.test.ts:172:55)
        at Promise.then.completed (/home/zen/Documents/aws-customer-support-email-campaign/backend/node_modules/jest-circus/build/utils.js:298:28)
        at new Promise (<anonymous>)
        at callAsyncCircusFn (/home/zen/Documents/aws-customer-support-email-campaign/backend/node_modules/jest-circus/build/utils.js:231:10)
        at _callCircusTest (/home/zen/Documents/aws-customer-support-email-campaign/backend/node_modules/jest-circus/build/run.js:316:40)
        at _runTest (/home/zen/Documents/aws-customer-support-email-campaign/backend/node_modules/jest-circus/build/run.js:252:3)
        at _runTestsForDescribeBlock (/home/zen/Documents/aws-customer-support-email-campaign/backend/node_modules/jest-circus/build/run.js:126:9)
        at _runTestsForDescribeBlock (/home/zen/Documents/aws-customer-support-email-campaign/backend/node_modules/jest-circus/build/run.js:121:9)
        at run (/home/zen/Documents/aws-customer-support-email-campaign/backend/node_modules/jest-circus/build/run.js:71:3)
        at runAndTransformResultsToJestFormat (/home/zen/Documents/aws-customer-support-email-campaign/backend/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapterInit.js:122:21)
        at jestAdapter (/home/zen/Documents/aws-customer-support-email-campaign/backend/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapter.js:79:19)
        at runTestInternal (/home/zen/Documents/aws-customer-support-email-campaign/backend/node_modules/jest-runner/build/runTest.js:367:16)
        at runTest (/home/zen/Documents/aws-customer-support-email-campaign/backend/node_modules/jest-runner/build/runTest.js:444:34)

      24 |     return fail(err.statusCode, err.code, err.message, err.details);
      25 |   }
    > 26 |   console.error('unhandled error', err);
         |           ^
      27 |   return fail(500, 'INTERNAL_ERROR', 'Unexpected server error.');
      28 | };
      29 |

      at error (src/shared/response.ts:26:11)
      at handler (src/handlers/create-campaign.ts:92:27)
      at Object.<anonymous> (tests/create-campaign.test.ts:173:17)

PASS tests/create-campaign.test.ts
  POST /campaigns
    ✓ 201: creates campaign in draft, returns camelCase body (4 ms)
    ✓ campaign INSERT hard-codes draft and stores created_by from the token (2 ms)
    ✓ audit_logs row rides the same transaction: action=create + before/after diff (1 ms)
    ✓ 401: missing Cognito claims (1 ms)
    ✓ 400: invalid JSON body (1 ms)
    ✓ 400: missing name (1 ms)
    ✓ 400: name longer than 150 characters
    ✓ 400: templateId is not a UUID (1 ms)
    ✓ 400: segmentId is not a UUID (1 ms)
    ✓ 404: template does not exist (1 ms)
    ✓ 404: segment does not exist (1 ms)
    ✓ 500: unexpected database failure maps to INTERNAL_ERROR (29 ms)

---------------------|---------|----------|---------|---------|-------------------
File                 | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
---------------------|---------|----------|---------|---------|-------------------
All files            |     100 |    94.44 |     100 |     100 |                   
 handlers            |     100 |     92.3 |     100 |     100 |                   
  create-campaign.ts |     100 |     92.3 |     100 |     100 | 32                
 shared              |     100 |      100 |     100 |     100 |                   
  auth.ts            |     100 |      100 |     100 |     100 |                   
  errors.ts          |     100 |      100 |     100 |     100 |                   
  response.ts        |     100 |      100 |     100 |     100 |                   
---------------------|---------|----------|---------|---------|-------------------
Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
Snapshots:   0 total
Time:        2.02 s
Ran all test suites.
```
