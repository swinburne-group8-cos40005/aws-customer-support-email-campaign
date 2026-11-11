-- Seed data for local development / docker tests. Run AFTER db/schema.sql:
--   psql -d app -f db/schema.sql
--   psql -d app -f db/seed.sql
-- Fixed UUIDs make tables easy to eyeball. Safe to re-run: children are
-- deleted first inside one transaction.

BEGIN;

DELETE FROM audit_logs;
DELETE FROM email_events;
DELETE FROM email_logs;
DELETE FROM email_suppressions;
DELETE FROM campaigns;
DELETE FROM customer_segments;
DELETE FROM templates;
DELETE FROM segments;
DELETE FROM customers;

-- 6 customers covering both segments and both suppression causes.
INSERT INTO customers (customer_id, email, first_name, attributes, created_at) VALUES
    ('00000000-0000-4000-8000-000000000001', 'an.lam@example.com',      'An',   '{"city": "Hanoi", "tier": "gold", "points": 250}',  '2026-09-01T10:00:00+07:00'),
    ('00000000-0000-4000-8000-000000000002', 'binh.nguyen@example.com', 'Binh', '{"city": "Hanoi", "tier": "silver", "points": 90}', '2026-09-02T10:00:00+07:00'),
    ('00000000-0000-4000-8000-000000000003', 'chi.tran@example.com',    'Chi',  '{"city": "Da Nang", "tier": "gold", "points": 310}', '2026-09-03T10:00:00+07:00'),
    ('00000000-0000-4000-8000-000000000004', 'duy.pham@example.com',    'Duy',  '{"city": "Ho Chi Minh", "tier": "bronze", "points": 10}', '2026-09-04T10:00:00+07:00'),
    ('00000000-0000-4000-8000-000000000005', 'hang.le@example.com',     'Hang', '{"city": "Hanoi", "tier": "gold", "points": 540}',  '2026-09-05T10:00:00+07:00'),
    ('00000000-0000-4000-8000-000000000006', 'khoa.vo@example.com',     'Khoa', '{"city": "Da Nang", "tier": "silver", "points": 130}', '2026-09-06T10:00:00+07:00');

INSERT INTO segments (segment_id, name, description, rules, created_at) VALUES
    ('11111111-1111-4000-8000-000000000001', 'Gold Customers', 'Loyalty tier = gold', '{"field": "tier", "op": "eq", "value": "gold"}', '2026-09-10T09:00:00+07:00'),
    ('11111111-1111-4000-8000-000000000002', 'Hanoi Base',      'Customers in Hanoi',  '{"field": "city", "op": "eq", "value": "Hanoi"}', '2026-09-10T09:05:00+07:00');

INSERT INTO customer_segments (customer_id, segment_id) VALUES
    ('00000000-0000-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001'),
    ('00000000-0000-4000-8000-000000000003', '11111111-1111-4000-8000-000000000001'),
    ('00000000-0000-4000-8000-000000000005', '11111111-1111-4000-8000-000000000001'),
    ('00000000-0000-4000-8000-000000000001', '11111111-1111-4000-8000-000000000002'),
    ('00000000-0000-4000-8000-000000000002', '11111111-1111-4000-8000-000000000002'),
    ('00000000-0000-4000-8000-000000000005', '11111111-1111-4000-8000-000000000002');

INSERT INTO templates (template_id, name, subject_template, body_text, body_html, created_at) VALUES
    ('22222222-2222-4000-8000-000000000001', 'Monthly Newsletter', 'Hi {{first_name}}, your monthly roundup',
        'Hello {{first_name}}, you currently hold {{points}} loyalty points. Here is what is new this month.',
        '<p>Hello {{first_name}},</p><p>You currently hold {{points}} loyalty points.</p>',
        '2026-09-12T14:00:00+07:00'),
    ('22222222-2222-4000-8000-000000000002', 'Gold Exclusive', 'A thank-you for our gold members, {{first_name}}',
        'As a gold member you get early access to November deals.',
        '<p>As a <strong>gold member</strong> you get early access to November deals.</p>',
        '2026-09-20T11:00:00+07:00');

