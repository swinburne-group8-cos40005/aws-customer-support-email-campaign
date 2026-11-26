# Demo Runbook — Sprint 2 final demo

A repeatable walkthrough of the Customer Support Email Campaign Platform: US01–US05, the
Week 11 advanced features, and the failure / DLQ recovery story.

- **Target length:** 9–10 minutes (a 5-minute cut is listed in §3).
- **Environment:** `dev` stack set, region `ap-southeast-1` (see `infra/deploy-dev.sh`).
- **Related docs:** [user stories](user-story.md) · [email state machine](email-state-machine.md) ·
  [API contract](api-contract.md) · [infra runbook](../infra/README.md) ·
  [ADR-0007 (DLQ policy)](adr/ADR-0007-ses-event-routing-via-sns-and-dlq-redrive.md)

> Items marked **TO CONFIRM** are not defined anywhere in the repository yet. Fill them in
> before the rehearsal; do not leave this marker in the final version.

## 1. Roles

| Role | Person | Does |
| :--- | :--- | :--- |
| Presenter | TO CONFIRM | Drives the browser and tells the story |
| Operator | TO CONFIRM | Runs the AWS CLI / console steps in §6 and watches the mailbox |
| Timekeeper | TO CONFIRM | Keeps to the minute marks in §3, calls the fallback in §8 |

## 2. Pre-demo checklist

Run it the day before and again 30 minutes before. Tick every box.

### Infrastructure

- [ ] All stacks are `CREATE_COMPLETE` or `UPDATE_COMPLETE`: `csep-artifact`, `csep-auth`, `csep-data`,
      `csep-dispatcher`, `csep-feedback`, `csep-api`, `csep-observability`.
- [ ] The deployed API bundle contains the latest `main` (campaign endpoints **and** the statistics endpoints).
- [ ] Frontend is served over HTTPS at `<live-url>` and that exact origin is the `FrontendOrigin`
      of `csep-auth` and `csep-api`.
- [ ] Logging in from the live URL works (Cognito Hosted UI, then back to the app).
- [ ] SNS subscription for the manager email is **Confirmed**, not "Pending confirmation".
- [ ] CloudWatch dashboard `csep-campaign-health-dev` is open in its own tab.

### Accounts and mail

- [ ] A Cognito demo user exists and its password is stored with the team (not in the repo).
- [ ] SES: if the account is still in the **sandbox**, every demo recipient address is a *verified identity*
      and the sender address is verified. Unverified recipients make the send step fail.
- [ ] The demo mailbox is open and empty enough to spot the new message.

### Data

- [ ] `db/seed.sql` is loaded in Aurora (see the checklist below). Loading is done through the SSM
      bootstrap host described in `infra/README.md`; **`db/schema.sql` drops tables — never re-run it
      against the demo database after the seed is loaded.**
- [ ] Overview page loads real numbers (not an error card).

### Seed data checklist

| Seed record | ID / value | Used for |
| :--- | :--- | :--- |
| Segment "Gold Customers" | `11111111-1111-4000-8000-000000000001` | Audience preview: 3 customers (An, Chi, Hang); Hang is suppressed, so the preview should show 2 net recipients |
| Segment "Hanoi Base" | `11111111-1111-4000-8000-000000000002` | Second segment (An, Binh, Hang) |
| Template "Monthly Newsletter" | `22222222-2222-4000-8000-000000000001` | Placeholders `{{first_name}}`, `{{points}}` (US01) |
| Template "Gold Exclusive" | `22222222-2222-4000-8000-000000000002` | Second template |
| Campaign "October Monthly Newsletter" | `33333333-3333-4000-8000-000000000001` — `completed` | Results story (US04): 2 delivered, 1 bounced |
| Campaign "November Gold Exclusive" | `33333333-3333-4000-8000-000000000002` — `scheduled` | Cancel demo (US02) |
| Campaign "Black Friday Early Access" | `33333333-3333-4000-8000-000000000003` — `draft` | Edit / schedule / send demo |
| Suppression `hang.le@example.com` | reason `bounce` | Excluded from sends (US05) |
| Suppression / opt-out `khoa.vo@example.com` | reason `manual_opt_out` | Opt-out story (US05) |
| Audit entries | create, schedule, opt_out | Audit Logs page |

**Gap to check:** the seed has no `complained` or `failed` email logs and only one completed campaign, so the
dashboard shows a single bounce at a low rate. For a convincing alert state, either run the live send in §4
several times, or ask the backend owner for an additional demo seed (a campaign with bounce rate ≥ 2 %).
Only data that exists in Aurora can be shown; do not edit numbers on screen.

> The seed contains addresses on `example.com`. They never receive mail. For the **live send** use
> your own verified addresses in a separate demo customer/segment (TO CONFIRM who creates it, and before the rehearsal).

