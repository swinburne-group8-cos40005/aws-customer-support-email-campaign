# Unit Test Evidence — preference and audit-log endpoints (2026-11-18)

**What:** the three remaining routes from `docs/api-contract.md` §2.4 and §2.5 (issue #32, endpoint group 3/3):

| Endpoint | Unit coverage |
| :--- | :--- |
| `GET /customers/{id}/preferences` | opted-in vs opted-out mapping, `lower(trim(email))` lookup, 404, non-UUID path |
| `PUT /customers/{id}/preferences` | opt-out upsert with default and explicit reason, opt-in delete, `409` for `bounce`/`complaint`, before/after audit snapshots |
| `GET /audit-logs` | keyset cursor encode/decode, `limit + 1` page probe, `nextCursor` only when another page exists, filters, `400` for bad filters and forged cursors |

Supporting units added in this group:

| File | Responsibility covered |
| :--- | :--- |
| `src/utils/cursor.ts` | base64url round-trip, malformed base64/JSON, non-UUID id, non-ISO timestamp |
| `src/repositories/customer.repository.ts` | customer lock/read, suppression read (pool and `FOR UPDATE`), upsert, delete |
| `src/repositories/audit-log.repository.ts` | keyset query (params and order), row mapping, NULL filters |
| `src/schemas/preference.schema.ts` | `isOptedOut` required, API-writable reasons only, `reason` rejected on opt-in |
| `src/schemas/audit-log.schema.ts` | entity-type enum matching the table CHECK, UUID `entityId`, `limit` 1..100 |

The DB layer is mocked at the transaction seam (`runInTransaction`, `runReadQuery`); repositories are tested by asserting the SQL they issue and the params they bind, services by asserting the transaction steps and audit snapshots, handlers by driving a v2 API Gateway event through the full pipeline (auth → controller → service boundary → error mapping → logging).

**Commands:**

```sh
cd backend
npm run typecheck
npm test
npm run test:coverage
cfn-lint infra/api.yaml   # from the repository root
```

**Result:** 20 suites, **220 tests passed** (52 new in this group). Coverage **100% statements / 97.57% branches / 100% functions / 100% lines**, above the 95/90/100/95 thresholds in `jest.config.js`. `cfn-lint` exits 0 on the updated `infra/api.yaml` (3 more Lambda functions, integrations, routes and invoke permissions).

**Coverage of the files this group adds (verbatim excerpt):**

```text
---------------------------------|---------|----------|---------|---------|-------------------
File                             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
---------------------------------|---------|----------|---------|---------|-------------------
All files                        |     100 |    97.57 |     100 |     100 |
  audit-log.controller.ts        |     100 |      100 |     100 |     100 |
  preference.controller.ts       |     100 |      100 |     100 |     100 |
  get-customer-preferences.ts    |     100 |      100 |     100 |     100 |
  list-audit-logs.ts             |     100 |      100 |     100 |     100 |
  update-customer-preferences.ts |     100 |      100 |     100 |     100 |
  audit-log.repository.ts        |     100 |      100 |     100 |     100 |
  customer.repository.ts         |     100 |     90.9 |     100 |     100 | 192
  audit-log.schema.ts            |     100 |      100 |     100 |     100 |
  preference.schema.ts           |     100 |      100 |     100 |     100 |
  audit-log.service.ts           |     100 |      100 |     100 |     100 |
  preference.service.ts          |     100 |      100 |     100 |     100 |
  cursor.ts                      |     100 |      100 |     100 |     100 |
---------------------------------|---------|----------|---------|---------|-------------------
```

**Behaviour decisions exercised by the tests:**

1. **Suppression table is the opt-out record.** `GET` answers `isOptedOut` from membership of `email_suppressions`; there is no `is_opted_out` column on `customers` (`db/schema.sql`).
2. **Opting in refuses deliverability suppressions.** A row with reason `bounce` or `complaint` was written by SES feedback, so `PUT { "isOptedOut": false }` answers `409 CONFLICT` instead of deleting it — the preference endpoint must not resurrect an undeliverable address.
3. **Cursor is opaque.** Anything not issued by `encodeAuditCursor` answers `400 VALIDATION_ERROR` with `details.field = "cursor"`; the service rejects it before touching the database.
4. **No empty trailing page.** The repository is asked for `limit + 1` rows; `nextCursor` is emitted only when that extra row proves another page exists.
