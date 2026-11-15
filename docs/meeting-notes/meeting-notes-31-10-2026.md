# Meeting Notes -- User Stories and Advanced Features Discussion

**Date:** 31 October 2026
**Project:** AWS Customer Support Email Campaign
**Meeting Type:** Team Design Review
**Topics:** User Story Clarification, Database Mapping, API Design, and
AI Integration

## 1. Meeting Purpose

The team reviewed the project user stories to clarify the expected
system behaviour and the relationship between user requirements,
database structures, and backend APIs.

The meeting also covered changes to the database schema and API design.
In addition, the team discussed potential advanced features, including
the possibility of integrating AI into the system.

## 2. User Story and Database Mapping

The team reviewed how database tables and columns support different user
stories, helping clarify which data is required for each system
function.

### US01 -- Create Campaign

The following database elements were reviewed:

- `campaigns`: Stores campaign information, including its name,
  selected template, segment, and initial status (`draft`).
- `templates`: Stores reusable email content, including the subject,
  plain-text body, and HTML body.
- `segments.rules`: Stores customer filtering rules in JSON format.
- `customers.first_name` and `customers.attributes`: Provide customer
  information for personalising email content through placeholders
  such as `{{first_name}}` and `{{city}}`.
- `customer_segments`: Defines which customers belong to each segment.

### US02 -- Schedule Campaign

The team clarified how scheduled and immediate campaigns should be
represented and processed.

- `campaigns.scheduled_at`: Stores the selected sending time. For
  immediate campaigns, this field is set to the current time
  (`NOW()`).
- `campaigns.dispatch_mode`: Distinguishes between `scheduled` and
  `immediate`, with `scheduled` as the default.
- `campaigns.status`: Scheduled campaigns follow
  `draft → scheduled → sending → completed`. Immediate campaigns move
  directly from `draft → sending`, skipping the `scheduled` state.
- `audit_logs.action`: Uses separate actions for `schedule`, `cancel`,
  and `send` so that each operation can be identified in the audit
  history.

The review highlighted the need to distinguish immediate sending from
scheduled sending so that immediate campaigns do not create unnecessary
EventBridge scheduling events.

### US03 -- Send Campaign

The visible user-story mapping identified `customer_segments` as the
source used to retrieve all customers belonging to the selected segment.

This recipient information is required by the campaign-sending process.

### US04 -- View Results and Metrics

The team reviewed the data used to display campaign results:

- `email_logs.send_status`: Counts successful and failed sending
  results.
- An index on `(campaign_id, send_status)` supports the corresponding
  count query.
- `campaigns.status`: Provides the campaign status displayed on the
  dashboard.
- `audit_logs`: Maintains a history of what actions were performed and
  by whom.

### US05 -- Monitor Bounce and Complaint

The team reviewed the data required to monitor email events and customer
email preferences:

- `email_events.event_type`: Records events reported by Amazon SES,
  including bounces and complaints.
- `email_events.deduplication_key`: Helps prevent duplicate counting
  when SES delivers the same event multiple times.
- `email_suppressions.reason`: Records why an email address is
  blocked, including bounce, complaint, manual opt-out, or customer
  request.
- `audit_logs.action`: Records customer email preference actions such
  as `opt_in` and `opt_out`.

## 3. Database Schema Changes Reviewed

The team reviewed the changes documented in the user-story and schema
design materials:

1.  Added `opt_in` and `opt_out` to the available `audit_logs.action`
    values because customer email preference changes need to be
    recorded.
2.  Removed `email_logs.delivery_status` because `send_status` already
    covers the required sending status. Keeping both fields could cause
    inconsistent status values.
3.  Removed `idx_customers_email` because the unique constraint on
    `customers.email` already creates an index.
4.  Added `dispatch_mode` to campaigns, with `scheduled` as the default
    and `immediate` as the alternative.
5.  Added a constraint to ensure that `dispatch_mode` only accepts valid
    values. Immediate campaigns must not enter the `scheduled` state.
6.  Added `send` as a separate audit action so immediate sending can be
    distinguished from scheduling in the audit history.

The displayed notes stated that the remaining tables, columns, indexes,
and constraints were unchanged.

## 4. User-facing API Design Review

The team reviewed the Campaign API endpoints and the database operations
associated with them.

The visible API list included:

- `GET /campaigns` -- Retrieves campaigns.
- `POST /campaigns` -- Creates a campaign using the selected template
  and segment.
- `GET /campaigns/{id}` -- Retrieves a specific campaign.
- `PUT /campaigns/{id}` -- Updates a campaign.
- `DELETE /campaigns/{id}` -- Deletes a campaign.
- `POST /campaigns/{id}/schedule` -- Schedules a campaign and records
  the scheduling action.
- `POST /campaigns/{id}/send` -- Starts immediate sending, sets
  `scheduled_at` to `NOW()`, sets `dispatch_mode` to `immediate`, and
  records the `send` audit action.

Particular attention was given to keeping the schedule and send
operations separate. Scheduled campaigns use the scheduling workflow,
while immediate campaigns move directly into the sending process without
waiting for an EventBridge schedule.

## 5. Discussion of Advanced Features -- AI Integration

In addition to reviewing the existing user stories, the team discussed
the possibility of introducing AI-related capabilities as an advanced
feature.

The discussion considered AI as a potential extension to the existing
email campaign system rather than a confirmed requirement for the
initial implementation.

Further evaluation would be needed to identify suitable use cases,
assess technical requirements, and determine how an AI feature could fit
into the existing system architecture.

No final AI feature scope or implementation decision is recorded in the
available meeting screenshots.

## 6. Meeting Outcomes

The review helped clarify how the main user stories relate to database
tables, columns, and API operations.

The team also reviewed important distinctions in campaign behaviour,
particularly the handling of scheduled and immediate sending, and the
need to maintain clear audit records for different actions.

The user-story mapping provides a reference for understanding which data
each feature depends on. This is relevant to the Scheduling & Queue
component because campaign dispatch relies on campaign status, dispatch
mode, scheduled time, template information, and recipient data.

The AI discussion introduced a possible direction for future
enhancement, while leaving the specific feature scope and implementation
approach open for further consideration.

## 7. Follow-up Considerations

- Use the reviewed user-story mapping when implementing and
  integrating the corresponding system components.
- Keep the database schema, API contract, and campaign state
  transitions consistent.
- Ensure immediate and scheduled campaigns follow their respective
  sending workflows.
- Preserve separate audit actions for scheduling, cancellation, and
  immediate sending.
- Evaluate potential AI use cases separately from the core campaign
  functionality before deciding whether to include them in
  implementation.