-- k1: completed, went through EventBridge (dispatch_mode = 'scheduled')
-- k2: scheduled, waiting for EventBridge (future timestamp)
-- k3: draft, not dispatched yet (scheduled_at NULL is fine for drafts)
INSERT INTO campaigns (campaign_id, name, template_id, segment_id, status, dispatch_mode, scheduled_at, created_by, created_at, updated_at) VALUES
    ('33333333-3333-4000-8000-000000000001', 'October Monthly Newsletter', '22222222-2222-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'completed', 'scheduled', '2026-10-15T09:00:00+07:00', 'usr-agent-anh-001', '2026-10-01T10:00:00+07:00', '2026-10-15T09:11:00+07:00'),
    ('33333333-3333-4000-8000-000000000002', 'November Gold Exclusive',   '22222222-2222-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'scheduled', 'scheduled', '2026-11-15T09:00:00+07:00', 'usr-agent-anh-001', '2026-11-01T15:00:00+07:00', '2026-11-01T15:10:00+07:00'),
    ('33333333-3333-4000-8000-000000000003', 'Black Friday Early Access', '22222222-2222-4000-8000-000000000001', '11111111-1111-4000-8000-000000000002', 'draft',     'scheduled', NULL,                        'usr-agent-ba-002',  '2026-11-09T08:00:00+07:00', '2026-11-09T08:00:00+07:00');

INSERT INTO email_suppressions (email_normalized, reason, created_at) VALUES
    ('hang.le@example.com', 'bounce',          '2026-10-15T09:08:00+07:00'),  -- permanent bounce during k1
    ('khoa.vo@example.com', 'manual_opt_out',  '2026-10-20T13:30:00+07:00');  -- agent-entered opt-out

-- idempotency keys are stand-ins for SHA-256(campaign_id + customer_id); the real
-- value is generated at runtime. k1 had 3 recipients (gold segment members):
-- 2 delivered, 1 permanent bounce (which produced the hang.le suppression above).
INSERT INTO email_logs (email_log_id, campaign_id, customer_id, recipient_email, send_status, ses_message_id, idempotency_key, attempt_count, created_at, updated_at) VALUES
    ('44444444-4444-4000-8000-000000000001', '33333333-3333-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'an.lam@example.com',  'delivered', 'ses-0100001-an',  'idem-k1-c1', 1, '2026-10-15T09:01:00+07:00', '2026-10-15T09:05:00+07:00'),
    ('44444444-4444-4000-8000-000000000003', '33333333-3333-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'chi.tran@example.com', 'delivered', 'ses-0100001-chi', 'idem-k1-c3', 1, '2026-10-15T09:01:00+07:00', '2026-10-15T09:05:00+07:00'),
    ('44444444-4444-4000-8000-000000000005', '33333333-3333-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'hang.le@example.com',  'bounced',   'ses-0100001-hang','idem-k1-c5', 1, '2026-10-15T09:01:00+07:00', '2026-10-15T09:08:00+07:00');

-- Raw SES feedback for the logs above (deduplication_key blocks redeliveries).
INSERT INTO email_events (email_log_id, ses_message_id, event_type, event_at, event_details, deduplication_key) VALUES
    ('44444444-4444-4000-8000-000000000001', 'ses-0100001-an',  'send',     '2026-10-15T09:02:00+07:00', '{"note": "SES accepted message"}',                'k1-an-send'),
    ('44444444-4444-4000-8000-000000000001', 'ses-0100001-an',  'delivery', '2026-10-15T09:05:00+07:00', '{"note": "delivered to mailbox"}',                'k1-an-delivery'),
    ('44444444-4444-4000-8000-000000000003', 'ses-0100001-chi', 'send',     '2026-10-15T09:02:00+07:00', '{"note": "SES accepted message"}',                'k1-chi-send'),
    ('44444444-4444-4000-8000-000000000003', 'ses-0100001-chi', 'delivery', '2026-10-15T09:05:00+07:00', '{"note": "delivered to mailbox"}',                'k1-chi-delivery'),
    ('44444444-4444-4000-8000-000000000005', 'ses-0100001-hang','send',     '2026-10-15T09:02:00+07:00', '{"note": "SES accepted message"}',                'k1-hang-send'),
    ('44444444-4444-4000-8000-000000000005', 'ses-0100001-hang','bounce',   '2026-10-15T09:08:00+07:00', '{"bounceType": "Permanent", "diagnostic": "address does not exist"}', 'k1-hang-bounce');

-- audit_logs: human actions only. k1/k2 create + schedule by Agent Anh,
-- k3 create by Agent Ba, and Khoa's opt-out (row above in email_suppressions).
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, created_at) VALUES
    ('usr-agent-anh-001', 'create',   'campaign',             '33333333-3333-4000-8000-000000000001', '{"before": null, "after": {"name": "October Monthly Newsletter", "status": "draft"}}', '2026-10-01T10:00:00+07:00'),
    ('usr-agent-anh-001', 'schedule', 'campaign',             '33333333-3333-4000-8000-000000000001', '{"before": {"status": "draft", "scheduledAt": null}, "after": {"status": "scheduled", "scheduledAt": "2026-10-15T09:00:00+07:00"}}', '2026-10-05T14:00:00+07:00'),
    ('usr-agent-anh-001', 'create',   'campaign',             '33333333-3333-4000-8000-000000000002', '{"before": null, "after": {"name": "November Gold Exclusive", "status": "draft"}}', '2026-11-01T15:00:00+07:00'),
    ('usr-agent-anh-001', 'schedule', 'campaign',             '33333333-3333-4000-8000-000000000002', '{"before": {"status": "draft", "scheduledAt": null}, "after": {"status": "scheduled", "scheduledAt": "2026-11-15T09:00:00+07:00"}}', '2026-11-01T15:10:00+07:00'),
    ('usr-agent-ba-002',  'create',   'campaign',             '33333333-3333-4000-8000-000000000003', '{"before": null, "after": {"name": "Black Friday Early Access", "status": "draft"}}', '2026-11-09T08:00:00+07:00'),
    ('usr-agent-anh-001', 'opt_out',  'customer_preference',  '00000000-0000-4000-8000-000000000006', '{"before": {"isOptedOut": false}, "after": {"isOptedOut": true, "reason": "manual_opt_out"}}', '2026-10-20T13:30:00+07:00');

COMMIT;
