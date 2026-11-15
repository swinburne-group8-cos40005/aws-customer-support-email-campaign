# Meeting Notes -- Frontend Review and Campaign UX Enhancements

**Date:** 29 October 2026  
**Project:** AWS Customer Support Email Campaign  
**Meeting Type:** Team session -- frontend peer review & UX discussion  
**Topics:** Frontend UI Progress, Dispatch Mode Selection, and Custom Template Saving

## 1. Meeting Purpose

The team reviewed the current frontend implementation across key application pages and discussed user experience (UX) improvements for the campaign creation workflow.

The feedback came from the team itself (peer review).

## 2. Frontend UI and Functional Walkthrough

The team inspected the initial frontend screens and core user flows, including:

- **Dashboard & Campaign List View:** Displaying campaign statuses, summary metrics, and navigation controls.
- **Campaign Creation & Editor Flow:** Reviewing form inputs, customer segment selection, and email template preview interfaces.
- **Action & Status Controls:** Verifying how users interact with draft, scheduled, and completed campaigns on the UI.

## 3. Proposed UX Enhancements

Two key feature suggestions were raised during the peer review:

### Dispatch Option Selection (Immediate vs. Scheduled)

- **Suggestion:** Add an explicit option in the campaign creation form allowing users to choose between **sending immediately** or **scheduling for a later time**.
- **Alignment:** Directly connects the UI workflow with the backend `dispatchMode` (`immediate` vs. `scheduled`) logic so users do not have to save a draft first before triggering an immediate send.

### Custom Template Saving

- **Suggestion:** Allow users to save their own custom email templates for reuse in future campaigns alongside the system's built-in templates.
- **Benefit:** Reduces repetitive content creation and supports consistent branding across recurring campaigns.

## 4. Meeting Outcomes & Follow-up Considerations

- Incorporate the immediate vs. scheduled dispatch selector into the campaign creation UI design.
- Define how user-saved custom templates will be stored, listed, and distinguished from pre-built system templates in the template selector.
- Continue refining the frontend pages and connecting them with the finalised backend API endpoints.

---

**Evidence:** Screenshots captured during the meeting (Google Meet ID: `zgs-iwdj-xvw`, 8:12 PM) showing the frontend peer review --- four members with avatars only (cameras off), Huynh Trong Hieu presenting the prototype UI, plus Thinh Dang's screen-share account (5 accounts in call); files `29-10-peer-review-1.jpg` and `29-10-peer-review-2.jpg` in `local-only-non-commit/meeting-screenshot/`.
