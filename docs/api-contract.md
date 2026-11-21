# REST API Specification & Contract

- **Version:** 1.2.0
- **Author:** Quang Thinh (Backend API & Database Lead)
- **Reviewer / Aligned with:** Trong Hieu (Frontend Lead)
- **Status:** Approved for Sprint 1 — v1.0 frozen for endpoint shapes; v1.1 adds auth clarification and data-access conventions (issues #21, #22); v1.2 adds the statistics endpoints (§2.6, US04 & US05)
- **Base URL:** `https://api.campaign.internal/v1`

---

## 1. Global Conventions & Standards

### 1.1 Authentication & Authorization
**All endpoints — reads and mutations alike — require an Amazon Cognito JSON Web Token (JWT)** passed in the `Authorization` header:
```http
Authorization: Bearer <cognito_id_token>
```
- The token is **validated by the API Gateway JWT authorizer** before any Lambda runs; unauthenticated requests are rejected with `401` at the gateway and never invoke backend code.
- Lambdas **only read the verified claims** (`sub`, email, groups). They do not re-verify signatures and do not call Cognito per request.
- The Cognito user pool and app client are provisioned by the `csep-auth` stack (ADR-0004); the authorizer in `infra/api.yaml` is configured from that stack's outputs.

### 1.2 Common Request & Response Format
- **Content-Type:** `application/json`
- **Naming Convention:** `camelCase` for all JSON keys (payload & response).
- **Date/Time Standard:** ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`).

### 1.3 Standard Error Envelope
All error responses (HTTP 4xx and 5xx) must follow this consistent envelope:
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Campaign with ID 3fa85f64-5717-4562-b3fc-2c963f66afa6 was not found.",
    "details": {
      "field": "campaignId",
      "reason": "UUID does not exist in Aurora database"
    }
  }
}
```

### 1.4 Data Access Path
API Lambdas never connect to Aurora directly. The access path is:
```
Lambda (`csep_app`) ──IAM auth token (~15 min)──▶ RDS Proxy ──app-user Secrets Manager credential──▶ Aurora PostgreSQL (Serverless v2)
```
- Settled in ADR-0005 (RDS Proxy + `pg` driver over the Postgres wire protocol; the Aurora Data API is rejected) and issue #22 (IAM token auth in front of the Proxy, Secrets Manager behind it).
- Lambdas hold **no database password**: each Lambda signs a short-lived IAM token with its execution role (`rds-db:connect` scoped to the Proxy's `csep_app` database user). The Proxy authenticates to Aurora with the dedicated app user's credential stored in Secrets Manager; the Lambda cannot authenticate as the master user.
- All writes run in a single transaction that also inserts the audit row (see `docs/audit-log-strategy.md`), so a failed mutation leaves no partial state.
- Transient database unavailability surfaces as `503` with code `DB_UNAVAILABLE` in the standard error envelope; clients should retry with backoff rather than re-submit blindly.

### 1.5 Deployment & Infrastructure
- Infrastructure is AWS CloudFormation (ADR-0004), templates in `infra/`. Deploy order for this contract: `csep-artifact` (S3 bucket for packaged Lambda code) → `csep-auth` → `csep-data` (Aurora + RDS Proxy) → `csep-api` (HTTP API + JWT authorizer + Lambdas).
- Stacks cross-reference via `Fn::ImportValue` outputs; no manual console changes to shared stacks — drift means the template is wrong, not the console.
- Schema is applied from `db/schema.sql` through a one-off SSM-managed host with temporary direct cluster access; its security-group ingress is removed after bootstrap. Schema is never created or edited by hand in the console.

---

## 2. API Endpoints Specification

### 2.1 Campaign Management (`/campaigns`)

#### `GET /campaigns`
* **Purpose:** List campaigns with pagination and status filters (US01, US04).
* **Query Parameters:**
  * `status` (string, optional): Filter by `draft | scheduled | sending | completed | failed | cancelled`
  * `page` (int, default: 1), `limit` (int, default: 20, max: 100)
* **Response `200 OK`:**
```json
{
  "data": [
    {
      "campaignId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "name": "October Monthly Newsletter",
      "templateId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "segmentId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "status": "scheduled",
      "scheduledAt": "2026-10-30T10:00:00Z",
      "createdAt": "2026-10-25T08:00:00Z",
      "updatedAt": "2026-10-25T08:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 92
  }
}
```

#### `POST /campaigns`
* **Purpose:** Create a campaign in `draft` status (US01).
* **Request Body:**
```json
{
  "name": "Black Friday Early Access",
  "templateId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "segmentId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```
* **Response `201 Created`:** Returns created campaign object. Emits `create` audit log.

#### `GET /campaigns/{id}`
* **Purpose:** Get details of a single campaign.
* **Response `200 OK`:** Returns campaign object with associated template and segment summary.

#### `PUT /campaigns/{id}`
* **Purpose:** Update campaign fields. Allowed **only** when `status = 'draft'`.
* **Response `200 OK`:** Updated object. Returns `409 Conflict` if campaign is `sending` or `completed`. Emits `update` audit log.

#### `DELETE /campaigns/{id}`
* **Purpose:** Delete a draft campaign.
* **Response `204 No Content`:** Emits `delete` audit log.

#### `POST /campaigns/{id}/schedule`
* **Purpose:** Transition a campaign from `draft` to `scheduled` (US02).
* **Request Body:**
```json
{
  "scheduledAt": "2026-11-01T14:00:00Z"
}
```
* **Response `200 OK`:** Returns campaign with `status: "scheduled"`. Emits `schedule` audit log.

#### `POST /campaigns/{id}/send`
* **Purpose:** Immediate dispatch of a draft campaign (US03). Does **not** create an EventBridge rule — the Dispatcher Lambda is invoked directly by the Campaign API Lambda.
* **Behavior:** Sets `status: "sending"` and `dispatchMode: "immediate"` immediately; `scheduledAt` is stored as the current time so every campaign keeps a dispatch timestamp. No wait in `scheduled`.
* **Response `200 OK`:** Returns campaign with `status: "sending"`, `dispatchMode: "immediate"`, `scheduledAt: <now>`. Emits `send` audit log (a dedicated action — immediate dispatch must stay distinguishable from scheduled campaigns in the audit trail).
* *Amended: dispatch-mode decision, issue #4. Immediate and scheduled shares the SQS Worker path from `sending` onwards.*

#### `POST /campaigns/{id}/cancel`
* **Purpose:** Cancel a scheduled campaign before execution (US02).
* **Response `200 OK`:** Returns campaign with `status: "cancelled"`. Emits `cancel` audit log.

#### `GET /campaigns/{id}/logs`
* **Purpose:** Retrieve email dispatch logs for a campaign (US04).
* **Response `200 OK`:**
```json
{
  "campaignId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "logs": [
    {
      "emailLogId": "c4d5e6f7-a8b9-0c1d-2e3f-4a5b6c7d8e9f",
      "recipientEmail": "user@example.com",
      "sendStatus": "delivered",
      "sesMessageId": "0100017a-8b9c-xyz-000000",
      "attemptCount": 1,
      "updatedAt": "2026-10-30T10:02:15Z"
    }
  ]
}
```

---

### 2.2 Template Management (`/templates`)
Full CRUD endpoints for email templates (US01):
* `GET /templates` — List all templates.
* `POST /templates` — Create a template (`name`, `subjectTemplate`, `bodyHtml`, `bodyText`).
* `GET /templates/{id}` — Retrieve template by UUID.
* `PUT /templates/{id}` — Update template content. Emits `update` audit log.
* `DELETE /templates/{id}` — Delete unused template.

---

### 2.3 Segment Management & Audience Preview (`/segments`)

#### `GET /segments` & `POST /segments`
* CRUD for audience filter rules (e.g., city, loyalty tier, tags).

#### `POST /segments/{id}/preview` *(Requested by Trong Hieu for UX)*
* **Purpose:** Calculate and preview the estimated audience size before scheduling (US01, US02).
* **Response `200 OK`:**
```json
{
  "segmentId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "segmentName": "Gold Customers in Hanoi",
  "estimatedRecipients": 8420,
  "suppressedExcluded": 142,
  "netAudience": 8278,
  "calculatedAt": "2026-10-25T14:40:00Z"
}
```

---

### 2.4 Customer Preferences & Suppression (`/customers/{id}/preferences`)

#### `GET /customers/{id}/preferences`
* **Purpose:** Check customer opt-in/opt-out status (US05).

#### `PUT /customers/{id}/preferences`
* **Purpose:** Update opt-out preference. Automatically adds/removes records in `email_suppressions`.
* **Request Body:**
```json
{
  "isOptedOut": true,
  "reason": "customer_requested"
}
```
* **Response `200 OK`:** Returns preference status.

---

### 2.5 Audit Logs Querying (`/audit-logs`)

#### `GET /audit-logs`
* **Purpose:** Retrieve system mutation audit trail with keyset/cursor-based pagination (FR9).
* **Query Parameters:**
  * `entityType` (optional): `campaign | template | segment`
  * `entityId` (optional): UUID of target entity
  * `userId` (optional): Cognito sub
  * `cursor` (optional): Keyset cursor string
  * `limit` (default: 20)
* **Response `200 OK`:**
```json
{
  "data": [
    {
      "auditLogId": "e1f2a3b4-5678-90ab-cdef-1234567890ab",
      "userId": "us-east-1:12345678-abcd-1234-abcd-1234567890ab",
      "action": "schedule",
      "entityType": "campaign",
      "entityId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "changes": {
        "before": { "status": "draft", "scheduledAt": null },
        "after": { "status": "scheduled", "scheduledAt": "2026-11-01T14:00:00Z" }
      },
      "createdAt": "2026-10-25T14:30:00Z"
    }
  ],
  "nextCursor": "eycreated_atI6IjIwMjYtMTAtMjVUMTQ6MzA6MDBaIiwiaWQiOiJlMWYyYTNiNCJ9"
}
```

---

### 2.6 Statistics & Reporting (`/stats`, `/campaigns/{id}/stats`)

Read-only endpoints for the manager reporting dashboard (US04, US05). Both require the Cognito JWT like every other endpoint (§1.1) and read through the same data access path (§1.4). They never write, so they emit **no** audit log.

#### 2.6.1 Definitions (single source of truth)

All counts are per email log row (one row per recipient of a campaign). Rates are derived from the counts below and are **never stored**.

| Field | Meaning |
|---|---|
| `sent` | Emails accepted by SES (every log row whose `sendStatus` is `sent`, `delivered`, `bounced` or `complained`) |
| `delivered` | Emails SES confirmed as delivered to the recipient's mail server |
| `bounced` | Emails that bounced (hard or soft) |
| `complained` | Emails the recipient reported as spam |
| `failed` | Emails that never reached SES after all retries (permanent send failure) |
| `pending` | Emails created but not yet accepted by SES (`pending`, `queued`) |

| Rate | Formula | Notes |
|---|---|---|
| `delivery` | `delivered / sent` | |
| `bounce` | `bounced / sent` | |
| `complaint` | `complained / sent` | |

* Rates are decimal fractions between `0` and `1` (`0.0213` = 2.13 %), rounded to 4 decimals.
* When `sent` is `0` the rates are `null` (not `0`): "no data yet" must not look like "perfect".
* `alerts.bounce` and `alerts.complaint` are one of `ok | warning | critical`, computed server-side from the thresholds returned in the same response, so the frontend never hard-codes them. A `null` rate gives `ok`.

Default thresholds (backend constants; the review levels of SES are 5 % bounce and 0.1 % complaint):

| Rate | `warning` at | `critical` at |
|---|---|---|
| bounce | ≥ 2 % (`0.02`) | ≥ 5 % (`0.05`) |
| complaint | ≥ 0.05 % (`0.0005`) | ≥ 0.1 % (`0.001`) |

#### `GET /stats/overview`
* **Purpose:** Totals across all campaigns plus the most recent campaigns with their own counts and rates (powers the dashboard home page, US04 & US05).
* **Query Parameters:**
  * `limit` (int, default: 10, max: 50): number of recent campaigns in `recentCampaigns`, newest first by `createdAt`.
* **Response `200 OK`:**
```json
{
  "generatedAt": "2026-11-21T09:00:00Z",
  "totals": {
    "campaigns": 92,
    "sent": 48210,
    "delivered": 46890,
    "bounced": 1020,
    "complained": 18,
    "failed": 300,
    "pending": 0
  },
  "rates": { "delivery": 0.9726, "bounce": 0.0212, "complaint": 0.0004 },
  "alerts": { "bounce": "warning", "complaint": "ok" },
  "campaignsByStatus": {
    "draft": 3, "scheduled": 2, "sending": 1,
    "completed": 80, "failed": 4, "cancelled": 2
  },
  "thresholds": {
    "bounce": { "warning": 0.02, "critical": 0.05 },
    "complaint": { "warning": 0.0005, "critical": 0.001 }
  },
  "recentCampaigns": [
    {
      "campaignId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "name": "October Monthly Newsletter",
      "status": "completed",
      "scheduledAt": "2026-10-30T10:00:00Z",
      "counts": { "sent": 8278, "delivered": 8100, "bounced": 150, "complained": 3, "failed": 25, "pending": 0 },
      "rates": { "delivery": 0.9785, "bounce": 0.0181, "complaint": 0.0004 },
      "alerts": { "bounce": "ok", "complaint": "ok" }
    }
  ]
}
```

#### `GET /campaigns/{id}/stats`
* **Purpose:** Counts, rates, alert levels and the status history of one campaign (US04 & US05).
* **Response `200 OK`:**
```json
{
  "campaignId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "name": "October Monthly Newsletter",
  "status": "completed",
  "generatedAt": "2026-11-21T09:00:00Z",
  "counts": { "sent": 8278, "delivered": 8100, "bounced": 150, "complained": 3, "failed": 25, "pending": 0 },
  "rates": { "delivery": 0.9785, "bounce": 0.0181, "complaint": 0.0004 },
  "alerts": { "bounce": "ok", "complaint": "ok" },
  "thresholds": {
    "bounce": { "warning": 0.02, "critical": 0.05 },
    "complaint": { "warning": 0.0005, "critical": 0.001 }
  },
  "statusHistory": [
    { "status": "draft", "changedAt": "2026-10-25T08:00:00.000Z", "changedBy": "us-east-1:12345678-abcd-1234-abcd-1234567890ab" },
    { "status": "sending", "changedAt": "2026-10-30T10:00:00.000Z", "changedBy": "us-east-1:12345678-abcd-1234-abcd-1234567890ab" },
    { "status": "completed", "changedAt": "2026-10-30T10:12:00.000Z", "changedBy": null }
  ]
}
```
* `statusHistory` is ordered oldest first. It is built from `audit_logs`, which records **human actions only** (`create`, `schedule`, `send`, `cancel`), so those entries carry the Cognito `sub` in `changedBy`. When the current status was reached by the system (dispatcher: `sending`, `completed`, `failed`), one final entry with `changedBy: null` is added, stamped with the campaign's last update. Intermediate system transitions (for example `scheduled → sending → completed`) are not stored anywhere, so only the latest one appears. A complete history would need a dedicated status-event table (out of scope for Sprint 2).
* **Errors:** `404 RESOURCE_NOT_FOUND` when the campaign does not exist, `400` (standard validation error) when `{id}` is not a UUID, `503 DB_UNAVAILABLE` as in §1.4.
