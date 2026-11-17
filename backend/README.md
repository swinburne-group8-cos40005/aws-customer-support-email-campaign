# Campaign API backend

TypeScript Lambda backing `POST /v1/campaigns` (US01, docs/api-contract.md §2.1).
The handler monolith was rewritten into horizontal layers so the remaining
endpoints can be added by following the same seams.

## Architecture

Request flow, outermost first:

```
Lambda event (HTTP API v2 + JWT authorizer)
        │
src/handlers/create-campaign.ts      Lambda entry: composes middleware + controller
        │
src/middleware/                      Express-style chain: (event, state, next)
        │
src/controllers/                     decode body, validate (zod), delegate, shape response
        │
src/services/                        business rules, owns the transaction
        │
src/repositories/                    all SQL lives here
        │
src/db/connection.ts                 pg Pool, IAM auth, strict TLS, runInTransaction
```

Supporting layers:

- `src/config/env.ts` — zod-validated environment contract, parsed once per container.
- `src/schemas/` — request-body schemas (single source of truth for §2.1 field rules).
- `src/utils/` — domain error classes (`ApiError` and friends) and HTTP response helpers.

Rules of thumb:

- Controllers never touch SQL; repositories never decide HTTP semantics
  (they answer questions like "does this exist", the service owns the 404).
- Every audit insert rides the same transaction as the mutation it
  describes (docs/audit-log-strategy.md §5, FR9).
- Error mapping happens exactly once, in the error-boundary middleware,
  using the contract envelope from docs/api-contract.md §1.3.
- Middleware are composed Express-style, without Express: each stage is
  `async (event, state, next) => ...` and the chain is a plain array in
  the handler file (outermost first), passed to `composeMiddleware`.

## Database connectivity (two modes)

| Mode | When | Auth |
| --- | --- | --- |
| `iam` | Deployed Lambda (RDS Proxy, ADR-0005) | 15-minute IAM token signed per connection via `@aws-sdk/rds-signer`; no password anywhere |
| `local` | Local development (ADR-0006 D3) | plain `DATABASE_URL` |

Required env in `iam` mode: `DB_HOST` (Proxy endpoint), `DB_NAME`, `DB_USER`,
`AWS_REGION` (optional `DB_PORT`, defaults 5432). In `local` mode: `DATABASE_URL`.

Transport security in `iam` mode is strict TLS: `rejectUnauthorized: true`
with the RDS CA bundle pinned at `backend/assets/rds-ca-global-bundle.pem`
(refresh it alongside RDS CA rotation; it is the same file AWS publishes at
the RDS trust store). A missing/invalid certificate fails the connection —
it is never bypassed.

The pool is created lazily and reused across warm invocations, capped at
2 clients per container because the Proxy does the real pooling.

## Tests

```
npm test                # unit suite
npm run test:coverage   # thresholds: 95% statements / 90% branches / 100% functions / 95% lines
```

Coverage excludes `src/db/connection.ts` (connection plumbing; exercised by
integration tests against the seeded Aurora/pg container instead). Layers
are tested at their own seams:

- `tests/handlers/` — composed handler on the real v2 event shape, service mocked.
- `tests/services/` — business rules with transaction + repositories mocked.
- `tests/repositories/` — SQL text, parameters, and row mapping.
- `tests/config/` — environment contract.

## Adding the next endpoint

1. Repository functions for the new SQL.
2. Service function owning rules + transaction + audit.
3. zod schema in `src/schemas/`.
4. Controller + handler file declaring the middleware array
   (`composeMiddleware(middleware, controller)`).
5. Route entry in `infra/api.yaml` pointing `Handler` at the new file.

Naming convention: functions use `verbNounNoun` camelCase
(`loadDatabaseEnv`, `insertCampaignRow`, `mapCampaignRowToResponse`,
`requireCognitoIdentity`) so a name states what the function does.