## 3. Timeline

| Time | Segment | Story | Stories covered |
| :--- | :--- | :--- | :--- |
| 0:00 | Opening | One sentence on the product, one on the architecture | — |
| 0:30 | Sign-in | Cognito Hosted UI over HTTPS | — |
| 1:00 | Create | Build a draft from a template and a segment | US01 |
| 2:30 | Schedule / cancel | Schedule it, then cancel the seeded scheduled one | US02 |
| 3:30 | Send now | Immediate send, status moves to `sending` then `completed`, email arrives | US03 |
| 5:00 | Results | Dashboard: successful vs failed, bounce and complaint rates, alerts, history | US04, US05 |
| 6:30 | Audit | Every change is recorded | FR9 |
| 7:00 | Advanced features | TO CONFIRM (see §5) | Week 11 |
| 8:00 | Failure story | Message lands in the DLQ, alarm and email, recovery | — |
| 9:30 | Close | What is next | — |

**5-minute cut:** keep Sign-in, Create, Send now, Results, and the Failure story; mention Schedule and Audit in one sentence each.

## 4. Walkthrough

Format: **Say** what the audience should hear · **Do** the click path · **Expect** what appears.

### 4.1 Opening and sign-in (0:00)

- **Say:** "Support agents create and send email campaigns; managers watch delivery health. Everything runs on
  AWS serverless: API Gateway and Lambda, Aurora, SQS and SES, with CloudWatch watching it."
- **Do:** Open `<live-url>`, click **Sign in**, log in on the Cognito Hosted UI.
- **Expect:** Redirect back to the app, user shown at the bottom of the sidebar. The address bar shows `https://`.

### 4.2 US01 — Create a campaign

- **Do:** **Campaigns** → start a new campaign. Name it `DEMO <date> <initials>`. Pick **Monthly Newsletter**
  and the **Gold Customers** segment. Open the audience preview. Save as draft.
- **Expect:** Preview shows the estimated audience and how many are suppressed (Hang is excluded). The campaign
  appears with status `draft`. Template placeholders (`{{first_name}}`) are visible in the preview.
- **Say:** "Suppressed customers are excluded before anything is queued."

### 4.3 US02 — Schedule and cancel

- **Do:** Schedule the draft for a time **at least 5 minutes ahead** (the API rejects anything sooner). Then open
  the seeded **November Gold Exclusive** and cancel it.
- **Expect:** First campaign shows `scheduled` with its time; the cancelled one shows `cancelled`.
- **Say:** "A scheduled campaign is locked until its time; cancel is only allowed before it runs."

### 4.4 US03 — Send now

- **Do:** Open the draft **Black Friday Early Access** (or a fresh demo campaign aimed at your verified
  addresses) and click **Send now**. Watch the status; refresh.
- **Expect:** `sending`, then `completed` within about a minute. The email arrives with the first name and points filled in.
- **Say:** "Sends go through a queue. Each recipient has an idempotency key, so a retry can never send the same
  email twice, and failed sends are retried before they are given up on."
- **If no mail arrives:** see §8 (most likely SES sandbox or an unverified address).

### 4.5 US04 / US05 — Results and deliverability

- **Do:** **Overview**. Point at the four cards, the **Campaigns by status** strip and the recent-campaigns table.
  Select **October Monthly Newsletter**. If a campaign with a high bounce rate exists, select that one too.
- **Expect:** Successful vs failed bars, bounce and complaint rates with `Healthy` / `Warning` / `Critical`
  badges, an alert banner when a threshold is crossed, and the **Status history** timeline.
- **Say:** "Thresholds come from the server (warning at 2 % bounce, critical at 5 %; complaints 0.05 % and 0.1 %),
  so the dashboard never hard-codes them. A campaign with nothing sent shows 'No data', not a perfect score."
- **Opt-out (US05):** show that `khoa.vo@example.com` is opted out and excluded from the audience.
  TO CONFIRM whether this is shown in the Audience page or via `PUT /v1/customers/{id}/preferences` in Postman.

### 4.6 Audit trail

- **Do:** **Audit Logs**.
- **Expect:** Entries for the create, schedule, cancel and send you just performed, with who and when.


### 4.7 Failure and DLQ recovery

See §6 for the exact commands.

## 5. Open decisions (resolve before rehearsal)

1. Which features count as the "Week 11 advanced features"? (blocks §4.7)
2. Who creates the demo customers and segment with verified addresses for the live send?
3. Is the SES account out of the sandbox? If not, which addresses are verified?
4. How is the opt-out shown: UI, or Postman?
5. Is a richer demo seed needed for the alert state (§2, "Gap to check")?

## 6. Failure story — DLQ and recovery

