# ADR 0002: Asynchronous Campaign Dispatching using Amazon EventBridge and SQS with DLQ

- **Status:** Accepted
- **Date:** 2026-10-18
- **Decider:** Dang Quang (Backend Lead), Phuong (Scheduling Lead), Viet Anh (Worker Lead)

---

## Context
Sending emails to a segment of up to 10,000 recipients cannot be performed synchronously within a single API request due to API Gateway's 29-second timeout and SES sending rate quotas (14–50 emails/second). The dispatch mechanism must be asynchronous, resilient, and fault-tolerant.

## Decision
Decouple campaign triggering and message dispatching using **Amazon EventBridge Scheduler → Dispatcher Lambda → Amazon SQS Standard Queue with Dead-Letter Queue (DLQ) → Worker Lambda**.

## Rationale
1. **Rate Limiting & Throttling Buffer:** Amazon SQS acts as a buffer between customer segmentation and Amazon SES, preventing SES `454 Throttling` exceptions.
2. **Resilience & Automatic Retries:** Failed dispatches remain in SQS with a visibility timeout and retry up to 3 times before routing to a DLQ for manual inspection.
3. **Decoupled Ownership:** Phuong manages the scheduling and enqueueing pipeline, while Viet Anh independently owns the SQS-to-SES Worker processor.

## Consequences
- Message ordering is not strictly guaranteed (mitigated because marketing email delivery order across different recipients is irrelevant).
- Requires strict idempotency enforcement on the Worker side to handle standard SQS at-least-once delivery guarantees.
