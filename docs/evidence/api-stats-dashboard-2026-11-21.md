# Evidence — statistics API and reporting dashboard (2026-11-21)

**What:** US04 & US05 (issue #12, application scope). `GET /v1/stats/overview` and
`GET /v1/campaigns/{id}/stats` (`docs/api-contract.md` §2.6, v1.2.0), their Lambdas,
routes and invoke permissions in `infra/api.yaml`, and the live reporting dashboard
that replaces the mock Overview numbers.

## Backend

| Layer | File | Covered by |
| :--- | :--- | :--- |
| Handler | `src/handlers/get-stats-overview.ts`, `get-campaign-stats.ts` | `tests/handlers/stats-routes.test.ts` (200, 400, 401, 404, 500) |
| Controller | `src/controllers/stats.controller.ts` | same suite, through the full handler pipeline |
| Service | `src/services/stats.service.ts` | `tests/services/stats.service.test.ts` (rates, null rates, thresholds, history, 404) |
| Repository | `src/repositories/stats.repository.ts` | `tests/repositories/stats.repository.test.ts` (SQL + params, empty rows) |
| Schema | `src/schemas/stats.schema.ts` | `tests/schemas/stats.schema.test.ts` (`limit` default, coercion, 1..50) |

Behaviour fixed by the contract and asserted in tests: rates are `null` when `sent = 0`
(no data is not "perfect"), alert levels come from server-side thresholds returned in the
response, and the status history is built from `audit_logs` plus one final system entry.

**Commands**

```sh
cd backend
npm run typecheck
npm run test:coverage
cfn-lint infra/api.yaml      # from the repository root
```

**Jest / coverage / cfn-lint output:** _paste the terminal output of the three commands above here before opening the PR._

## Frontend

`OverviewPage` loads `GET /v1/stats/overview` and, on selecting a campaign,
`GET /v1/campaigns/{id}/stats`. Screenshots were taken against a mocked API that returns
the contract's example payloads plus warning/critical campaigns.

| Screenshot | Shows |
| :--- | :--- |
| `stats-dashboard/01-dashboard-alerts.png` | KPI cards, alert banner, status breakdown, per-campaign successful vs failed bars, bounce/complaint indicators |
| `stats-dashboard/02-campaign-detail-history.png` | One campaign: counters, outcome bar, rates vs thresholds, status history |
| `stats-dashboard/03-dark-theme-detail.png` | Same screen in the dark theme |
| `stats-dashboard/04-mobile.png` | 390 px wide layout |
| `stats-dashboard/05-unauthenticated.png` | 401: sign-in message and token field |
| `stats-dashboard/06-api-error.png` | 503 `DB_UNAVAILABLE`: server message and retry |
| `stats-dashboard/07-empty.png` | No campaigns yet |
| `stats-dashboard/08-healthy-no-banner.png` | All rates healthy: no banner |
