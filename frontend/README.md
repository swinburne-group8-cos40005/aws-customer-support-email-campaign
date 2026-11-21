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

## API configuration

The Overview page reads live data from the Statistics API
(`docs/api-contract.md` §2.6). Create `frontend/.env.local`:

```bash
VITE_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com   # csep-api FrontendConfig.apiBaseUrl
VITE_DEV_ID_TOKEN=<cognito id token>                                    # optional, local development only
```

Requests send `Authorization: Bearer <Cognito ID token>`. The token comes from
`sessionStorage` (`csep.idToken`) and falls back to `VITE_DEV_ID_TOKEN`. While the
sign-in screen is still a prototype, a 401 on the dashboard shows a field to paste
a token for the current tab.

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
- Data is in-memory only (no backend); the login form accepts any input.
- The campaign draft lives in `Workspace`, so progress is kept when you move
  between sidebar pages and return to Campaigns.
