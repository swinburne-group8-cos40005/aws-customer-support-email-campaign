# Meeting Notes -- Design Docs Walkthrough After the Schema Merge

**Date:** 11 November 2026
**Project:** AWS Customer Support Email Campaign
**Meeting Type:** Team sync -- design docs walkthrough (lunchtime session)
**Topics:** erd.md, user-story.md, api-contract.md, db/schema.sql

## 1. Meeting purpose

Lunchtime walkthrough (Google Meet, 12:19--12:27 PM) on the day the
database schema landed on main (PR #16 merged 10:21 AM; the
constraint-refinement commit e095463 followed at 10:57 AM). The team
walked through the four core design documents in sequence so everyone
reviews the same post-merge versions before endpoint work starts.

## 2. Documents walked through

- `docs/erd.md` -- entities, relationships and delete behaviour,
  including the `dispatch_mode` split added on 10 November.
- `docs/user-story.md` -- user stories mapped to the tables and
  columns that support them.
- `docs/api-contract.md` -- Section 2.1 Campaign Management endpoints
  (`GET /campaigns`, `POST /campaigns/{id}/send`,
  `POST /campaigns/{id}/cancel`, `GET /campaigns/{id}/logs`) and the
  amended dispatch-mode decision (issue #4).
- `db/schema.sql` -- table structures, foreign keys, and the campaign
  state and dispatch constraints.

## 3. Outcomes

- Confirmed the four documents describe one consistent post-merge
  state.
- Set the ground for the architecture walkthrough later that week
  (15 November) and the endpoint branches.

## 4. Attendance

- All 6 members in the call (Thinh Dang presenting, Bach Tung,
  Cao Viet Anh, Huynh Trong Hieu, NamBuiThe, Phuong Moi) plus
  Thinh Dang's screen-share account (counter showed 7).

---

**Evidence:** Screenshots captured during the session (12:19--12:27 PM,
Meet ID `pdw-dzps-gvi`) showing the four documents in sequence; stored
in `local-only-non-commit/meeting-screenshot/` as
`11-11-docs-walkthrough-1.jpg`--`11-11-docs-walkthrough-10.jpg`
(numbered in walkthrough order: erd.md, user-story.md,
api-contract.md, schema.sql).
