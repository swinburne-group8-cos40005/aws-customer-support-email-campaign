# Documentation index

One-line description per document, grouped by concern. Read top to bottom
in each group for a guided tour of the design.

## Architecture decisions (ADRs)

| Document | Decision |
| :--- | :--- |
| [ADR-0001](adr/ADR-0001-serverless-api-gateway-lambda-over-ec2-monolith.md) | Serverless API Gateway + Lambda over an EC2 monolith |
| [ADR-0002](adr/ADR-0002-eventbridge-sqs-dispatching.md) | EventBridge + SQS for campaign dispatching |
| [ADR-0003](adr/ADR-0003-aurora-postgresql-over-dynamodb.md) | Aurora PostgreSQL over DynamoDB |
| [ADR-0004](adr/ADR-0004-cloudformation-for-infrastructure.md) | CloudFormation YAML for all infrastructure |
| [ADR-0005](adr/ADR-0005-database-access-path-rds-proxy-pg.md) | Database access path: RDS Proxy + `pg` driver |
| [ADR-0006](adr/ADR-0006-credential-flow-iam-auth-and-secrets-manager.md) | Credential flow: IAM auth + Secrets Manager |
| [ADR-0007](adr/ADR-0007-ses-event-routing-via-sns-and-dlq-redrive.md) | SES event routing via SNS and the main-queue DLQ redrive policy |

## Specifications and design

| Document | Contents |
| :--- | :--- |
| [api-contract.md](api-contract.md) | REST API specification: endpoints, request/response shapes, error envelope |
| [email-state-machine.md](email-state-machine.md) | State machines for the campaign and email lifecycle |
| [erd.md](erd.md) | Database ERD |
| [schema-design-notes.md](schema-design-notes.md) | Schema and API-contract confirmation notes |
| [audit-log-strategy.md](audit-log-strategy.md) | Audit logging strategy (FR9 compliance) |
| [user-story.md](user-story.md) | User stories |
| [milestone1.md](milestone1.md) | Milestone 1 report — foundation and SES proof of concept |

## Process

| Document | Contents |
| :--- | :--- |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Commit message, PR title, and branch naming conventions |
| [meeting-notes/](meeting-notes/) | Chronological team meeting minutes |
| [evidence/](evidence/) | Evidence records of test runs and other verification |