**Narrative:** "Sends are retried; a message that keeps failing is moved aside to a dead-letter queue instead of
blocking the others. The manager is emailed, and we recover it by hand."

Per ADR-0007 a send message moves to the DLQ after **5** failed receives, and DLQ handling is **manual**. A real
poison message is slow to produce, so the demo **simulates** it by placing a message in the DLQ. Say so out loud.

### 6.1 Prepare (before the demo, not on stage)

```sh
REGION=ap-southeast-1
DLQ_URL=$(aws sqs get-queue-url --queue-name csep-send-dlq-dev --region $REGION --query QueueUrl --output text)
```

Confirm the alarm is currently `OK`:

```sh
aws cloudwatch describe-alarms --alarm-names csep-dlq-depth-dev --region $REGION \
  --query 'MetricAlarms[0].StateValue' --output text
```

### 6.2 Trigger (operator, on cue)

```sh
aws sqs send-message --queue-url "$DLQ_URL" --region $REGION \
  --message-body '{"demo":"poison message","note":"simulated for the demo"}'
```

### 6.3 Show

1. CloudWatch dashboard: **Queue depth** shows the dead-letter queue line rise; **Alarm status** turns red.
2. The alarm `csep-dlq-depth-dev` moves `OK → ALARM`. This can take a few minutes: start it before the segment
   begins, or show it already firing.
3. The manager mailbox receives the SNS alarm email.

### 6.4 Investigate and recover

```sh
aws sqs receive-message --queue-url "$DLQ_URL" --region $REGION --max-number-of-messages 1
```

- Real failures: the matching `email_logs` row is `failed` and carries `last_error` (ADR-0007 §4).
- Fix the cause, then either move the message back (SQS console, **Start DLQ redrive**) or delete the simulated one:

```sh
aws sqs purge-queue --queue-url "$DLQ_URL" --region $REGION
```

- The alarm returns to `OK` after the next evaluation period. Show the second state change if time allows.

> `purge-queue` empties the whole DLQ. Only use it on the demo environment, and not within 60 seconds of a previous purge.

## 7. Resetting between rehearsals

- Delete the `DEMO …` campaigns that are still `draft` (only drafts can be deleted).
- Campaigns that were sent or cancelled stay in the database. Use a new name each rehearsal (`DEMO <date> <initials>`).
- Purge the DLQ (§6.4). Re-confirm the alarm is `OK`.
- Do **not** re-run `db/schema.sql` to reset: it drops all tables and needs the temporary SSM access.

## 8. If something goes wrong

| Symptom | Likely cause | Quick fix |
| :--- | :--- | :--- |
| Redirected to a Cognito error page | Live origin does not match the `CallbackURLs` of `csep-auth` | Check the exact origin (no trailing slash) in the stack parameters |
| Dashboard says "not signed in" / 401 | ID token expired (valid 1 hour) | Sign out and in again |
| Browser console shows a CORS error | `FrontendOrigin` of `csep-api` differs from the live URL | Redeploy `csep-api` with the right origin |
| API returns 503 `DB_UNAVAILABLE` | Aurora Serverless v2 waking up | Wait a few seconds and retry; the contract asks clients to retry with backoff |
| Scheduling returns 400 | `scheduledAt` is less than 5 minutes ahead | Pick a later time |
| Campaign stays `sending` and no mail arrives | SES sandbox or unverified recipient; or the queue worker failed | Check recipients are verified, then the DLQ and Lambda logs |
| Alarm does not change state | Evaluation period not elapsed, or SNS subscription pending | Wait, or show the earlier screenshot in `docs/evidence/` |
| Everything on the live site is down | Network or AWS issue | Switch to the evidence screenshots and the recorded run; for the dashboard only, the frontend has a sample-data mode (`VITE_USE_MOCK=true`) if it has been merged |

Keep a recorded run of the full walkthrough as the last-resort fallback.

## 9. Documentation links check

Before the demo, open each and confirm it resolves and is current:

- [ ] `README.md`: repository map, getting-started commands, and the stack list (it still mentions
      `csep-messaging` as pending and `backend/` as "in review"; update to match the deployed stacks).
- [ ] `docs/README.md`: the index lists every ADR and evidence file, including `api-stats-dashboard-2026-11-21.md`
      and this runbook.
- [ ] `infra/README.md`: deploy order matches `infra/deploy-dev.sh` (including the frontend hosting stack, if added).
- [ ] `docs/api-contract.md`: v1.2.0, the statistics endpoints (§2.6) are present.

## 10. Rehearsal log

| # | Date | Total time | Who presented | What failed | Fixed? |
| :-- | :--- | :--- | :--- | :--- | :--- |
| 1 | | | | | |
| 2 | | | | | |
