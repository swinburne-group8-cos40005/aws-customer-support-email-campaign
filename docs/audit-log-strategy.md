# System Audit Logging Strategy (FR9 Compliance)

- **Author:** Dang Quang (Backend API & Database Lead)
- **Objective:** Satisfy Functional Requirement FR9 ("Important changes to campaigns must be recorded in an audit log") and provide traceable compliance data for Customer Support Managers (US04).

---

## 1. Problem Statement & Design Challenge
A naive audit-logging strategy risks two failure modes:
1. **Low-value data inflation:** Logging high-frequency worker loop updates (e.g., millions of SQS batch state updates) degrades database I/O and buries human actions under machine noise.
2. **Missing compliance accountability:** Failing to capture before-and-after states prevents managers from identifying who modified sensitive campaign parameters or rescheduled dispatches.

---

## 2. Audit Scope & Noise Filtering Strategy

### 2.1 What IS Logged (Mutating API Endpoints Only)
Only interactive, user-initiated actions originating from the Campaign API Lambda are audited:
* `POST /campaigns` $\rightarrow$ Action: `create`
* `PUT /campaigns/{id}` $\rightarrow$ Action: `update`
* `DELETE /campaigns/{id}` $\rightarrow$ Action: `delete`
* `POST /campaigns/{id}/schedule` $\rightarrow$ Action: `schedule`
* `POST /campaigns/{id}/cancel` $\rightarrow$ Action: `cancel`
* `POST /campaigns/{id}/send` $\rightarrow$ Action: `send` (immediate dispatch; kept separate from `schedule` so the audit trail distinguishes "sent now" from "scheduled for later")
* Template mutations (`create`, `update`, `delete`)
* Customer suppression preference changes (`opt_out`, `opt_in`)

### 2.2 What is NOT Logged (Excluded Automated Noise)
* High-frequency Worker Lambda execution cycles.
* Automated status transitions triggered by SES webhook callbacks (these are recorded in `email_events`, not `audit_logs`).
* Read-only `GET` queries.
* UI autosave draft events.

---

## 3. Database Schema Definition

```sql
CREATE TABLE audit_logs (
    audit_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,          -- Cognito Subject (sub) claim
    action VARCHAR(50) NOT NULL,            -- create | update | delete | schedule | cancel
    entity_type VARCHAR(50) NOT NULL,       -- campaign | template | segment | customer_preference
    entity_id UUID NOT NULL,                -- Target primary key
    changes JSONB NOT NULL DEFAULT '{}'::jsonb, -- Structured before/after diff
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compound index for fast dashboard filtering & pagination
CREATE INDEX idx_audit_logs_lookup ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, created_at DESC);
```

---

## 4. JSONB Diff Generation Pattern

When an `update` occurs, the API Lambda executes a lightweight payload differ against the existing row:

### Example Diff Payload (`changes` column):
```json
{
  "before": {
    "name": "Draft Newsletter",
    "templateId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "status": "draft"
  },
  "after": {
    "name": "Official October Newsletter",
    "templateId": "99999999-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "status": "scheduled"
  }
}
```
This structured format allows the frontend dashboard to render human-readable changelogs (e.g., *"User changed Template from ID A to ID B"*).

---

## 5. Performance & Transaction Safety
Audit logs are inserted within the **same relational database transaction** as the mutating operation. If the campaign update fails, the audit record rolls back automatically, guaranteeing zero orphaned or misleading audit entries.