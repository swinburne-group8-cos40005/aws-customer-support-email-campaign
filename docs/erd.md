# Database ERD

- **Purpose:** Visual confirmation of the 9-table Aurora PostgreSQL schema (`db/schema.sql`). One row = one table; arrows = foreign keys.
- **Source of truth:** `db/schema.sql`.

```mermaid
erDiagram
    CUSTOMERS ||--o{ CUSTOMER_SEGMENTS : "belongs to"
    SEGMENTS  ||--o{ CUSTOMER_SEGMENTS : "contains"

    SEGMENTS    ||--o{ CAMPAIGNS : "targets"
    TEMPLATES   ||--o{ CAMPAIGNS : "provides content"

    CAMPAIGNS   ||--o{ EMAIL_LOGS : "dispatches"
    CUSTOMERS   ||--o{ EMAIL_LOGS : "receives"

    EMAIL_LOGS  ||--o{ EMAIL_EVENTS : "produces"

    CUSTOMERS {
        UUID customer_id PK
        VARCHAR email UK "unique, no extra index"
        VARCHAR first_name
        JSONB attributes "placeholder values"
        timestamptz created_at
    }

    SEGMENTS {
        UUID segment_id PK
        VARCHAR name
        TEXT description
        JSONB rules "filter tree"
        timestamptz created_at
    }

    CUSTOMER_SEGMENTS {
        UUID customer_id FK "part of composite PK"
        UUID segment_id FK "part of composite PK"
    }

    TEMPLATES {
        UUID template_id PK
        VARCHAR name
        VARCHAR subject_template
        TEXT body_text
        TEXT body_html
        timestamptz created_at
        timestamptz updated_at
    }

    CAMPAIGNS {
        UUID campaign_id PK
        VARCHAR name
        UUID template_id FK "ON DELETE RESTRICT"
        UUID segment_id FK "ON DELETE RESTRICT"
        VARCHAR status "draft|scheduled|sending|completed|failed|cancelled"
        VARCHAR dispatch_mode "scheduled|immediate (default scheduled)"
        timestamptz scheduled_at "NOW() for immediate; immediate never sits in 'scheduled'"
        VARCHAR created_by "Cognito sub"
        timestamptz created_at
        timestamptz updated_at
    }

    EMAIL_SUPPRESSIONS {
        VARCHAR email_normalized PK "lower(trim(email))"
        VARCHAR reason "bounce|complaint|manual_opt_out|customer_requested"
        timestamptz created_at
    }

    EMAIL_LOGS {
        UUID email_log_id PK
        UUID campaign_id FK "ON DELETE CASCADE"
        UUID customer_id FK "ON DELETE SET NULL"
        VARCHAR recipient_email
        VARCHAR send_status "pending|queued|sent|delivered|bounced|complained|failed"
        VARCHAR ses_message_id
        VARCHAR idempotency_key UK "SHA-256(campaign+customer)"
        INT attempt_count
        TEXT last_error
        timestamptz created_at
        timestamptz updated_at
    }

    EMAIL_EVENTS {
        UUID event_id PK
        UUID email_log_id FK "ON DELETE CASCADE"
        VARCHAR ses_message_id
        VARCHAR event_type "send|delivery|bounce|complaint|reject|open|click"
        timestamptz event_at
        JSONB event_details "raw SES payload"
        VARCHAR deduplication_key UK "blocks redeliveries"
    }

    AUDIT_LOGS {
        UUID audit_log_id PK
        VARCHAR user_id "Cognito sub"
        VARCHAR action "create|update|delete|schedule|cancel|opt_in|opt_out"
        VARCHAR entity_type "campaign|template|segment|customer_preference"
        UUID entity_id "no FK: audits survive target deletes"
        JSONB changes "before/after diff"
        timestamptz created_at
    }
```

## Relationship summary

| Relationship | Cardinality | Delete behavior |
|---|---|---|
| segments → customer_segments → customers | M:N via junction | CASCADE on both sides |
| segments → campaigns | 1:N | RESTRICT (referenced segment cannot be deleted) |
| templates → campaigns | 1:N | RESTRICT (referenced template cannot be deleted) |
| campaigns → email_logs | 1:N | CASCADE |
| customers → email_logs | 1:N | SET NULL (history kept, `recipient_email` denormalized) |
| email_logs → email_events | 1:N | CASCADE |
| email_suppressions | standalone | keyed on normalized email, no FK |
| audit_logs | standalone | `entity_id` is a bare UUID, no FK |

`email_suppressions` and `audit_logs` are intentionally connection-free tables: suppressions are looked up by email string, audit rows must outlive the entities they describe.
