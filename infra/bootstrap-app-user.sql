\getenv app_password CSEP_APP_PASSWORD

CREATE ROLE csep_app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE csep TO csep_app;
GRANT USAGE ON SCHEMA public TO csep_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  customers,
  segments,
  customer_segments,
  templates,
  campaigns,
  email_suppressions,
  email_logs,
  email_events
TO csep_app;
GRANT SELECT, INSERT ON TABLE audit_logs TO csep_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO csep_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT ON TABLES TO csep_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO csep_app;
