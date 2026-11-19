# Campaign API backend

TypeScript Lambdas backing the `/campaigns` endpoints (docs/api-contract.md
§2.1). The handler monolith was rewritten into horizontal layers so every
endpoint is added by following the same seams.

## Architecture

Request flow, outermost first:

```
Lambda event (HTTP API v2 + JWT authorizer)
        │
src/handlers/<route>.ts              Lambda entry: straight sequential pipeline
        │
src/http/                            auth -> controller -> error mapping -> logging
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
- `src/schemas/` — request/query schemas (single source of truth for §2.1 field rules).
- `src/utils/validation.ts` — one place that turns raw body/query/path values into
  validated input, so controllers stay thin.
- `src/utils/` — domain error classes (`ApiError` and friends) and HTTP response helpers.

Rules of thumb:

- Controllers never touch SQL; repositories never decide HTTP semantics
  (they answer questions like "does this exist", the service owns the 404).
- Every audit insert rides the same transaction as the mutation it
  describes (docs/audit-log-strategy.md §5, FR9).
- Error mapping happens exactly once, in mapErrorToResponse, using the
  contract envelope from docs/api-contract.md §1.3.
- One handler is a straight sequential pipeline — auth, controller,
  error mapping, logging as direct calls. No middleware framework.
- Internal imports use the package.json subpath aliases
  (`#utils/errors`, `#db/connection`, `#services/...`) instead of
  `../../` relative paths. TypeScript resolves them via
  `moduleResolution: node16`, Jest via `moduleNameMapper`, and the
  esbuild bundle at deploy time resolves the `imports` field natively.

## Implemented handlers

One Lambda per route, all bundled from this package; `infra/api.yaml` binds
each function to its exported handler name.

| Route | Handler file | Controller |
| :--- | :--- | :--- |
| `POST /v1/campaigns` | `create-campaign.handler` | `handleCreateCampaignRequest` |
| `GET /v1/campaigns` | `list-campaigns.handler` | `handleListCampaignsRequest` |
| `GET /v1/campaigns/{id}` | `get-campaign.handler` | `handleGetCampaignRequest` |
| `PUT /v1/campaigns/{id}` | `update-campaign.handler` | `handleUpdateCampaignRequest` |
| `DELETE /v1/campaigns/{id}` | `delete-campaign.handler` | `handleDeleteCampaignRequest` |
| `POST /v1/campaigns/{id}/schedule` | `schedule-campaign.handler` | `handleScheduleCampaignRequest` |
| `POST /v1/campaigns/{id}/send` | `send-campaign.handler` | `handleSendCampaignRequest` |
| `POST /v1/campaigns/{id}/cancel` | `cancel-campaign.handler` | `handleCancelCampaignRequest` |
| `GET /v1/campaigns/{id}/logs` | `list-campaign-logs.handler` | `handleListCampaignLogsRequest` |
| `GET /v1/templates` | `list-templates.handler` | `handleListTemplatesRequest` |
| `POST /v1/templates` | `create-template.handler` | `handleCreateTemplateRequest` |
| `GET /v1/templates/{id}` | `get-template.handler` | `handleGetTemplateRequest` |
| `PUT /v1/templates/{id}` | `update-template.handler` | `handleUpdateTemplateRequest` |
| `DELETE /v1/templates/{id}` | `delete-template.handler` | `handleDeleteTemplateRequest` |
| `GET /v1/segments` | `list-segments.handler` | `handleListSegmentsRequest` |
| `POST /v1/segments` | `create-segment.handler` | `handleCreateSegmentRequest` |
| `POST /v1/segments/{id}/preview` | `preview-segment.handler` | `handlePreviewSegmentRequest` |

State transitions follow `docs/email-state-machine.md`; the dispatcher
invocation itself belongs to the messaging stack (#26/#47), so `/send` owns
the `draft -> sending` transition and its audit row.

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
4. Controller function + one handler file per route (straight pipeline).
5. Route entry in `infra/api.yaml` pointing `Handler` at the new file.

Naming convention: functions use `verbNounNoun` camelCase
(`loadDatabaseEnv`, `insertCampaignRow`, `mapCampaignRowToResponse`,
`requireCognitoIdentity`) so a name states what the function does.
Non-exported helpers get a `_` prefix (`_createPool`,
`_extractCognitoSub`) so the export boundary is visible at a glance.
Within a file, imports are ordered default first, then type imports,
then value imports. They are grouped by domain — node builtins,
external packages, then one block per internal `#` alias — with a blank
line between each group and three blank lines before the first
declaration. An import with many names in `{}` breaks one name per
line (rule of thumb: more than two names, or a line over ~90
characters):
import type {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResult,
} from 'aws-lambda';
