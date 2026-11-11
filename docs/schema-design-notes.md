# Schema Design Notes: Schema & API Contract Confirmation

> **This document answers 3 questions:**
> 1. Which user story does each table/column serve? (§1)
> 2. What changed compared to the previous schema version? (§2)
> 3. Which tables does each API endpoint touch? (§3)

- **Relationship diagram:** `docs/erd.md`
- **Status:** Pending review

**Notes used throughout:**
- `US01`–`US05` — user stories in `docs/user-story.md` (US01 Create, US02 Schedule, US03 Send, US04 Metrics, US05 Bounce/Opt-out).
- `FK` — foreign key.
- `CHECK` — constraint that restricts allowed values, e.g. `status` can only be one of 6 listed values; the DB rejects anything else.

---

## 1. Which table/column serves which user story?

### US01 — Create Campaign
| Table / Column | What it does |
|---|---|
| `campaigns` (`name`, `template_id`, `segment_id`, `status='draft'`) | New campaigns always start as `draft` |
| `templates` (`subject_template`, `body_text`, `body_html`) | Reusable email content |
| `segments.rules` (JSON) | Rules that define the customer group |
| `customers.first_name`, `customers.attributes` (JSON) | Values substituted into `{{first_name}}`, `{{city}}`... placeholders |
| `customer_segments` | Which customers belong to which group |

### US02 — Schedule Campaign
| Table / Column | What it does |
|---|---|
| `campaigns.scheduled_at` | Selected send time (indexed so the Dispatcher can find due campaigns fast). Two options: **schedule at** = future timestamp; **immediate** = `scheduled_at` set to `NOW()` |
| `campaigns.dispatch_mode` | `scheduled` (default) or `immediate` — how the campaign was dispatched |
| `campaigns.status` | Displayed status: `draft` → `scheduled` → `sending` → `completed`. Immediate sends skip `scheduled` and go `draft` → `sending` directly |
| `audit_logs.action = 'schedule' / 'cancel' / 'send'` | `schedule`/`cancel` = who scheduled or cancelled; `send` = immediate dispatch (logged as its own action, not reused `schedule`) |

### US03 — Send Campaign
| Table / Column | What it does |
|---|---|
| `customer_segments` | Get all customers in the segment to send to |
| `email_logs.idempotency_key` | Exactly one row per (campaign + customer). Prevents sending the same email twice |
| `email_logs.attempt_count`, `last_error` | Count of send retries, last failure message |
| `email_logs.send_status` | Per-email status: `pending` → `queued` → `sent` → `delivered`, or failure state |
| `email_suppressions` | Emails skipped during send (opted-out or bounced addresses) |

### US04 — View Results Metric
| Table / Column | What it does |
|---|---|
| `email_logs.send_status` | Count successful / failed sends. Index `(campaign_id, send_status)` exists for the count query |
| `campaigns.status` | Campaign status on the dashboard |
| `audit_logs` | History of what was done, by whom |

### US05 — Monitor Bounce & Complaint
| Table / Column | What it does |
|---|---|
| `email_events.event_type` | Records each event SES reports (`bounce`, `complaint`, ...) |
| `email_events.deduplication_key` | SES often delivers the same event 2–3 times; prevents double-counting |
| `email_suppressions.reason` | Why an address is blocked (`bounce`, `complaint`, `manual_opt_out`, `customer_requested`) |
| `audit_logs.action = 'opt_in' / 'opt_out'` | History of the customer accepting / declining emails |

### Two requirements that intentionally do NOT use the schema

| Requirement | Why |
|---|---|
| US05 "alert when rates exceed thresholds" | Thresholds are runtime configuration (backend reads env/config), not stored data. The schema only needs the events so the rate can be computed. |
| US05 "opt-in again" | Opt-in = delete one row in `email_suppressions` + write an `opt_in` audit log. No extra column or flag needed. |

---

## 2. Changes vs. the previous schema version (review these)

