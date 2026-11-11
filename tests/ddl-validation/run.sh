#!/usr/bin/env bash
# =============================================================================
# DDL validation tests — run against a throwaway postgres:15 container.
#
# Verifies db/schema.sql + db/seed.sql and the DB-level guarantees:
#   - schema/seed apply cleanly
#   - FK cascade (customers -> customer_segments)
#   - chk_campaigns_scheduled_at, chk_campaigns_dispatch_mode (immediate send)
#   - email_logs.idempotency_key UNIQUE (Risk R4: no duplicate sends)
#   - CHECK enums on campaigns.status / audit_logs.action /
#     email_suppressions.reason / email_events.event_type
#   - email_suppressions PK (exact duplicates rejected)
#   - trigger_set_timestamp keeps updated_at fresh
#
# Usage:
#   ./tests/ddl-validation/run.sh                 # run everything, exit 0 on pass
#   KEEP_CONTAINER=1 ./tests/ddl-validation/run.sh   # keep container for debugging
#   IMAGE=postgres:15 CONTAINER=my-pg ./tests/ddl-validation/run.sh
#
# Full psql transcript is written to tests/ddl-validation/transcript.log
# (gitignored). Exit code: 0 = all assertions passed, 1 = at least one failed.
# =============================================================================
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCHEMA="$REPO_ROOT/db/schema.sql"
SEED="$REPO_ROOT/db/seed.sql"
IMAGE="${IMAGE:-postgres:15}"
CONTAINER="${CONTAINER:-pg15-ddl-validation}"
LOG="${LOG_FILE:-$REPO_ROOT/tests/ddl-validation/transcript.log}"
KEEP_CONTAINER="${KEEP_CONTAINER:-0}"

mkdir -p "$(dirname "$LOG")"
: > "$LOG"

PASS=0
FAIL=0
declare -a RESULTS=()

section() {
  printf '\n=====================================================================\n== %s\n=====================================================================\n' "$1" | tee -a "$LOG"
}

# scalar query helper: prints just the value
scalar() {
  docker exec "$CONTAINER" psql -U postgres -d app -tA -c "$1"
}

