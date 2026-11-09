# User Stories

### US01 – Create Campaign

**As a** Customer Support Agent,
**I want to** create an email campaign with a template and customer segment,
**so that** I can communicate with selected customers.

**Acceptance Criteria**

- Create campaign with name, subject, content.
- Support customer placeholders.
- Select target customer segment.
- Save as draft.

### US02 – Schedule Campaign

**As a** Customer Support Agent,
**I want to** schedule a campaign,
**so that** emails are sent automatically at the selected time.

**Acceptance Criteria**

- Select date and time.
- Campaign is sent automatically.
- Campaign status is displayed.

### US03 – Send Campaign

**As a** Customer Support Agent,
**I want to** send emails to all customers in a segment,
**so that** customers receive the campaign.

**Acceptance Criteria**

- Emails are sent to all valid recipients.
- Customer information is populated correctly.
- Failed emails are retried.
- Customers do not receive duplicate emails.

### US04 – View Results Metric

**As a** Customer Support Manager,
**I want to** view campaign results,
**so that** I can monitor campaign performance.

**Acceptance Criteria**

- Dashboard to view successful and failed emails.
- View campaign status and history.

### US05 – Monitor Bounce & Complaint

**As a** Customer Support Manager,
**I want to** monitor bounce and complaint rates and manage customer opt-in/opt-out preferences,
**so that** I can maintain email deliverability and avoid sending unwanted emails.

**Acceptance Criteria**

- View bounce rate and complaint rate for each campaign.
- System alerts when the rates exceed configured thresholds.
- Customers can opt-in or opt-out of campaign emails.
- Opted-out customers are excluded from future campaigns.
- Bounce/complaint events are recorded in email logs.