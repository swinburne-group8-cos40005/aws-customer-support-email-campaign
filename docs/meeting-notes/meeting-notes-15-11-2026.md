# Meeting Notes -- System Architecture Finalisation, Branching, and CloudFormation Walkthrough

**Date:** 15 November 2026
**Project:** AWS Customer Support Email Campaign
**Meeting Type:** Architecture Sign-off & Infrastructure Walkthrough
**Topics:** Architectural Decisions Consolidation, Git Branching Workflow, Backend Demonstration, and AWS CloudFormation YAML Verification

## 1. Meeting Purpose

The team consolidated and finalised all open architectural issues governing the system infrastructure and backend access patterns. Following alignment on these decisions, the team initiated feature branch development and walked through the backend implementation alongside the AWS CloudFormation YAML templates (`infra/`) prepared for deployment.

## 2. Consolidated System Architecture Decisions

The team reviewed and closed the core infrastructure decision issues to establish a unified baseline across all Sprint 1 components:

- **Infrastructure Provisioning via AWS CloudFormation (`Issue #20` / `ADR-0004`):**
  - **Decision:** Provision all AWS resources using declarative CloudFormation YAML templates stored in the repository (`infra/`) rather than manual AWS Console configuration.

  - **Rationale:** Ensures full environment reproducibility (`aws cloudformation deploy`), clean diffable review evidence in Pull Requests, and avoids error-prone manual wiring across Cognito, API Gateway, Lambda, Aurora Serverless v2, SQS/DLQ, SES, and EventBridge.

- **Database Access Path -- RDS Proxy + `pg` Driver (`Issue #21`):**
  - **Decision:** Selected **Option A (RDS Proxy + native `pg` driver)** over the HTTP-based Aurora Data API.

  - **Rationale:** Preserves native SQL transactions (`BEGIN`/`COMMIT`), provides sub-millisecond wire-protocol latency, and efficiently pools connections for high-concurrency Worker updates and Dispatcher bulk inserts without rewriting the existing `db.ts` access layer.

- **Credential-less IAM Database Authentication (`Issue #22` / `ADR-0005`):**
  - **Decision:** Lambdas authenticate to RDS Proxy using short-lived **IAM tokens** over TLS, while RDS Proxy authenticates to Aurora Serverless v2 using master credentials managed in **AWS Secrets Manager**.

  - **Benefit:** Eliminates hardcoded database passwords in Lambda environment variables and enforces per-function IAM roles.

- **API Contract v1.1 Freeze (`docs/api-contract.md`):**
  - Confirmed that all API endpoints (including read operations) require a valid Cognito JWT validated by the API Gateway JWT Authorizer, and formalised `503 DB_UNAVAILABLE` retry semantics.

## 3. Git Branching & Development Workflow

With architectural blockers resolved, the team transitioned into active feature implementation:

- **Feature Branching Initiated:** Team members began creating dedicated feature branches from `main` (e.g., `feat/api-contract-v1-1-infra-stacks` under PR `#23`) to isolate infrastructure and service changes.

- **Stack & Naming Conventions:** Standardised CloudFormation stack naming (`csep-auth`, `csep-data`, `csep-api`) with cross-stack `ImportValue` / `Export` wiring (e.g., `csep-data-DBProxyEndpoint`) and enforced `db/schema.sql` as the single source of truth for database schemas.

## 4. Backend Demonstration & CloudFormation YAML Verification

The team demonstrated the backend implementation and reviewed the CloudFormation YAML templates created for AWS deployment:

- **`infra/auth.yaml` (`csep-auth` Stack):**
  - Configures the Amazon Cognito User Pool (email username, strong password policy), Hosted UI domain (`csep-<account-id>-<env>`), and a PKCE-enabled Web App Client (`authorization-code` flow without client secret, 1-hour tokens, 30-day refresh rotation).

- **`infra/data.yaml` (`csep-data` Stack):**
  - Provisions the Aurora Serverless v2 PostgreSQL cluster inside the target VPC alongside the IAM-authenticated RDS Proxy and Secrets Manager integration.

- **`infra/api.yaml` (`csep-api` Stack):**
  - Defines the `AWS::ApiGatewayV2::Api` HTTP API (`csep-api-${EnvironmentName}`) with CORS configuration and the `cognito-jwt-authorizer`.

  - Demonstrates Lambda function definitions (e.g., `CreateCampaignFunction` running on `nodejs20.x` and `arm64` architecture) configured with `DB_HOST` imported directly from the `csep-data` stack.

## 5. Meeting Outcomes & Follow-up Considerations

- **Architecture Locked:** All foundational infrastructure and database connectivity decisions (`#20`, `#21`, `#22`) are closed and documented, unblocking parallel Sprint 1 development across backend and frontend tasks.

- **Deployment Readiness:** Validated the structure and cross-stack parameter wiring of `auth.yaml`, `data.yaml`, and `api.yaml` for AWS CloudFormation deployment testing.

- **Follow-up Actions:**
  - Complete review and merge of PR `#23` (`feat/api-contract-v1-1-infra-stacks`) into `main`.

  - Execute end-to-end CloudFormation stack deployment tests in the `dev` environment and apply `db/schema.sql` to the provisioned Aurora cluster.

  - Tighten `AllowOrigins` in `infra/api.yaml` from `["*"]` to the specific frontend origin prior to public exposure.
