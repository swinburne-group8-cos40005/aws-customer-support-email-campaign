# ADR 0004: AWS CloudFormation (YAML) for Infrastructure Provisioning

- **Status:** Accepted
- **Date:** 2026-11-12
- **Decider:** Project team consensus (issue #20)
- **Consulted:** Cao Viet Anh (Worker/SES), Hieu (Messaging), Quang Thinh (Backend Lead), Jamie (Frontend)

---

## Context
Every service in the platform — Cognito user pool + app client, API Gateway with JWT authorizer, Lambda functions, Aurora Serverless v2, SQS with DLQ, SNS/SES event wiring, EventBridge Scheduler, CloudWatch alarms — must be provisioned before issues #3, #6, #7, #10, #14 can progress. Nothing recorded *how* those resources get created: console clicks, CLI scripts, or infrastructure as code.

Team decision recorded in issue #20 (2026-11-12): unanimous choice of **Option B — CloudFormation with YAML templates** over manual console configuration. AWS CDK/SAM was noted as a possible future layer on top, not adopted now.

## Decision
Provision all shared and demo-critical infrastructure with **AWS CloudFormation YAML templates stored in the repository** (`infra/`), deployed via `aws cloudformation deploy`.

### Stack split (one stack per concern, no mega-stack)

| Template | Stack name | Contents | Unblocks |
| :--- | :--- | :--- | :--- |
| `infra/auth.yaml` | `csep-auth` | Cognito user pool, app client (PKCE, rotation, revocation), hosted UI domain | #9 login UI |
| `infra/api.yaml` | `csep-api` | API Gateway HTTP API, JWT authorizer, Lambda functions, IAM roles, `DATABASE_URL` env | #5 endpoints |
| `infra/dispatcher.yaml` | `csep-dispatcher` | EventBridge Scheduler, Dispatcher Lambda, SQS send queue + DLQ | #6, #7, #10 |
| `infra/feedback.yaml` | `csep-feedback` | Feedback SQS queue subscribed to the SES SNS topic, EventHandler Lambda | #7, #11 |
| `infra/data.yaml` | `csep-data` | Aurora Serverless v2 cluster, RDS Proxy (per ADR-0001 consequence on connection pooling) | #4/#16 schema |
| `infra/observability.yaml` | `csep-observability` | CloudWatch alarms, dashboards, alerting rules | #14 |

### Naming convention
- Stack names: `csep-<concern>` (Customer Support Email Platform).
- Outputs cross-reference by stack export/import (`Fn::ImportValue`), so stacks stay independently deployable.
- No manual changes to shared stacks: any resource the demo depends on must exist in a template. Console/CLI experimentation is allowed only in personal sandboxes.

## Rationale
1. **Reproducibility:** multiple members own different AWS components (#3, #6, #7, #10, #14); a template guarantees their work deploys identically on anyone's account.
2. **Grading evidence:** the templates themselves document the architecture in reviewable, diffable form — stronger than console screenshots.
3. **Demo rebuild speed:** a broken demo is rebuilt with `aws cloudformation deploy` in minutes instead of a multi-hour console walkthrough.
4. **Cost control:** deleting a stack removes everything it created; no orphaned resources before billing surprises.
5. **Schema contract is load-bearing:** IAM roles, Data API/RDS Proxy settings and queue redrive policies must match the DB constraints accepted in ADR-0003 and `db/schema.sql` (#4/#16); a template encodes that match explicitly.

## Alternatives considered

| Option | Verdict |
| :--- | :--- |
| **A. Manual console/CLI setup** | Rejected: fastest once, but unreproducible, drift-prone, and destroys the audit/evidence trail the course rewards. |
| **C. AWS CDK or SAM on top of CloudFormation** | Deferred: same deploy target, steeper learning curve for the team now. Revisit if templates grow beyond ~5 stacks or repetitive boilerplate. |

## Consequences
- Every template change goes through a PR (reviewable diff like any other code).
- Deployment is done with `aws cloudformation deploy --stack-name <stack> --template-file infra/<concern>.yaml --capabilities CAPABILITY_IAM` — documented in README as each template lands.
- Stack updates follow the template; **drift detected at any time means the template is wrong** — fix the template, never "fix" the console to match reality.
- The DB access-path decision (RDS Proxy + `pg` wire protocol vs Aurora Data API — tracked in issue #21) must be settled **before** `infra/data.yaml` is written; it determines the driver and transaction shape the shared DB access layer will use across all Lambdas.
- An owner is assigned for the first template (`auth.yaml`, unblocks #9); subsequent templates follow the same one-owner-per-stack pattern.

## References
- Issue #20: decision thread and consensus (2026-11-12)
- ADR-0001: serverless Lambda stack this infra targets
- ADR-0002: EventBridge/SQS topology wired by `infra/dispatcher.yaml`
- ADR-0003: Aurora cluster provisioned by `infra/data.yaml`
