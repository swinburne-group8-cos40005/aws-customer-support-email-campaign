# Meeting Notes -- API Contract, State, and Response Format Discussion

**Date:** 03 November 2026
**Project:** AWS Customer Support Email Campaign
**Meeting Type:** Team Design Review
**Topics:** API Contract Specification, Campaign State Transitions, Payload Inputs, and Response Formats

## 1. Meeting Purpose

The team reviewed the API contract specification (`docs/api-contract.md`) to align on the expected behaviour, request parameters, payload inputs, and response formats for the Campaign Management endpoints.

The discussion also focused on verifying campaign state transitions across different execution flows and ensuring consistency between API responses, dispatch modes, and audit log actions.

## 2. Campaign State Transitions and Dispatch Modes

The team reviewed how campaign states are managed across different lifecycle operations to ensure consistent behaviour between scheduled and immediate dispatches:

- **Supported Campaign States:** `draft`, `scheduled`, `sending`, `completed`, `failed`, and `cancelled`.
- **Scheduled Dispatch Flow:** Follows the standard progression `draft` $\rightarrow$ `scheduled` $\rightarrow$ `sending` $\rightarrow$ `completed` (or `failed`), triggered via an EventBridge rule.
- **Immediate Dispatch Flow (Issue #4 Amendment):** Transitions directly from `draft` $\rightarrow$ `sending`, bypassing the `scheduled` waiting state. No EventBridge rule is created; instead, the Campaign API Lambda invokes the Dispatcher Lambda directly.
- **Unified Downstream Processing:** From the `sending` state onwards, both immediate and scheduled campaigns share the exact same SQS Worker execution pipeline.

## 3. API Endpoint Specifications Reviewed

The team examined Section 2.1 (`Campaign Management (/campaigns)`) of the API contract in detail, covering query inputs, side-effects, and response formats.

### `GET /campaigns` -- List Campaigns

- **Purpose:** Lists campaigns with pagination and status filtering (supports `US01` and `US04`).
- **Query Parameters (Inputs):**
  - `status` _(string, optional)_: Filters results by `draft | scheduled | sending | completed | failed | cancelled`.
  - `page` _(int, default: `1`)_: Specifies the page number for pagination.
  - `limit` _(int, default: `20`, max: `100`)_: Caps the number of returned records per request.
- **Response Format (`200 OK`):**
  - Returns a JSON object containing a top-level `"data"` array of campaign objects.
  - Each object includes `campaignId` (UUID), `name`, `templateId`, `segmentId`, `status`, and ISO-8601 UTC timestamps (`scheduledAt`, `createdAt`, `updatedAt`).

### `POST /campaigns/{id}/schedule` -- Schedule Campaign

- **Purpose:** Transitions a draft campaign into the scheduled queue.
- **Response Format (`200 OK`):**
  - Returns the updated campaign object with `status: "scheduled"`.
  - Emits a `schedule` action entry to the audit log.

### `POST /campaigns/{id}/send` -- Immediate Campaign Dispatch

- **Purpose:** Triggers immediate dispatch of a `draft` campaign (`US03`).
- **Execution Behaviour:**
  - Sets `status: "sending"` and `dispatchMode: "immediate"` immediately without waiting in the `scheduled` state.
  - Populates `scheduledAt` with the current timestamp (`<now>`) so every dispatched campaign retains a dispatch timestamp for uniform tracking.
- **Response Format (`200 OK`):**
  - Returns the campaign object with `status: "sending"`, `dispatchMode: "immediate"`, and `scheduledAt: <now>`.
  - Emits a dedicated `send` audit log action so immediate dispatches remain clearly distinguishable from scheduled campaigns in the audit trail.

### `POST /campaigns/{id}/cancel` -- Cancel Scheduled Campaign

- **Purpose:** Cancels a `scheduled` campaign prior to execution (`US02`).
- **Response Format (`200 OK`):**
  - Returns the updated campaign object with `status: "cancelled"`.
  - Emits a `cancel` audit log entry.

### `GET /campaigns/{id}/logs` -- Retrieve Dispatch Logs

- **Purpose:** Retrieves granular email dispatch logs for a specific campaign (`US04`).
- **Response Format (`200 OK`):**
  - Confirmed the endpoint path, purpose, and `200 OK` status code during the walkthrough; detailed log item response payload formatting was queued for final documentation review.

## 4. Key API and Payload Design Decisions

1. **Standardised Response Wrapping:** List endpoints wrap returned items inside a `"data"` array with consistent camelCase JSON field naming (`campaignId`, `templateId`, `segmentId`, `dispatchMode`, `scheduledAt`, `createdAt`, `updatedAt`).
2. **Timestamp Consistency:** Setting `scheduledAt` to `<now>` during immediate dispatch ensures downstream reporting and sorting logic can rely on `scheduledAt` being populated for all sent campaigns.
3. **Audit Trail Separation:** Enforced distinct audit log actions (`schedule`, `send`, `cancel`) corresponding directly to each state-changing endpoint.
4. **Pagination Guardrails:** Enforced a default `limit` of `20` and a hard maximum of `100` on `GET /campaigns` to protect API performance.

## 5. Meeting Outcomes

The walkthrough confirmed alignment across the team regarding the Campaign Management API structure, query parameter validation rules, and JSON response formats.

Clarifying the `POST /campaigns/{id}/send` behaviour resolved how immediate dispatches interact with Lambda, EventBridge, and the shared SQS Worker pipeline without introducing state inconsistencies.

## 6. Follow-up Considerations

- Complete the `200 OK` response body schema example for `GET /campaigns/{id}/logs` in `docs/api-contract.md`.
- Document standard error response formats (e.g., `400 Bad Request`, `404 Not Found`, and `409 Conflict` for invalid state transitions such as cancelling a campaign already in `sending` state).
- Align frontend data models and status rendering components with the finalised JSON response fields and the six campaign states.
- Verify that `docs/api-contract.md` remains fully synchronised with `docs/email-state-machine.md` and `docs/audit-log-strategy.md`.