record() {  # record PASS|FAIL "label" "detail"
  RESULTS+=("$1  $2 — $3")
  if [ "$1" = "PASS" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
}

# expect_fail "label" "required error pattern" <<SQL
expect_fail() {
  local label="$1" pattern="$2" out rc
  out=$(docker exec -i "$CONTAINER" psql -U postgres -d app -v ON_ERROR_STOP=1 2>&1)
  rc=$?
  printf '%s\n' "$out" >> "$LOG"
  if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q "$pattern"; then
    record PASS "$label" "rejected via $pattern"
  else
    record FAIL "$label" "expected rejection mentioning '$pattern' (exit $rc)"
  fi
}

assert_eq() {  # assert_eq "label" expected actual
  if [ "$2" = "$3" ]; then
    record PASS "$1" "$3"
  else
    record FAIL "$1" "expected '$2', got '$3'"
  fi
}

cleanup() {
  if [ "$KEEP_CONTAINER" = "1" ]; then
    echo "KEEP_CONTAINER=1 -> container '$CONTAINER' left running for debugging."
  else
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# -----------------------------------------------------------------------------
section "0. PREREQUISITES"
docker info >/dev/null 2>&1 || { echo "ERROR: docker daemon not reachable" | tee -a "$LOG"; exit 2; }
[ -f "$SCHEMA" ] || { echo "ERROR: $SCHEMA not found" | tee -a "$LOG"; exit 2; }
[ -f "$SEED" ]   || { echo "ERROR: $SEED not found"   | tee -a "$LOG"; exit 2; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker pull "$IMAGE" >> "$LOG" 2>&1
echo "image: $IMAGE" | tee -a "$LOG"

section "1. START CONTAINER"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app "$IMAGE" >> "$LOG" 2>&1 || {
  echo "ERROR: could not start container" | tee -a "$LOG"; exit 2; }
for _ in $(seq 1 30); do
  docker exec "$CONTAINER" pg_isready -U postgres -d app >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres -d app | tee -a "$LOG"

# -----------------------------------------------------------------------------
section "2. SCHEMA APPLY — must be clean"
docker cp "$SCHEMA" "$CONTAINER":/tmp/schema.sql >> "$LOG" 2>&1
out=$(docker exec -i "$CONTAINER" psql -U postgres -d app -v ON_ERROR_STOP=1 -q -f /tmp/schema.sql 2>&1)
rc=$?
printf '%s\n' "$out" >> "$LOG"
if [ $rc -eq 0 ] && ! printf '%s' "$out" | grep -q '^ERROR'; then
  record PASS "schema apply" "no ERROR lines, exit 0"
else
  record FAIL "schema apply" "ERROR during apply"
fi

# -----------------------------------------------------------------------------
section "3. SEED LOAD — must be clean"
docker cp "$SEED" "$CONTAINER":/tmp/seed.sql >> "$LOG" 2>&1
out=$(docker exec -i "$CONTAINER" psql -U postgres -d app -v ON_ERROR_STOP=1 -f /tmp/seed.sql 2>&1)
rc=$?
printf '%s\n' "$out" >> "$LOG"
if [ $rc -eq 0 ] && ! printf '%s' "$out" | grep -q '^ERROR'; then
  record PASS "seed load" "no ERROR lines, exit 0"
else
  record FAIL "seed load" "ERROR during load"
fi
TOTALS=$(scalar "SELECT string_agg(t || '=' || c, ',')
                FROM (SELECT 'customers' t, count(*) c FROM customers
                      UNION ALL SELECT 'segments', count(*) FROM segments
                      UNION ALL SELECT 'customer_segments', count(*) FROM customer_segments
                      UNION ALL SELECT 'templates', count(*) FROM templates
                      UNION ALL SELECT 'campaigns', count(*) FROM campaigns
                      UNION ALL SELECT 'email_suppressions', count(*) FROM email_suppressions
                      UNION ALL SELECT 'email_logs', count(*) FROM email_logs
                      UNION ALL SELECT 'email_events', count(*) FROM email_events
                      UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs) s")
assert_eq "seed row counts" \
  "customers=6,segments=2,customer_segments=6,templates=2,campaigns=3,email_suppressions=2,email_logs=3,email_events=6,audit_logs=6" \
  "$TOTALS"

# -----------------------------------------------------------------------------
section "4. FK CASCADE — DELETE customer removes junction rows"
assert_eq "cascade: junction rows before" "6" "$(scalar "SELECT count(*) FROM customer_segments;")"
docker exec "$CONTAINER" psql -U postgres -d app -c \
  "DELETE FROM customers WHERE customer_id = '00000000-0000-4000-8000-000000000001';" | tee -a "$LOG"
assert_eq "cascade: rows left for deleted customer" "0" \
  "$(scalar "SELECT count(*) FROM customer_segments WHERE customer_id = '00000000-0000-4000-8000-000000000001';")"
assert_eq "cascade: junction rows after" "4" "$(scalar "SELECT count(*) FROM customer_segments;")"

# -----------------------------------------------------------------------------
section "5a. status='scheduled' + scheduled_at=NULL -> chk_campaigns_scheduled_at"
expect_fail "immediate timestamp invariant" "chk_campaigns_scheduled_at" <<'SQL'
INSERT INTO campaigns (name, template_id, segment_id, status, created_by)
VALUES ('neg-5a', '22222222-2222-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'scheduled', 'usr-test');
SQL

section "5b. dispatch_mode='immediate' + status='scheduled' -> chk_campaigns_dispatch_mode"
expect_fail "immediate mode invariant" "chk_campaigns_dispatch_mode" <<'SQL'
INSERT INTO campaigns (name, template_id, segment_id, status, dispatch_mode, created_by)
VALUES ('neg-5b', '22222222-2222-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'scheduled', 'immediate', 'usr-test');
SQL

section "5c. duplicate idempotency_key -> UNIQUE (Risk R4)"
expect_fail "idempotency_key UNIQUE" "email_logs_idempotency_key_key" <<'SQL'
INSERT INTO email_logs (campaign_id, customer_id, recipient_email, idempotency_key)
VALUES ('33333333-3333-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'an.lam@example.com', 'idem-k1-c1');
SQL

section "5d. invalid enum values -> CHECK rejections"
expect_fail "campaigns.status enum"     "campaigns_status_check" <<'SQL'
INSERT INTO campaigns (name, template_id, segment_id, status, created_by)
VALUES ('neg-5d-a', '22222222-2222-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', 'archived', 'usr-test');
SQL
expect_fail "audit_logs.action enum"    "audit_logs_action_check" <<'SQL'
INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
VALUES ('usr-test', 'export', 'campaign', '33333333-3333-4000-8000-000000000001');
SQL
expect_fail "email_suppressions.reason" "email_suppressions_reason_check" <<'SQL'
INSERT INTO email_suppressions (email_normalized, reason) VALUES ('x.y@example.com', 'unsubscribe');
SQL
expect_fail "email_events.event_type"   "email_events_event_type_check" <<'SQL'
INSERT INTO email_events (email_log_id, event_type)
VALUES ('44444444-4444-4000-8000-000000000001', 'forward');
SQL

section "5e. duplicate email_suppressions row -> PK"
expect_fail "suppressions PK" "email_suppressions_pkey" <<'SQL'
INSERT INTO email_suppressions (email_normalized, reason) VALUES ('hang.le@example.com', 'bounce');
SQL
# Documented finding (see docs/evidence/db-tests-2026-11-11.md): VARCHAR PK is
# byte-exact, so case variants slip through; normalization is the app layer's
# job (lower(trim(email)) before insert). Keep the DB behaviour pinned so a
# future citext change is a conscious decision.
out=$(docker exec -i "$CONTAINER" psql -U postgres -d app -c \
  "INSERT INTO email_suppressions (email_normalized, reason) VALUES ('HANG.LE@EXAMPLE.COM', 'bounce');" 2>&1)
printf '%s\n' "$out" >> "$LOG"
if printf '%s' "$out" | grep -q 'INSERT 0 1'; then
  record PASS "case-variant email behaviour (documented finding)" "insert succeeds as designed, app-layer normalization"
  docker exec "$CONTAINER" psql -U postgres -d app -c \
    "DELETE FROM email_suppressions WHERE email_normalized = 'HANG.LE@EXAMPLE.COM';" >> "$LOG" 2>&1
else
  record FAIL "case-variant email behaviour (documented finding)" "unexpected rejection — schema changed?"
fi

# -----------------------------------------------------------------------------
section "6. TRIGGER — updated_at auto-advanced on UPDATE"
BEFORE=$(scalar "SELECT updated_at FROM campaigns WHERE campaign_id = '33333333-3333-4000-8000-000000000001';")
BEFORE_CREATED=$(scalar "SELECT created_at FROM campaigns WHERE campaign_id = '33333333-3333-4000-8000-000000000001';")
docker exec "$CONTAINER" psql -U postgres -d app -c \
  "UPDATE campaigns SET name = 'October Monthly Newsletter (edited)'
   WHERE campaign_id = '33333333-3333-4000-8000-000000000001';" | tee -a "$LOG"
AFTER=$(scalar "SELECT updated_at FROM campaigns WHERE campaign_id = '33333333-3333-4000-8000-000000000001';")
if [ "$BEFORE" != "$AFTER" ]; then
  record PASS "trigger_set_timestamp" "updated_at advanced ($BEFORE -> $AFTER)"
else
  record FAIL "trigger_set_timestamp" "updated_at did not change"
fi
assert_eq "created_at untouched by update" "$BEFORE_CREATED" \
  "$(scalar "SELECT created_at FROM campaigns WHERE campaign_id = '33333333-3333-4000-8000-000000000001';")"

# -----------------------------------------------------------------------------
section "SUMMARY"
printf '%s\n' "${RESULTS[@]}" | tee -a "$LOG"
echo | tee -a "$LOG"
echo "passed: $PASS  failed: $FAIL" | tee -a "$LOG"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
