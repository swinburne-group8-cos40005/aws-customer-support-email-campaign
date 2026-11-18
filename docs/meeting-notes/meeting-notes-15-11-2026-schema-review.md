# Meeting Notes -- ERD to SQL Implementation and Constraint Verification

**Date:** 15 November 2026
**Project:** AWS Customer Support Email Campaign
**Meeting Type:** Database Schema & Testing Review (afternoon session, 3:43 PM; schema walkthrough continued in the evening)
**Topics:** ERD-to-SQL Translation, Seed Data Creation, and Database Constraint Verification

## 1. Meeting Purpose

The team reviewed the translation of the Entity-Relationship Diagram (ERD) into executable PostgreSQL DDL (`db/schema.sql`), inspected the SQL seed script (`db/seed.sql`) created for testing data insertion and constraints, and verified the automated test execution results.

## 2. ERD to SQL Schema Implementation (`db/schema.sql`)

The team walked through the PostgreSQL 16+ / Aurora Serverless v2 schema definition, verifying table structures, foreign key rules, indexes, and business-rule constraints:

- **Idempotent Schema Reset:** Configured top-down `DROP TABLE IF EXISTS ... CASCADE` statements alongside `CREATE EXTENSION IF NOT EXISTS "pgcrypto"` so the schema can be safely re-applied during testing.
- **Campaign State & Dispatch Constraints (`campaigns`):**
  - Enforced valid lifecycle states via `CHECK` constraint (`draft`, `scheduled`, `sending`, `completed`, `failed`, `cancelled`) and dispatch modes (`scheduled`, `immediate`).
  - `chk_campaigns_scheduled_at`: Ensures that any campaign in `scheduled` status has a non-null `scheduled_at` timestamp.
  - `chk_campaigns_dispatch_mode`: Enforces the invariant that an `immediate` campaign never sits in the `scheduled` state.
  - Added a partial index `idx_campaigns_scheduled_at` (`WHERE status = 'scheduled'`) so the dispatcher scans only due campaigns.
- **Suppression List & Dispatch Logs:**
  - `email_suppressions`: Keyed on `email_normalized` (`VARCHAR(255) PRIMARY KEY`) with a `CHECK` constraint restricting `reason` to `bounce`, `complaint`, `manual_opt_out`, or `customer_requested`.
  - `email_logs`: Tracks per-recipient delivery states (`pending`, `queued`, `sent`, `delivered`, `bounced`, `complained`, `failed`) with a unique `idempotency_key` (`campaign_id + customer_id`) to prevent duplicate sends.

## 3. Seed Data & Constraint Test Verification (`db/seed.sql`)

The team reviewed the SQL test data insertion script (`db/seed.sql`) and verified the execution results recorded in `docs/evidence/db-tests-2026-11-11.md`:

- **Check 1 -- Schema Apply:** Executed cleanly with no errors (`exit 0`), confirming valid DDL syntax and table creation ordering.

- **Check 2 -- Seed Data Load:** Inserted initial records cleanly (`exit 0`) with all 9 table row counts matching expected values, proving foreign keys and default column values work as intended.

- **Check 3 -- Foreign Key Cascade (`DELETE customer`):** Automatically removed associated junction rows (`6` $\rightarrow$ `4`), verifying `ON DELETE CASCADE` behaviour.

- **Check 4a -- Scheduled Campaign Without Timestamp:** Rejected inserting a `scheduled` campaign with `scheduled_at = NULL`, proving `chk_campaigns_scheduled_at`.

- **Check 4b -- Immediate Campaign in Scheduled State:** Rejected setting `dispatch_mode = 'immediate'` alongside `status = 'scheduled'`, proving `chk_campaigns_dispatch_mode`.

- **Check 4c -- Duplicate Idempotency Key:** Rejected duplicate `idempotency_key` entries in `email_logs`, proving `email_logs_idempotency_key_key` (R4).

- **Check 4d -- Invalid Enum Values:** Rejected invalid values across `status`, `action`, `reason`, and `event_type`, proving all four `CHECK` constraints.

- **Check 4e -- Duplicate Suppression Email:** Rejected duplicate entries in `email_suppressions`, proving `email_suppressions_pkey`.

- **Check 4f -- Case-Variant Email Handling:** Confirmed that case-variant emails insert separately at the database level; documented as an application-layer responsibility to normalise inputs via `lower(trim(email))`.

## 4. Meeting Outcomes & Follow-up Considerations

- Confirmed that the SQL schema accurately reflects the ERD and enforces critical campaign invariants at the database level.
- Verified that all schema creation, seed data loading, and negative constraint test cases passed without unexpected errors.
- **Follow-up Note (Test 4f):** Ensure the backend application layer consistently applies `lower(trim(email))` before querying or inserting into `email_suppressions`, as PostgreSQL primary keys are case-sensitive by default.

---

**Evidence:** Screenshots captured during the day showing the db-tests evidence review and issue #20 (3:43--3:48 PM) and the schema.sql walkthrough (9:04--9:08 PM); files `15-11-schema-review-1.jpg`--`15-11-schema-review-5.jpg` in `local-only-non-commit/meeting-screenshot/` (numbered in session order).
