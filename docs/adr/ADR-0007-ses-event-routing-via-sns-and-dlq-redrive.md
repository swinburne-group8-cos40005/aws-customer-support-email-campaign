# ADR 0007: SES Event Routing via SNS and the Main Queue DLQ Redrive Policy

- **Status:** Accepted — unanimous team vote on issue #25
- **Date:** 2026-11-17
- **Decider:** Team vote on issue #25 (3/3 in favor of Option A: MrMoi — Scheduling, CaoVietAnh — Worker, NamBuiThe — Support/QA); queue parameters resolved by the Backend lead on 2026-11-17
- **Consulted:** Dang Quang (Backend lead), Hieu (Messaging — template author, checkpoint #26)
- **Related:** ADR-0002 (dispatch pipeline), ADR-0004 (stack layout), issues #6, #7, #10, #26

---

## Context

ADR-0002 fixed the dispatch pipeline (EventBridge Scheduler → Dispatcher Lambda → SQS → Worker Lambda) and ADR-0004 named the stack layout (`messaging.yaml` = "SNS topic, SES event destinations"), but neither recorded **how SES sending events travel back** once an email has been handed to SES. The Event Handler Lambda (#10) needs Delivery / Bounce / Complaint events to move `email_logs` rows from `sent` to `delivered` / `bounced` / `complained` — the decision was how they reach the processing queue:

- **Option A — SES → SNS topic → SQS.** SES event destinations publish to one SNS topic; the topic fans out to the event-processing SQS queue (and any later consumer).
- **Option B — SES event destination → SQS directly.** SES writes straight to the queue: fewer hops, but the consumer set is frozen at SES-config time.

The same decision thread also had to fix the main send queue's DLQ behaviour: how many receive attempts a failed send message gets before it is parked, and how long SQS hides a message while the Worker is holding it.

## Decision

1. **Option A — SES → SNS topic → SQS** (unanimous).
   - One SES event destination (a configuration set) publishes Delivery / Bounce / Complaint to a single SNS topic in `csep-messaging`.
   - The event-processing SQS queue subscribes to that topic; the Event Handler Lambda consumes the queue and **unwraps the SNS envelope** before matching events to `email_logs` rows via `ses_message_id`.
   - Rationale: keeps the layout that ADR-0004 already documents, and leaves the door open for future subscribers (audit-log pipeline, alerting) without ever re-touching SES configuration.

2. **Main send queue DLQ redrive: `maxReceiveCount = 5`.**
   - A failed send message is retried up to 5 receive attempts before it moves to the DLQ for manual inspection (no automatic redrive).
   - The issue originally proposed 3; the vote adopted 5 following AWS guidance, so that transient Lambda/SES faults (throttling spikes, cold starts) survive an extra retry instead of dying early. Aligns with the Worker's `attempt_count` bookkeeping in `email_logs`.

3. **Main queue visibility timeout: at least 6× the Worker Lambda timeout, plus the batching window.**
   - A message must stay invisible for the full worst-case processing time — Lambda timeout, batching, and margin — so a message cannot reappear while a Worker is still mid-send. This bounds the at-least-once redelivery window that the Worker's idempotency key (ADR-0002) has to absorb.
   - `messaging.yaml` (checkpoint #26) encodes both numbers as the Worker timeout is set there.

4. **DLQ disposition is manual.** Messages that land in the DLQ are inspected by hand before any redrive — the `failed` email_logs rows carry `last_error` for the investigation.

## Consequences

- The Event Handler owns SNS-envelope unwrapping; its tests must cover the envelope shape from the SES configuration set.
- One more hop in the event path (SNS pricing per request) — accepted as the cost of consumer flexibility.
- `maxReceiveCount = 5` multiplies worst-case latency for a genuinely bad message (5 visibility-timeout cycles before the DLQ); acceptable because a bad send message is rare and the manual DLQ review is part of the workflow.
- The visibility-timeout multiplier must be re-evaluated if the Worker's batching window grows beyond the margin.
- Ordering remains unguaranteed (ADR-0002); irrelevant for marketing email delivery.
