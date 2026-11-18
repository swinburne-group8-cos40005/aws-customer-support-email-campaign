# Unit Test Evidence — template and segment endpoints (2026-11-18)

**What:** the eight template and segment routes from `docs/api-contract.md` §2.2 and §2.3 (issue #32, endpoint group 2/3):

| Endpoint | Unit coverage |
| :--- | :--- |
| `GET /templates` | list mapping, `{ data }` envelope |
| `POST /templates` | name/subject validation, insert + `create` audit in one transaction |
| `GET /templates/{id}` | 200, 404, 400 for a non-UUID path |
| `PUT /templates/{id}` | partial patch, empty patch rejected, before/after audit |
| `DELETE /templates/{id}` | unused-only delete, `409` when a campaign references it, `204`, `delete` audit |
| `GET /segments` | list mapping, rules round-trip |
| `POST /segments` | rules-as-JSONB insert, default `{}`, `create` audit |
| `POST /segments/{id}/preview` | `estimatedRecipients - suppressedExcluded = netAudience`, ISO `calculatedAt`, 404 |

The DB layer is mocked at the transaction seam (`runInTransaction`, `runReadQuery`); repositories are tested by asserting the SQL they issue and the params they bind.

**Commands:**

```sh
cd backend
npm run typecheck
npm test
npm run test:coverage
cfn-lint infra/api.yaml   # from the repository root
```

**Result:** 15 suites, **168 tests passed** (60 new in this group). Coverage **100% statements / 97.47% branches / 100% functions / 100% lines**. `cfn-lint` exits 0 on the updated `infra/api.yaml` (8 more Lambda functions, integrations, routes and invoke permissions).

**Full verbatim output (tail):**

```text
$ npm run test:coverage

> campaign-api@0.1.0 test:coverage
> jest --coverage

-------------------------------|---------|----------|---------|---------|-------------------
File                      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------------|---------|----------|---------|---------|-------------------
All files                 |     100 |    97.47 |     100 |     100 |
 config                   |     100 |      100 |     100 |     100 |
  env.ts                  |     100 |      100 |     100 |     100 |
 controllers              |     100 |      100 |     100 |     100 |
  campaign.controller.ts  |     100 |      100 |     100 |     100 |
  segment.controller.ts   |     100 |      100 |     100 |     100 |
  template.controller.ts  |     100 |      100 |     100 |     100 |
 handlers                 |     100 |      100 |     100 |     100 |
 repositories             |     100 |    95.08 |     100 |     100 |
  audit-log.repository.ts |     100 |      100 |     100 |     100 |
  campaign.repository.ts  |     100 |     93.1 |     100 |     100 | 271,301
  catalog.repository.ts   |     100 |      100 |     100 |     100 |
  email-log.repository.ts |     100 |      100 |     100 |     100 |
  segment.repository.ts   |     100 |      100 |     100 |     100 |
  template.repository.ts  |     100 |    95.65 |     100 |     100 | 208
 schemas                  |     100 |      100 |     100 |     100 |
 services                 |     100 |      100 |     100 |     100 |
  campaign.service.ts     |     100 |      100 |     100 |     100 |
  segment.service.ts      |     100 |      100 |     100 |     100 |
  template.service.ts     |     100 |      100 |     100 |     100 |
 utils                    |     100 |      100 |     100 |     100 |
--------------------------|---------|----------|---------|---------|-------------------

Test Suites: 15 passed, 15 total
Tests:       168 passed, 168 total
Snapshots:   0 total
Time:        10.689 s
Ran all test suites.
```

The handler block is collapsed above only for brevity — every handler file is at 100% in the full report.
