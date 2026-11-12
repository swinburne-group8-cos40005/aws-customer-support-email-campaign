# Milestone 1 — Project Foundation & SES Proof of Concept

**Project:** AWS Customer Support Email Campaign Platform  
**Course:** COS40005 — Computing Technology Project A  
**Team:** Swinburne Group 8  
**Milestone status:** In Progress  
**Target date:** To be confirmed  
**AWS Region:** Asia Pacific (Sydney) — `ap-southeast-2`

---

## 1. Milestone Overview

The purpose of this milestone is to establish the technical foundation of the AWS Customer Support Email Campaign Platform and demonstrate that the project can send test emails through Amazon Simple Email Service (SES).

The team will establish the shared repository and development workflow, prepare the AWS environment, verify the sender domain, define the initial architecture, and agree on the database design and infrastructure approach. Node.js is the selected runtime for the project's current backend and email-sending implementation.

An earlier standalone Python/boto3 proof of concept was used to validate SES email sending and basic template personalisation. This was an initial validation only; it is not the implementation runtime selected for the platform.

This milestone focuses on project setup and validating individual foundations. It does **not** deliver the complete campaign-management or bulk-email workflow. Integration between the campaign backend, Aurora PostgreSQL, SQS, Lambda workers, and SES event processing remains subsequent work.

## 2. Objectives

The objectives of this milestone are to:

- Establish a shared GitHub repository and a collaborative development workflow for all six team members.
- Prepare the AWS environment and verify the custom sender domain in Amazon SES.
- Demonstrate successful test email sending through SES.
- Establish Node.js as the implementation runtime and prepare a reproducible development environment.
- Define the initial system architecture and AWS service responsibilities.
- Review the initial Aurora PostgreSQL database design and required data fields.
- Agree on the database access approach and infrastructure provisioning strategy, documenting decisions in Architecture Decision Records (ADRs).
- Prepare the project structure for backend, frontend, infrastructure, and email-pipeline development.

## 3. Work Completed and Current Progress

This section distinguishes completed proof-of-concept work from implementation that is still in progress.

### 3.1 Repository and Development Setup

- Established the GitHub repository for team collaboration.
- Organised the initial project structure and team responsibilities.
- Began using GitHub Issues and project tracking to coordinate tasks and record technical dependencies.
- Started documenting architecture and infrastructure decisions through issues and ADRs.

### 3.2 AWS and Amazon SES Setup

- Prepared the AWS environment in the Sydney region (`ap-southeast-2`).
- Verified an individual sender email identity for initial testing.
- Configured the custom domain `emailsupport.id.vn` and completed the SES domain identity verification process.
- Configured and checked the domain's Easy DKIM CNAME records and published a DMARC record with a monitoring policy (`p=none`).
- Successfully tested SES email sending using an initial standalone Python/boto3 proof of concept.
- Tested basic email personalisation by inserting a customer first name into the test email.

The Python proof of concept validated SES connectivity and basic sending behaviour. The project's ongoing implementation is in Node.js.

### 3.3 Initial Technical Implementation

- Selected Node.js as the runtime for the current backend and email-sending implementation.
- Started moving the email-sending functionality from the Python proof of concept into the Node.js codebase.
- Identified the main components required for campaign scheduling, queue-based sending, and SES event processing.
- Reviewed the initial database design and integration requirements with the backend/database developer.
- Identified dependencies between the Worker Lambda, SQS message format, Aurora PostgreSQL schema, and email-status event handling.

The Node.js email-sending implementation and the full SQS-to-Worker-to-database integration are still in progress. They are not yet recorded as completed deliverables.

## 4. Work In Progress and Dependencies

| Task | Responsible area | Status / dependency |
|---|---|---|
| Finalise Aurora PostgreSQL ERD, schema, and required fields | Backend / Database | In progress; requires team review |
| Decide how Lambda functions access Aurora | Backend / AWS infrastructure | Decision pending; to be recorded in ADR-0005 and aligned with ADR-0004 |
| Agree on SQS message format for email jobs | Queue / Backend / Email Pipeline | In progress; required before Worker integration |
| Implement and test Node.js email-sending functionality | Email Pipeline | In progress |
| Implement SQS-to-Worker Lambda integration | Email Pipeline / Backend | Planned; depends on the message contract and database access decision |
| Define campaign-state and suppression checks in the Worker | Email Pipeline / Backend | Planned; depends on the database schema and agreed behaviour |
| Coordinate delivery, bounce, and complaint status updates | Email Events / Backend | In progress; requires agreement on shared status fields |
| Finalise infrastructure provisioning approach | AWS / DevOps | Pending team decision; CloudFormation is proposed |
| Configure Cognito authentication and API integration | Authentication / Backend | Pending |

