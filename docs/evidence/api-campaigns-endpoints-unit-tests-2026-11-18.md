# Unit Test Evidence — campaign endpoints (2026-11-18)

**What:** the eight remaining `/campaigns` routes from `docs/api-contract.md` §2.1 (issue #32, endpoint group 1/3):

| Endpoint | Unit coverage |
| :--- | :--- |
| `GET /campaigns` | status/page/limit validation, pagination block, offset maths |
| `GET /campaigns/{id}` | detail with template + segment summaries, 404 |
| `PUT /campaigns/{id}` | draft-only patch, catalog re-check, `409` for non-draft, audit before/after |
| `DELETE /campaigns/{id}` | draft-only delete, `204`, audit `delete`, `409` for non-draft |
| `POST /campaigns/{id}/schedule` | 5-minute lead rule, `400`/`404`/`409`, audit `schedule` |
| `POST /campaigns/{id}/send` | draft → `sending`, `dispatchMode: immediate`, audit `send` |
| `POST /campaigns/{id}/cancel` | scheduled-only, `409` once due, audit `cancel` |
| `GET /campaigns/{id}/logs` | log mapping, 404 for a missing campaign |

The DB layer is mocked at the transaction seam (`runInTransaction`, `runReadQuery`) exactly as in the PR #19 pattern: repositories are unit-tested by asserting the SQL they issue and the params they bind, services by asserting the transaction steps and audit snapshots, handlers by driving a v2 API Gateway event through the full pipeline (auth → controller → service boundary → error mapping → logging).

**Commands:**

```sh
cd backend
npm run typecheck    # tsc --noEmit
npm test             # jest
npm run test:coverage
cfn-lint infra/api.yaml   # run from the repository root
```

**Result:** 9 suites, **108 tests passed** (79 new). Coverage **100% statements / 97.36% branches / 100% functions / 100% lines**, above the 95/90/100/95 thresholds in `jest.config.js`. `src/db/connection.ts` remains excluded by design (connection plumbing exercised by integration tests). `cfn-lint` exits 0 on the updated `infra/api.yaml`.

**Full verbatim output (coverage run, tail):**

```text
$ npm run test:coverage

> campaign-api@0.1.0 test:coverage
> jest --coverage

-------------------------------|---------|----------|---------|---------|-------------------
File                      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
--------------------------|---------|----------|---------|---------|-------------------
All files                 |     100 |    97.36 |     100 |     100 |                   
 config                   |     100 |      100 |     100 |     100 |                   
  env.ts                  |     100 |      100 |     100 |     100 |                   
 controllers              |     100 |      100 |     100 |     100 |                   
  campaign.controller.ts  |     100 |      100 |     100 |     100 |                   
 handlers                 |     100 |      100 |     100 |     100 |                   
  cancel-campaign.ts      |     100 |      100 |     100 |     100 |                   
  create-campaign.ts      |     100 |      100 |     100 |     100 |                   
  delete-campaign.ts      |     100 |      100 |     100 |     100 |                   
  get-campaign.ts         |     100 |      100 |     100 |     100 |                   
  list-campaign-logs.ts   |     100 |      100 |     100 |     100 |                   
  list-campaigns.ts       |     100 |      100 |     100 |     100 |                   
  schedule-campaign.ts    |     100 |      100 |     100 |     100 |                   
  send-campaign.ts        |     100 |      100 |     100 |     100 |                   
  update-campaign.ts      |     100 |      100 |     100 |     100 |                   
 http                     |     100 |      100 |     100 |     100 |                   
  auth.ts                 |     100 |      100 |     100 |     100 |                   
  error-mapping.ts        |     100 |      100 |     100 |     100 |                   
  request-logging.ts      |     100 |      100 |     100 |     100 |                   
 repositories             |     100 |     93.1 |     100 |     100 |                   
  audit-log.repository.ts |     100 |      100 |     100 |     100 |                   
  campaign.repository.ts  |     100 |     93.1 |     100 |     100 | 271,301           
  catalog.repository.ts   |     100 |      100 |     100 |     100 |                   
  email-log.repository.ts |     100 |      100 |     100 |     100 |                   
 schemas                  |     100 |      100 |     100 |     100 |                   
  campaign.schema.ts      |     100 |      100 |     100 |     100 |                   
 services                 |     100 |      100 |     100 |     100 |                   
  campaign.service.ts     |     100 |      100 |     100 |     100 |                   
 utils                    |     100 |      100 |     100 |     100 |                   
  errors.ts               |     100 |      100 |     100 |     100 |                   
  http.ts                 |     100 |      100 |     100 |     100 |                   
  validation.ts           |     100 |      100 |     100 |     100 |                   
--------------------------|---------|----------|---------|---------|-------------------

Test Suites: 9 passed, 9 total
Tests:       108 passed, 108 total
Snapshots:   0 total
Time:        6.763 s, estimated 17 s
Ran all test suites.
```

**Infrastructure check:**

```text
$ cfn-lint infra/api.yaml
$ echo $?
0
```

Eight Lambda functions, integrations, routes and invoke permissions were added to `infra/api.yaml` (one function per route, matching the existing `CreateCampaignFunction` pattern); every handler is bound to the same packaged bundle through its own `Handler:` value.