| # | Change | Why |
|---|---|---|
| 1 | `audit_logs.action`: added `'opt_in'`, `'opt_out'` | `audit-log-strategy.md` requires logging customer email preference changes; the old enum could not record these two actions |
| 2 | Removed `email_logs.delivery_status` | Redundant: `send_status` already covers it. Two status columns in one table let the data drift apart |
| 3 | Removed `idx_customers_email` | The `UNIQUE` constraint on `email` already creates an index; an extra one only costs write performance |
| 4 | `campaigns`: added `dispatch_mode` (`'scheduled'` default / `'immediate'`) | Immediate sends must be distinguishable from scheduled ones. `scheduled_at` is set to `NOW()` for immediate (every campaign keeps a timestamp), but the flow is `draft → sending` directly — it skips `scheduled` so no meaningless instant EventBridge event is created. Enforced by `chk_campaigns_dispatch_mode` (an immediate campaign can never sit in `scheduled`) |
| 5 | `audit_logs.action`: added `'send'` | Immediate dispatch is a different intent from future scheduling. Reusing `'schedule'` for both would blur the audit trail when querying "who sent this now" vs "who scheduled it"; a dedicated `'send'` keeps each action auditable on its own |

Everything else — tables, columns, indexes, constraints — is **unchanged**. Change #1 only adds enum values, #2 and #3 only remove dead weight, so code reading the old names is unaffected.

---

## 3. Which tables does each endpoint touch?

### 3.1 User-facing API (Campaign API Lambda)

| Endpoint | Reads | Writes | Audit (`audit_logs.action`) |
|---|---|---|---|
| `GET /campaigns` | campaigns | — | — |
| `POST /campaigns` | templates, segments | campaigns | `create` |
| `GET /campaigns/{id}` | campaigns | — | — |
| `PUT /campaigns/{id}` | campaigns | campaigns | `update` |
| `DELETE /campaigns/{id}` | — | campaigns | `delete` |
| `POST /campaigns/{id}/schedule` | — | campaigns | `schedule` |
| `POST /campaigns/{id}/send` | templates, segments | campaigns (status = `sending` directly, `scheduled_at = NOW()`, `dispatch_mode = 'immediate'`), audit `send`. No SQS/EventBridge wait — the Dispatcher runs immediately |
| `POST /campaigns/{id}/cancel` | — | campaigns | `cancel` |
| `GET /campaigns/{id}/logs` | email_logs | — | — |
| CRUD `/templates` | templates | templates | `create` / `update` / `delete` |
| `GET/POST /segments` | segments | segments | `create` / `update` |
| `POST /segments/{id}/preview` | segments, customers, email_suppressions | — | — |
| `GET /customers/{id}/preferences` | customers, email_suppressions | — | — |
| `PUT /customers/{id}/preferences` | — | email_suppressions | `opt_in` / `opt_out` |
| `GET /audit-logs` | audit_logs | — | — |

### 3.2 Background Lambdas (not in the API contract)

| Lambda | Table | What it does |
|---|---|---|
| **Dispatcher** (two triggers: EventBridge for `scheduled`, direct invoke for `immediate`) | campaigns, email_logs | Moves `scheduled` → `sending` (scheduled mode) or `draft` → `sending` (immediate mode); then `sending` → `completed` / `failed` |
| **Dispatcher** (per customer) | email_logs | Creates an `pending` row with an idempotency key, then `queued` |
| **Worker** (sends via SES) | email_logs | `queued` → `sent`, records `ses_message_id`; 3 failed retries → `failed` |
| **Event Handler** (SES webhook) | email_events | Inserts events, deduplicated by `deduplication_key` |
| **Event Handler** (status updates) | email_logs | `sent` → `delivered` / `bounced` / `complained`. Terminal states never revert |
| **Event Handler** (permanent bounce / complaint) | email_suppressions | Insert or update a blocklist row |

### 3.3 Cross-checks already verified

- Every mutating endpoint has a matching `audit_logs.action` value (change #1 in §2 closed the last gap).
- Every field in the contract's responses (`sendStatus`, `sesMessageId`, `attemptCount`, `changes`, ...) maps to an existing schema column.
- `GET /audit-logs` uses keyset cursor pagination; `idx_audit_logs_lookup` orders on `created_at DESC` which matches it, and the `userId` filter is covered by `idx_audit_logs_user`.