## 5. Initial System Architecture

The proposed architecture separates campaign sending from SES event processing. The components and integrations below describe the intended design; they should not be interpreted as proof that the complete workflow has already been implemented.

### 5.1 Campaign and Email-Sending Flow

1. Staff authenticate through Amazon Cognito.
2. Amazon API Gateway exposes the backend APIs and validates user access through a JWT authorizer.
3. Campaign API Lambda functions handle campaign and template operations and access campaign data in Aurora PostgreSQL.
4. Amazon EventBridge Scheduler triggers campaigns at their scheduled time.
5. A Dispatcher Lambda selects eligible recipients and creates email jobs in Amazon SQS.
6. Worker Lambda functions consume email jobs, check campaign state and recipient suppression, and send eligible emails through Amazon SES.
7. Failed SQS messages can be moved to a dead-letter queue (DLQ) after the configured retry policy is exhausted.

### 5.2 SES Event-Processing Flow

1. Amazon SES publishes sending events such as delivery, bounce, and complaint through an SES event destination.
2. Amazon SNS forwards the notifications to an event-processing SQS queue.
3. An Event Handler Lambda consumes the event messages, validates and parses the event information, and updates the relevant email records in Aurora PostgreSQL.
4. The application uses the recorded email statuses for campaign reporting and dashboard queries.

### 5.3 AWS Services

| AWS service | Intended responsibility |
|---|---|
| Amazon Cognito | Staff authentication and user-pool management |
| Amazon API Gateway | Backend HTTP API endpoints and JWT authorisation |
| AWS Lambda | Campaign API processing, dispatching, email workers, and SES event handling |
| Amazon Aurora PostgreSQL | Campaign, customer, template, recipient, and email-event records |
| Amazon SQS | Email-job queue, event queue, and dead-letter queues where required |
| Amazon SES | Outbound email sending and event publishing |
| Amazon SNS | Delivery of SES event notifications to the event queue |
| Amazon EventBridge Scheduler | Triggering campaigns at their scheduled times |
| Amazon CloudWatch | Logs, monitoring, metrics, and alarms |
| AWS Secrets Manager | Secure storage of database credentials where required by the chosen access method |

## 6. Technical Decisions and Open Questions

The table records the current direction. A proposal is not considered an approved team decision until the team has agreed and documented it.

| Area | Current direction | Decision status |
|---|---|---|
| Backend and email-pipeline runtime | Node.js | Selected by the team |
| Initial SES validation | Python/boto3 standalone proof of concept | Completed for initial validation only; not the platform runtime |
| Database | Amazon Aurora PostgreSQL | Selected as the database direction; schema is being finalised |
| Lambda-to-Aurora access | Option A: RDS Proxy with the `pg` driver; Option B: Aurora Data API | Under discussion; no final team decision yet |
| Database access ADR | ADR-0005, cross-referencing ADR-0004 | To be agreed and documented before the infrastructure template is finalised |
| Email service | Amazon SES | Selected |
| Email-job queue | Amazon SQS | Selected as the proposed queue service; message contract is still being agreed |
| SES event notifications | Amazon SES → SNS → SQS → Event Handler Lambda | Proposed architecture |
| Authentication | Amazon Cognito User Pool | Proposed architecture |
| API authorisation | API Gateway JWT authorizer | Proposed architecture |
| Infrastructure provisioning | CloudFormation YAML | Proposed; team decision pending |
| Source control | GitHub with branches, issues, and pull requests | Current team workflow |
| AWS Region | `ap-southeast-2` (Sydney) | Current project environment |

### 6.1 Database Access Decision

The team is evaluating two approaches for Lambda functions to access Aurora PostgreSQL:

