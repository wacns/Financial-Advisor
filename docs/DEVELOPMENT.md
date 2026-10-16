# Development conventions

This is a single Ionic Core / Vite application with Capacitor iOS and Android projects. Install dependencies and run commands at the repository root; no workspace wrapper or monorepo tooling is needed. See [MOBILE.md](MOBILE.md) for native builds and push setup.

## Source responsibilities

| Module | Responsibility |
| --- | --- |
| `src/main.js` | Application startup, hash routes, UI events, rendering and workspace persistence |
| `src/auth.js` | Google sign-in and PKCE callback handling |
| `src/finance.js` | Accounts, transactions, summaries, categories and initial state |
| `src/planning.js` | Recurring schedules, repayments and project-budget calculations |
| `src/planning-ui.js` | Planning views and forms |
| `src/locale.js` | Bahrain civil dates, BHD formatting and integer-fils conversion |
| `src/icons.js` | Explicit icon imports to keep the bundle small |
| `src/style.css` | Shared styles and responsive layouts |
| `src/reports.js` | Account scopes, spending totals, budget health and payment calendar projections |
| `src/reports-ui.js` | Dashboard financial pulse, Insights and payment calendar views |
| `src/reports.css` | Reporting and calendar styles |
| `src/ionic.js` | Explicit Ionic component registration |
| `src/mobile.js` | Capacitor lifecycle, system browser, secure auth storage and export sharing |
| `src/mobile-ui.js` | Mobile tabs and notification preferences |
| `src/notifications.js` | Push consent, device registration and notification lifecycle |
| `supabase/functions/` | Authenticated token registration, FCM sending and protected reminder dispatch |

Keep financial calculations in the pure domain modules and UI behavior in rendering/event modules. Add focused unit coverage under `tests/unit/` for financial rules and browser coverage under `tests/e2e/` for important workflows. Escape user-provided text when inserting HTML. Preserve BHD-only records and the separate demo namespace.

Use `public/` for assets served as-is and `docs/` for operational guides. Keep the package manifest, lockfile and build/test configurations at the root so npm, Vite, Playwright and Vercel discover them consistently. `.editorconfig` standardizes new edits without reformatting the existing application.

Before pushing, follow [TESTING.md](TESTING.md). Read [DEPLOYMENT.md](DEPLOYMENT.md) when upgrading an existing nested checkout. A folder move does not require a Supabase migration or a Google OAuth change.
