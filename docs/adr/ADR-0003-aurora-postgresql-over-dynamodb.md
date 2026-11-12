# ADR 0003: Amazon Aurora Serverless v2 PostgreSQL over Amazon DynamoDB

- **Status:** Accepted
- **Date:** 2026-10-24
- **Decider:** Dang Quang (Backend API & Database Lead)
- **Consulted:** Whole Project Team (Project A-B)

---

## Context
The AWS Customer Support Email Campaign Platform requires a persistence layer for customers, customer segments, campaigns, templates, email dispatch logs, delivery/bounce events, suppressions, and audit logs. The primary architectural choice was between Amazon Aurora PostgreSQL-Compatible Edition and Amazon DynamoDB.

## Decision
Use **Amazon Aurora PostgreSQL-Compatible Edition (Serverless v2)**.

## Rationale — Comparison Across Four Criteria

| Evaluation Criterion | Amazon Aurora PostgreSQL (Serverless v2) — *Chosen* | Amazon DynamoDB — *Rejected* |
| :--- | :--- | :--- |
| **1. Query Pattern Complexity (US04 Dashboard)** | Joins across `campaigns`, `email_logs`, and `email_events` are native SQL. Aggregations (bounce %, complaint %) are executed directly in the database. | Requires heavy denormalization or streaming to an auxiliary analytics store (e.g., OpenSearch/Athena) to compute joins and aggregations. |
| **2. Transactional Integrity & Idempotency (Risk R4)** | Supports strict `UNIQUE` constraints (`idempotency_key`) and atomic `UPDATE ... RETURNING` / `ON CONFLICT DO NOTHING` patterns to prevent duplicate sends. | Conditional writes exist but multi-step transactional coordination across multiple records is significantly more complex and costly. |
| **3. Schema Evolution & Risk (Risk R2)** | Enforces strict column typing, foreign-key cascades, and constraint validation, eliminating silent data corruption. | Schemaless nature allows rapid prototyping but makes silent data drift hard to detect without complex client-side validation. |
| **4. Cost at 10,000 emails/month Scale (Risk R6)** | Scales down automatically to minimum ACU when idle, keeping costs predictable and minimal during student prototyping. | Pay-per-request is inexpensive, but auxiliary services needed for indexing and aggregation add hidden costs. |

## Consequences
- Schema migrations require structured DDL scripts (`schema.sql`) tracked in Git.
- Lambda connections must be disciplined (close idle connections or utilize connection pooling).
- Eliminates the need for a separate analytics engine for the manager dashboard.

## References
- Project Plan Section 5 (Solution Approach)
- Risk Register: Risk R2 (Schema drift), Risk R4 (Duplicate sends), Risk R6 (AWS cost overrun)