- **Option A — RDS Proxy with the `pg` driver:** uses the PostgreSQL wire protocol and native PostgreSQL transaction behaviour. It is compatible with the current shared database-access draft, subject to review and appropriate connection-pool and concurrency settings.
- **Option B — Aurora Data API:** uses HTTPS requests to execute SQL statements and manage transactions through transaction IDs. The existing `pg`-based draft would need to be adapted to this access model.

The team must select one approach and record the reasoning in ADR-0005. The decision should be made before the database infrastructure template and additional database-dependent handlers are finalised. The current `db.ts` code is an unreviewed proposal, not an approved team baseline.

### 6.2 Other Scope Confirmation

The team should confirm whether Amazon Connect is a required component of the project brief or whether the agreed implementation can use SES directly for email operations. The architecture and milestone should be updated to reflect the confirmed scope; no Amazon Connect integration is claimed as completed here.

## 7. Milestone Acceptance Criteria

Milestone 1 will be considered complete when the team has met and reviewed the following criteria:

- All six team members can access the GitHub repository and follow the agreed contribution workflow.
- The custom sender domain is verified in Amazon SES, and the relevant DKIM configuration has been checked.
- A test email can be sent successfully through Amazon SES using the project's documented test procedure.
- Node.js dependencies and local setup instructions are documented so another team member can reproduce the development environment.
- The initial Node.js email-sending implementation has been tested against SES using an approved test recipient.
- The initial Aurora PostgreSQL ERD and schema have been reviewed by the relevant team members.
- The Lambda-to-Aurora access method has been agreed and recorded in an ADR.
- The initial architecture and component responsibilities have been reviewed by the team.
- The infrastructure provisioning approach has been agreed and documented.
- The initial code and documentation have been committed to GitHub and reviewed through the team's workflow.

## 8. Deliverables

The expected deliverables for this milestone are:

1. GitHub repository with an initial project structure and team contribution workflow.
2. AWS environment prepared for project development.
3. Verified SES sender domain and evidence of successful test email sending.
4. Initial Aurora PostgreSQL ERD and schema documentation.
5. Initial system architecture diagram showing the sending and event-processing flows.
6. Documented technical decisions and ADRs, including the Lambda-to-Aurora access decision.
7. Node.js email-sending implementation with setup and test instructions.
8. Initial infrastructure provisioning approach and, once agreed, the corresponding CloudFormation structure.

## 9. Risks and Dependencies

| Risk or dependency | Potential impact | Mitigation / next action |
|---|---|---|
| Database access method is not yet agreed | Delays infrastructure work and database-dependent Lambda development | Decide between RDS Proxy + `pg` and Data API; document the decision in ADR-0005 |
| SQS message format is not finalised | Worker and Dispatcher may use incompatible field names or payload structures | Agree on and document the message contract before integration |
| Aurora schema is still being reviewed | Worker and event-handler queries may need rework | Review the ERD and required campaign, customer, recipient, and email-status fields with the backend team |
| Node.js SES implementation is still in progress | The Python proof of concept cannot be used as evidence of the final runtime implementation | Complete and test the Node.js implementation with SES |
| Lambda or SQS concurrency can create database load | Database connection pressure or throttling during email bursts | Set appropriate Lambda/SQS concurrency and database connection limits; validate under test load |
| Project scope around Amazon Connect needs confirmation | Architecture may not fully match the project brief | Confirm the requirement with the supervisor/client or team and record the decision |

## 10. Next Milestone

After the project foundation is established, the next milestone will focus on the campaign-management foundation and the first integrated backend workflow.

Planned work includes:

- Implementing campaign, template, and customer management APIs in Node.js.
- Connecting backend Lambda functions to Aurora PostgreSQL using the team-approved access method.
- Finalising customer segmentation and recipient-selection logic.
- Building the frontend campaign creation and management interface.
- Defining and implementing the SQS email-job message contract.
- Connecting the Dispatcher and Worker Lambda components for controlled test sending.
- Adding campaign-state and recipient-suppression checks before sending.
- Continuing integration of SES delivery, bounce, and complaint event processing.

The team will then progress towards scheduled, queue-based bulk email delivery, retry and dead-letter handling, and campaign reporting.

---

**End of Milestone 1**
