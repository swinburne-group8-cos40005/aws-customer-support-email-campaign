# ADR 0001: Serverless AWS Lambda with Node.js/TypeScript over Containerized Express.js

- **Status:** Accepted
- **Date:** 2026-10-14
- **Decider:** Quang Thinh (Backend API & Database Lead)
- **Consulted:** Trong Hieu (Frontend), Viet Anh (Worker/SES)

---

## Context
The platform requires an API backend to manage campaigns, templates, customer segments, and audit logs. The primary architectural dilemma was choosing between a dedicated, containerized Express.js application (hosted on EC2/ECS) versus a serverless API surface powered by AWS API Gateway and AWS Lambda.

## Decision
Adopt **AWS Lambda with Node.js/TypeScript** orchestrated via Amazon API Gateway.

## Rationale
1. **Cost Efficiency at Prototype Scale:** The project assumes a baseline load of 10,000 emails/month with sporadic management activities. EC2 or ECS Fargate instances incur fixed 24/7 runtime costs, whereas AWS Lambda operates entirely within the AWS Free Tier (1M free requests/month).
2. **Operational Overhead:** Lambda eliminates OS patching, instance provisioning, and server capacity management.
3. **Cold Start & Latency:** Node.js/TypeScript on Lambda exhibits sub-150ms cold starts, which easily satisfies the dashboard's interactive requirements.

## Consequences
- Requires stateless execution patterns.
- Database connection pooling must be handled via Aurora Serverless connection limits or RDS Proxy to prevent pool exhaustion during Lambda scaling spikes.
```

---

### 4.2 `docs/adr/ADR-0002-asynchronous-queue-decoupling.md`

```markdown
# ADR 0002: Asynchronous Campaign Dispatching using Amazon EventBridge and SQS with DLQ

- **Status:** Accepted
- **Date:** 2026-10-18
- **Decider:** Dang Quang (Backend Lead), Phuong (Scheduling Lead), Viet Anh (Worker Lead)

---

## Context
Sending emails to a segment of up to 10,000 recipients cannot be performed synchronously within a single API request due to API Gateway's 29-second timeout and SES sending rate quotas (14–50 emails/second). The dispatch mechanism must be asynchronous, resilient, and fault-tolerant.

## Decision
Decouple campaign triggering and message dispatching using **Amazon EventBridge Scheduler $\rightarrow$ Dispatcher Lambda $\rightarrow$ Amazon SQS Standard Queue with Dead-Letter Queue (DLQ) $\rightarrow$ Worker Lambda**.

## Rationale
1. **Rate Limiting & Throttling Buffer:** Amazon SQS acts as a buffer between customer segmentation and Amazon SES, preventing SES `454 Throttling` exceptions.
2. **Resilience & Automatic Retries:** Failed dispatches remain in SQS with a visibility timeout and retry up to 3 times before routing to a DLQ for manual inspection.
3. **Decoupled Ownership:** Phuong manages the scheduling and enqueueing pipeline, while Viet Anh independently owns the SQS-to-SES Worker processor.

## Consequences
- Message ordering is not strictly guaranteed (mitigated because marketing email delivery order across different recipients is irrelevant).
- Requires strict idempotency enforcement on the Worker side to handle standard SQS at-least-once delivery guarantees.
```

---

### 4.3 `docs/adr/ADR-0003-aurora-postgresql-over-dynamodb.md`

```markdown
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