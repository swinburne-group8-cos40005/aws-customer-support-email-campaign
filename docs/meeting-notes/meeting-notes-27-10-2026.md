# Meeting Notes -- Database Schema and Relationships

**Date:** 27 October 2026\
**Project:** AWS Customer Support Email Campaign\
**Meeting type:** Team design review\
**Topic:** Database schema, entity relationships, and constraints

> **Note:** These notes are reconstructed from screenshots of the team
> meeting and the database design displayed during the discussion. They
> summarise the visible design decisions and are not a verbatim meeting
> transcript.

## 1. Meeting purpose

The team reviewed the proposed database design in `docs/erd.md`,
including the entity relationship diagram and the relationship summary.
The aim was to align on the main database entities, how they relate to
one another, and the constraints that should be followed during
implementation.

## 2. Database entities reviewed

The displayed ERD included the following main entities:

- `customers`
- `segments`
- `customer_segments`
- `templates`
- `campaigns`
- `email_logs`
- `email_events`
- `email_suppressions`
- `audit_logs`

The team reviewed how customer records, segments, campaign
configuration, email activity, suppression records, and audit
information would be represented in the database.

## 3. Relationships and delete behaviour

The relationship summary displayed during the meeting recorded these
relationships:

- `segments` → `customer_segments` → `customers`: many-to-many
  relationship through the junction table. Deleting a segment or
  customer cascades to the related junction records.
- `segments` → `campaigns`: one-to-many. A segment referenced by a
  campaign cannot be deleted (`RESTRICT`).
- `templates` → `campaigns`: one-to-many. A template referenced by a
  campaign cannot be deleted (`RESTRICT`).
- `campaigns` → `email_logs`: one-to-many, with cascade delete.
- `customers` → `email_logs`: one-to-many. If a customer is deleted,
  the customer reference in the email log is set to `NULL`, while the
  email history is retained. The recipient email is stored separately
  in `recipient_email`.
- `email_logs` → `email_events`: one-to-many, with cascade delete.

The design also treats `email_suppressions` and `audit_logs` as
standalone tables:

- `email_suppressions` is looked up using a normalized email address
  and does not use a foreign key.
- `audit_logs.entity_id` is stored as a UUID without a foreign-key
  constraint, so audit records can remain even after the related
  entity is deleted.

## 4. Schema rules and constraints reviewed

The ERD showed several important data rules:

- Customer email addresses are unique.
- The `customer_segments` table uses a composite primary key
  consisting of `customer_id` and `segment_id`.
- Segment rules are stored as JSONB, supporting a filter-tree
  structure.
- Campaigns reference their selected segment and template. The
  displayed design uses `RESTRICT` to prevent deleting records that
  are still referenced by campaigns.
- Campaign status is represented in the campaign record, with states
  shown for drafting, scheduling, sending, completion, failure, and
  cancellation.
- `dispatch_mode` distinguishes scheduled and immediate campaigns,
  with scheduled as the default.
- `scheduled_at` is a timestamp. The displayed schema notes that
  immediate campaigns should use the current time (`NOW()`) rather
  than leaving this field `NULL`.
- The design keeps email history when a customer record is removed by
  setting the customer reference in `email_logs` to `NULL` and
  retaining `recipient_email`.

## 5. Outcome

The team reviewed the database entities, their relationships, and the
constraints shown in the ERD and relationship summary. The displayed
design provides a shared reference for the backend and other components
that depend on campaign, customer, segment, template, and email-log
data.

These rules are relevant to the Scheduling & Queue component because
campaign scheduling and job dispatch depend on consistent campaign
information, recipient data, and the distinction between scheduled and
immediate sending.

## 6. Follow-up

- Use the reviewed ERD and relationship rules as the reference when
  implementing database operations.
- Ensure that backend APIs and other components follow the agreed
  field meanings and relationship constraints.
- Check that scheduling logic handles `dispatch_mode` and
  `scheduled_at` consistently, particularly for immediate campaigns.

---

**Evidence:** Screenshots captured during the online team meeting on 27
October 2026, showing the ERD and the relationship summary in
`docs/erd.md`.
