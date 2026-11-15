# ADR 0006: Credential Flow Along the Lambda → RDS Proxy → Aurora Path

- **Status:** Proposed — under team review (see the ADR pull request for the objection window); schema-bootstrap decision recorded below
- **Date:** 2026-11-14
- **Decider:** Backend lead on a 3:1 majority in issue #22 (dissent recorded, partially adopted)
- **Consulted:** Cao Viet Anh (Worker/SES — dissenting vote), Hieu (Messaging), Phuong (Scheduling), Jamie (Frontend), MrMoi (Support/QA)

---

## Context

ADR-0005 settled the access path: every Lambda reaches Aurora Serverless v2 through **RDS Proxy using the `pg` driver**. That path contains **two separate logins**, each needing its own decision:

```
Lambda ──(login 1)──▶ RDS Proxy ──(login 2)──▶ Aurora PostgreSQL
```

Issue #22 (now closed) recorded the team's decisions on both logins, plus local development. Four of six members commented before close: three in favor of IAM authentication at the Proxy, one in favor of password delivery from Secrets Manager. The dissent contributed two sub-decisions adopted below.

## Decision

### D1 — Lambda → Proxy: IAM database authentication

Each Lambda authenticates to the Proxy with a **short-lived (~15 min) IAM auth token**, generated locally via SigV4 signing with the Lambda's execution role — no network call, no stored secret. Every DB connection requires **TLS** (`ssl: 'require'`). Tokens are cached per warm instance; the only database-related permission a Lambda role carries is `rds-db:connect` on the Proxy.

### D2 — Proxy → Aurora: Secrets Manager-managed credential

The Aurora cluster's master credential is **generated, stored and rotatable by Secrets Manager** (`ManageMasterUserPassword`) and is reserved for administrative/bootstrap use. The Proxy authenticates to Aurora as the dedicated least-privilege **`csep_app` DB user**, using its separate Secrets Manager secret through a role scoped to `secretsmanager:GetSecretValue` / `DescribeSecret`. Database users keep standard password authentication — **no `rds_iam` conversion** (IAM auth in front of the Proxy, password auth behind it is the supported combination).

Sub-decisions (adopted from the dissent):
- **Rotation: manual for the MVP**; automatic rotation is revisited after Sprint 1.
- The Proxy serves **`csep_app`**, a dedicated least-privilege DB user, not the master/interactive admin user; its secret is distinct from the managed master credential.

### D3 — Local development

Plain local Postgres with `DATABASE_URL` in a gitignored `.env`, plus a committed `.env.example` template. The Proxy, Secrets Manager and IAM token machinery are cloud-only concerns; the backend connect layer carries exactly one local/prod branch for this.

### D4 — Documentation

This ADR is the record. Implementation details live in the `csep-*` templates (`infra/*.yaml`, PR #23) and the backend connect layer; the bootstrap runbook lives in PR #23's `infra/README.md`.

### D5 — Schema bootstrap: one-off SSM host

Apply `db/schema.sql` from a temporary host reached through AWS Systems Manager Session Manager, connecting directly to Aurora from inside the VPC with the Secrets Manager-managed master credential. Remove the host after bootstrap; do not retain a permanent bastion. This path is only for bootstrap—the application continues through the Proxy as `csep_app`.

## Rationale

1. **No DB password in any Lambda environment.** With IAM tokens, a leaked Lambda env leaks nothing database-related. The rejected alternative places a usable DB password in every Lambda's env, guarded only by who can read the env.
2. **Short-lived, locally generated credentials.** Tokens expire in ~15 minutes and cost zero network round-trips to mint — unlike a static password delivered at cold start, or per-statement HTTPS signing under the (already rejected) Data API.
3. **Smallest permission surface.** `rds-db:connect` on one Proxy resource replaces `secretsmanager:GetSecretValue` + cache-invalidation discipline in every function that touches the database.
4. **No change on the database side.** Aurora users keep password auth; the Proxy's secret holds the credential. This avoids converting PostgreSQL users to `rds_iam`, which would break the Proxy's credential model.

## Alternatives considered

| Option | Verdict |
| :--- | :--- |
| **D1 (a): fetch DB password from Secrets Manager at cold start, cache in env** | Rejected on the 3:1 vote, but recorded as the **fallback**: it works unmodified with `pg`, needs no token code, and was the dissent's choice. Revisit trigger: if the IAM connect-layer change stalls past Sprint 1 or debugging cost proves too high, switching means one auth line in `infra/api.yaml` (`IAMAuth: OPTIONAL` + secret lookup) and removing the token step. |
| **IAM auth all the way through (no Proxy secret)** | Rejected: requires `rds_iam` on DB users, which conflicts with the Proxy's password-backed credential model and adds user-management burden for no project benefit. |
| **Data API (stateless IAM-signed HTTP)** | Rejected in ADR-0005; not reopened here. |

## Consequences

- **Backend connect layer** (the single seam from ADR-0005): generate an IAM token per connection attempt (cached per warm instance) and set `ssl: 'require'`; keep the D3 local branch. This is the one code change this ADR mandates.
- **`infra/api.yaml`**: `IAMAuth: REQUIRED` + `RequireTLS: true` on the Proxy; Lambda roles carry `rds-db:connect` and no `secretsmanager` permission. Already drafted in PR #23.
- **`infra/data.yaml`**: `ManageMasterUserPassword: true`; the Proxy uses the separate `csep_app` secret, while the managed master secret is reserved for bootstrap/admin use; manual rotation for the MVP (a scheduled rotation step is a Sprint 2 candidate).
- **Schema bootstrap**: use the temporary in-VPC SSM host from D5 and remove it after bootstrap. Operational steps belong in PR #23's `infra/README.md`.
- **Function-level AWS service permissions** (`ses:SendEmail`, `sqs:ReceiveMessage`, `events:CreateSchedule`, …) are **out of scope here** — they belong to the respective `infra/*.yaml` templates as they are written.

## References

- Issue #22: decision thread (closed 2026-11-14; 3:1 on D1, unanimous D2–D4)
- ADR-0001: Lambda runtime; ADR-0003: Aurora Serverless v2; ADR-0004: CloudFormation stacks; ADR-0005: RDS Proxy + `pg` access path
- PR #23: `csep-auth` / `csep-data` / `csep-api` templates implementing D1/D2/D3
