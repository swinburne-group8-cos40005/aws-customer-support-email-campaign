-- Target: PostgreSQL 15+ / Aurora Serverless v2. Tables drop top-down so this can re-run.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS email_events CASCADE;
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS email_suppressions CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS customer_segments CASCADE;
DROP TABLE IF EXISTS segments CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Recipient profiles. `attributes` holds template placeholder values.
CREATE TABLE customers (
    customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL UNIQUE,       -- UNIQUE already creates the index
    first_name  VARCHAR(100),
    attributes  JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"city": "Hanoi", "tier": "gold"}
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_attributes ON customers USING GIN (attributes);

-- Audience groups. `rules` is a filter tree evaluated at dispatch time.
CREATE TABLE segments (
    segment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    rules       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- M2M: which customers belong to which segments.
CREATE TABLE customer_segments (
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    segment_id  UUID NOT NULL REFERENCES segments(segment_id)  ON DELETE CASCADE,
    PRIMARY KEY (customer_id, segment_id)
);

CREATE INDEX idx_cust_seg_segment_id ON customer_segments (segment_id);

-- Reusable email content, body placeholders use {{attribute}}.
CREATE TABLE templates (
    template_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(150) NOT NULL,
    subject_template VARCHAR(255) NOT NULL,
    body_text        TEXT,
    body_html        TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaign states: draft -> scheduled -> sending -> completed/failed, scheduled -> cancelled.
-- Immediate send: scheduled_at = NOW() but flows draft -> sending directly, skipping
-- 'scheduled' (no EventBridge rule, no scheduler event). dispatch_mode records the path.
-- Transitions are enforced with conditional updates in the app.
CREATE TABLE campaigns (
    campaign_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(150) NOT NULL,
    template_id  UUID NOT NULL REFERENCES templates(template_id) ON DELETE RESTRICT,
    segment_id   UUID NOT NULL REFERENCES segments(segment_id)   ON DELETE RESTRICT,
    status       VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled')
    ),
    dispatch_mode VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (
        dispatch_mode IN ('scheduled', 'immediate')      -- set at POST /send or /schedule
    ),
    scheduled_at TIMESTAMPTZ,             -- NOW() when dispatch_mode = 'immediate'

    -- Invariants (CASE reads like plain English: "when X then Y"):
    -- 1. a campaign waiting for EventBridge must have a send time
    -- 2. an immediate campaign never sits in 'scheduled' (nothing to wait for)
    CONSTRAINT chk_campaigns_scheduled_at
        CHECK (
            CASE
                WHEN status = 'scheduled'
                THEN scheduled_at IS NOT NULL
                ELSE TRUE
            END),

    CONSTRAINT chk_campaigns_dispatch_mode
        CHECK (
            CASE
                WHEN dispatch_mode = 'immediate'
                THEN status <> 'scheduled'
                ELSE TRUE
            END),

    created_by   VARCHAR(100) NOT NULL,             -- Cognito sub claim
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_status ON campaigns (status);
CREATE INDEX idx_campaigns_scheduled_at ON campaigns (scheduled_at)
    WHERE status = 'scheduled';                     -- Dispatcher only scans due campaigns

-- Global opt-out list. Keyed on lower(trim(email)) for fast lookups.
-- Opt-in = delete the row.
CREATE TABLE email_suppressions (
    email_normalized VARCHAR(255) PRIMARY KEY,
    reason VARCHAR(50) NOT NULL CHECK (
        reason IN ('bounce', 'complaint', 'manual_opt_out', 'customer_requested')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per (campaign, recipient). Source of truth for the send pipeline.
-- idempotency_key = SHA-256(campaign_id + customer_id); UNIQUE blocks duplicate sends.
CREATE TABLE email_logs (
    email_log_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id      UUID NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    customer_id      UUID REFERENCES customers(customer_id) ON DELETE SET NULL,
    recipient_email  VARCHAR(255) NOT NULL,
    send_status      VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        send_status IN ('pending', 'queued', 'sent', 'delivered', 'bounced', 'complained', 'failed')
    ),
    ses_message_id   VARCHAR(255),                  -- set once SES accepts the send
    idempotency_key  VARCHAR(255) NOT NULL UNIQUE,
    attempt_count    INT NOT NULL DEFAULT 0,
    last_error       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_logs_campaign_customer ON email_logs (campaign_id, customer_id);
CREATE INDEX idx_email_logs_ses_message_id ON email_logs (ses_message_id);
CREATE INDEX idx_email_logs_send_status ON email_logs (campaign_id, send_status);

-- Raw SES webhook events (send/delivery/bounce/complaint...).
-- deduplication_key turns SES redeliveries into no-ops.
CREATE TABLE email_events (
    event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_log_id      UUID NOT NULL REFERENCES email_logs(email_log_id) ON DELETE CASCADE,
    ses_message_id    VARCHAR(255),
    event_type        VARCHAR(50) NOT NULL CHECK (
        event_type IN ('send', 'delivery', 'bounce', 'complaint', 'reject', 'open', 'click')
    ),
    event_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_details     JSONB NOT NULL DEFAULT '{}'::jsonb, -- raw SES payload
    deduplication_key VARCHAR(255) UNIQUE
);

CREATE INDEX idx_email_events_log_id ON email_events (email_log_id);
CREATE INDEX idx_email_events_type ON email_events (event_type);

-- Audit trail of human actions only (FR9). Worker/webhook activity lives elsewhere.
CREATE TABLE audit_logs (
    audit_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      VARCHAR(100) NOT NULL,             -- Cognito sub claim
    action       VARCHAR(50) NOT NULL CHECK (
        action IN ('create', 'update', 'delete', 'schedule', 'send', 'cancel',
                   'opt_in', 'opt_out')              -- 'send' = immediate dispatch
    ),
    entity_type  VARCHAR(50) NOT NULL CHECK (
        entity_type IN ('campaign', 'template', 'segment', 'customer_preference')
    ),
    entity_id    UUID NOT NULL,
    changes      JSONB NOT NULL DEFAULT '{}'::jsonb, -- before/after diff
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_lookup ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, created_at DESC);

-- Keeps updated_at fresh regardless of which component writes the row.
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_campaigns
BEFORE UPDATE ON campaigns
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_templates
BEFORE UPDATE ON templates
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_email_logs
BEFORE UPDATE ON email_logs
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
