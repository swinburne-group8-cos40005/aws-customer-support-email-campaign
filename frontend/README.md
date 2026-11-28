# Email Campaign Platform

A React + TypeScript + Tailwind CSS v4 (Vite) admin app for building and sending
email campaigns: sign-in, a 4-step campaign wizard, template library, audience
segments, workspace settings and a help center.

Converted from the Figma Make prototype "Email Campaign Platform Prototype".

## Getting started

```bash
pnpm install        # or npm install / yarn
pnpm dev            # http://localhost:5173
pnpm build          # production build in dist/
pnpm typecheck      # tsc --noEmit
```

## Cognito and API configuration

The app signs users in directly with the existing Cognito user pool using
SRP; it does not redirect to the hosted UI. Registration sends an email
verification code, which is confirmed in the app. Create `frontend/.env.local`
from `.env.example` and set the values from the `FrontendConfig` output of the
`csep-api` CloudFormation stack:

```bash
VITE_COGNITO_USER_POOL_ID=<csep-auth UserPoolId>
VITE_COGNITO_CLIENT_ID=<csep-auth UserPoolClientId>
VITE_COGNITO_DOMAIN=https://<csep-auth hosted-login domain>
VITE_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com
# VITE_DEV_ID_TOKEN=<cognito id token>  # optional, local API development only
```

`FrontendConfig` now includes `cognitoUserPoolId` in addition to the client ID,
Cognito domain, and API URL. Redeploy `csep-api` after updating
`infra/api.yaml`, then read the output with:

```bash
aws cloudformation describe-stacks --stack-name csep-api \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendConfig'].OutputValue | [0]" \
  --output text
```

The existing `csep-auth` app client must allow `ALLOW_USER_SRP_AUTH` and
self-registration; those settings are already present in `infra/auth.yaml`.
Keep the hosted domain configured because the SPA uses its OAuth token endpoint
to refresh rotated refresh tokens. Requests to the Campaign API send the Cognito
ID token as `Authorization: Bearer ...`; sessions are stored in the current
browser tab and restored on reload.

## Project structure

```
src/
├── main.tsx                  # entry point
├── App.tsx                   # root: login ⇄ workspace, light/dark theme
├── Workspace.tsx             # signed-in app: navigation + state shared across views
├── types.ts                  # AppView, Segment, SendMode, WorkspaceSettings
├── index.css                 # Tailwind import, .field style, dark-theme overrides
│
├── pages/                    # one component per screen
│   ├── LoginPage.tsx
│   ├── CampaignPage.tsx      # the wizard (header, stepper, step content, footer) + sent screen
│   ├── OverviewPage.tsx
│   ├── TemplatesPage.tsx
│   ├── AudiencePage.tsx
│   ├── SettingsPage.tsx
│   └── HelpPage.tsx
│
├── components/
│   ├── stats/                # reporting dashboard: StatCard, AlertBanner, RateIndicator,
│   │                         #   SendBreakdownBar, CampaignStatsPanel, ErrorState
│   ├── ui/                   # generic building blocks
│   │   ├── Icon.tsx  Logo.tsx  Button.tsx  ThemeToggle.tsx  PageIntro.tsx
│   ├── layout/               # app chrome
│   │   ├── AppShell.tsx      # themed frame + fixed sidebar
│   │   ├── Sidebar.tsx
│   │   └── SectionHeader.tsx # top bar for non-wizard views
│   └── campaign/             # wizard pieces
│       ├── CampaignHeader.tsx  CampaignFooter.tsx  Stepper.tsx
│       ├── TemplateStep.tsx  TemplatePreview.tsx
│       ├── SetupStep.tsx  AudienceStep.tsx  ReviewStep.tsx
│       └── SentConfirmation.tsx
│
├── hooks/
│   └── useCampaignDraft.ts   # wizard state: step, name, subject, template, segments, schedule…
├── data/                     # static content & defaults
│   ├── templates.ts  segments.ts  navItems.ts
│   ├── campaignSteps.ts  pageTitles.ts  defaultSettings.ts
└── utils/
    └── dates.ts
```

Imports use the `@/` alias for `src/` (configured in `vite.config.ts` and `tsconfig.json`).

## Notes

- Dark mode is driven by a `theme-dark` class on the app shell; the overrides in
  `index.css` match Tailwind class names such as `bg-[#F7F7F9]` and `text-[#2…`,
  so if you rename those utility classes, update the matching selectors too.
- Data is in-memory only (no backend) except for API-backed reporting views.
- The campaign draft lives in `Workspace`, so progress is kept when you move
  between sidebar pages and return to Campaigns.
