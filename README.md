# Customer Support Email Campaign Platform

COS40005 Project 3.3 — a serverless platform for composing customer-support
email campaigns: draft a campaign against a validated catalog, approve it,
and let AWS deliver and track the sends. Built as a team of backend,
infrastructure, and frontend workstreams; this repository hosts the backend
service and all infrastructure as code.

## Architecture

```
browser (frontend, in progress)
   │  Cognito hosted UI (PKCE)
   ▼
csep-auth ── Cognito user pool + app client
   │  JWT
   ▼
csep-api ── HTTP API (payload v2) ── Lambda handlers (TypeScript)
   │                                        │  IAM token, no stored password
   │                                        ▼
   │                                   RDS Proxy ── Aurora Serverless v2 (PostgreSQL)
   ▼
csep-messaging (pending) ── EventBridge / SQS / SES delivery pipeline
csep-observability (pending) ── CloudWatch alarms + dashboards
```

Every cloud resource is declared in `infra/*.yaml` — six CloudFormation
stacks named `csep-<concern>`, cross-referenced with `Fn::ImportValue` and
deployed in a fixed order (ADR-0004). The deploy runbook, including the
database bootstrap through a temporary SSM tunnel, is in
[infra/README.md](infra/README.md).

## Repository map

| Path | Contents |
| :--- | :--- |
| `infra/` | CloudFormation templates for the `csep-*` stacks + deploy runbook |
| `backend/` | TypeScript Lambda backend, layered (handlers → controllers → services → repositories) — merging via #19 |
| `db/` | PostgreSQL schema and seed scripts |
| `docs/` | Specifications, ADRs, design notes, meeting minutes — indexed in [docs/README.md](docs/README.md) |
| `tests/` | DDL validation harness for `db/schema.sql` |
| `src/` | Python prototype, superseded by `backend/` (tracked in #41) |
| `early-prototype-design/` | Early UI design screenshots, kept as historical evidence |
| `.github/` | PR template, CODEOWNERS, CI workflows (`cfn-lint` on every PR touching `infra/*.yaml`) |

## Getting started

**Backend** (Node.js, TypeScript — `backend/`, in review as #19):

```sh
cd backend
npm install
npm test          # jest, with coverage thresholds enforced
```

See [backend/README.md](backend/README.md) for the layer architecture and
the request pipeline. Local development runs against a plain `DATABASE_URL`;
deployed Lambdas authenticate to the database with IAM tokens only.

**Infrastructure**: deploy the stacks in the documented order
`csep-artifact → csep-auth → csep-data → schema bootstrap → csep-api`,
following [infra/README.md](infra/README.md).

## Key documents

- [docs/api-contract.md](docs/api-contract.md) — REST contract: endpoint specs, error envelope
- [docs/email-state-machine.md](docs/email-state-machine.md) — campaign and email lifecycle
- [docs/erd.md](docs/erd.md) — database ERD
- The full index lives in [docs/README.md](docs/README.md)

## Conventions

Commits, PR titles, and branch names follow
[CONTRIBUTING.md](CONTRIBUTING.md): `<type>(<scope>): <subject> (#N)`,
one PR per issue, PR titles ending in `(Issue #N)`. All PRs require
moderator review (enforced by branch protection) and go through the
quality checklist in the PR template.
