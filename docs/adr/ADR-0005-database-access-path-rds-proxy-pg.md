# ADR 0005: Database Access Path — RDS Proxy with the `pg` Driver over Aurora Data API

- **Status:** Accepted
- **Date:** 2026-11-12
- **Decider:** Project team consensus (issue #21)
- **Consulted:** Whole Project Team (Project A-B)

---

## Context

ADR-0003 chose Aurora Serverless v2 PostgreSQL as the database. That left one load-bearing question open: **how do our Lambdas talk to Aurora?** The answer determines the driver, the authentication mechanism, and the shape of every query in the system — it affects CRUD across the entire serverless platform, because every component that touches Aurora goes through this single seam:

| Component | DB pattern |
| :--- | :--- |
| Campaign API Lambdas (#5) | short transactions: INSERT/SELECT + audit row |
| Dispatcher (#6) | read segment, bulk INSERT `email_logs` |
| Worker (#3) | high-concurrency UPDATE on `email_logs` |
| Event Handler (#11) | webhook → INSERT event + conditional UPDATE |
| Dashboard queries (#12) | aggregation SQL |

Two options were compared in issue #21: **(A) RDS Proxy + `pg` driver** (stateful, Postgres wire protocol) vs **(B) Aurora Data API** (stateless, HTTPS per statement). All five team members supported Option A in the thread (2026-11-12).

## Decision

All Lambdas access Aurora Serverless v2 through **RDS Proxy using the `pg` driver over the Postgres wire protocol**.

```
Lambda ──▶ RDS Proxy ──▶ Aurora PostgreSQL (Serverless v2)
```

- RDS Proxy pools and reuses database connections across concurrent Lambda invocations.
- The shared DB access layer exposes one seam (`query` / `withTransaction`) that every handler uses; the driver choice lives only in that layer.
- The **Aurora Data API is rejected** for this project.

## Rationale

1. **Workload fit.** The Dispatcher performs bulk inserts into `email_logs` and the Worker performs high-concurrency updates. The wire protocol with pooled connections has lower per-query overhead than per-statement HTTPS calls, which add up in bulk loops.
2. **Native transactions.** Standard `BEGIN` / `COMMIT` / `ROLLBACK` work exactly as expected. The Data API instead requires explicit `BeginTransaction`/`CommitTransaction` calls that return a `transactionId`, and every statement in a "transaction" must carry that id — a discipline nobody has written and a recurring source of subtle bugs.
3. **Connection management.** RDS Proxy prevents connection exhaustion under Lambda concurrency bursts, which ADR-0001's consequences already anticipated ("connection pooling must be handled via RDS Proxy to prevent pool exhaustion").
4. **Cost correction from the discussion.** The Data API also requires Secrets Manager entries and IAM permissions for its credentials, so Option B's advertised "no secrets to manage" advantage was smaller than it first appeared. Option A's Secrets Manager requirement is a known, standard pattern.
5. **Local parity.** The wire protocol matches the SQL tested locally against Postgres (`tests/ddl-validation`), so local and cloud paths exercise the same SQL.

## Alternatives considered

| Option | Verdict |
| :--- | :--- |
| **B. Aurora Data API (stateless HTTPS)** | Rejected: higher per-call latency; non-native transaction model; no decisive advantage once its own Secrets Manager/IAM requirements are accounted for. Revisit only if fully stateless burst scaling later becomes a requirement. |
| **C. Hybrid (A for API Lambdas, B for the Worker)** | Rejected: two access paths in one codebase double the operational surface for no student-project benefit. One seam, one code path. |

## Consequences

- `infra/data.yaml` (stack `csep-data` per ADR-0004) provisions the Aurora Serverless v2 cluster **and the RDS Proxy**.
- `infra/api.yaml` wires each Lambda's `DATABASE_URL` (or equivalent) to the Proxy endpoint.
- Credential delivery along the two-hop path (Lambda → Proxy, Proxy → Aurora) is a separate decision, tracked in **issue #22** (proposed direction: IAM token auth in front of the Proxy, Secrets Manager behind it).
- Connection discipline matters: short-lived connections, connections released promptly, and Proxy sizing must cover expected Lambda concurrency.
- The DB access layer currently in the repository follows this decision as-is; it remains **unreviewed until it passes normal review** — this ADR settles the direction, not the code's baseline status.

## References

- Issue #21: decision thread and consensus (2026-11-12)
- ADR-0001: Lambda runtime; consequence anticipating RDS Proxy
- ADR-0003: Aurora Serverless v2 PostgreSQL choice
- ADR-0004: CloudFormation stacks (`csep-data`, `csep-api`) that implement this decision
- Issue #22: credential flow along the Lambda → Proxy → Aurora path
