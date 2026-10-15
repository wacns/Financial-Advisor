# Northline Bahrain

An English-language, Bahrain-only personal finance app inspired by the reference site's account, transaction, budgeting, and planning workflows. Northline uses its own arrow identity, navy / ivory / sage palette, typography, layout, and copy. No reference code, assets, data, or credentials were reused.

## Run

Requires Node.js 22.12+ (verified with Node 24).

```sh
npm ci
npm run dev
```

Open the server URL, then choose **Explore the demo**. `/#/demo/overview` opens the dashboard directly. Demo edits persist only in this browser's local storage. Settings can reset the samples or download a JSON backup.

```sh
npm test
npm run build
npm run preview
```

Browser checks:

```sh
npx playwright install chromium
npx playwright test
```

On hosts with system Chromium, skip the install and run:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test
```

## Features

- Responsive dashboard with account balances, monthly income, expenses, savings rate, and a cash-flow chart.
- Manual accounts and transactions, searchable activity, monthly filtering, and CSV export.
- Category budgets with spending progress and over-budget states.
- Savings goals with editable progress, spending insights, and fixed Bahrain regional settings.
- Google OAuth and email/password Supabase sign-in, sign-up, sign-out, authenticated route gating, and workspace persistence when configured.
- A separate demo namespace with sample data. Real accounts begin empty.

Balances are entered manually; adding a transaction adjusts its selected account. Goal progress does not transfer funds. All amounts use Bahraini dinars (BHD) with three decimal places; calculations preserve fils. CSV downloads reflect the active month and search filters and include three-decimal BHD amounts and an explicit currency column.


## Bahrain localization

- English interface, Bahrain-only country setting, and fixed BHD currency. No currency switcher.
- BHD amounts have three decimal places (1 dinar = 1,000 fils), including entry forms, balances, budgets, goals, and CSV exports. Account and transaction arithmetic uses integer fils.
- Default dates and month selection use `Asia/Bahrain` (UTC+03:00), independent of the device's time zone. Display dates use day-first English Gregorian formatting. Native date-input appearance follows the browser's own controls; stored dates are ISO civil dates.
- Demo data uses sample NBB / BBK accounts, Bahrain merchants, EWA / Batelco bills, and local savings goals. These are illustrative manual records, not bank or merchant integrations.
- The Bahrain demo uses `northline-bh-demo-v1`. Older `northline-demo` data is left intact and is never silently converted or relabeled as BHD.
- Authenticated workspaces with a non-BHD currency are rejected without modifying their records. The installed schema defaults to BHD and constrains new workspace data to BHD.

## Supabase connection

Connected to **Financial-Advisor** (`srwzgwodlpylezdaipce`) in **WACNS's Org** (`xuhlnscnbxqvaydhzpdf`). The user created this project. Its API URL and publishable key are configured in ignored `.env.local`, and the workspace migration has been applied remotely.

Live verification passed: own-workspace reads/inserts, cross-user read/update/delete denial, forged-owner insert denial, owner reassignment denial, BHD-only enforcement, and anonymous read denial. Test fixtures were rolled back. The public Data API returned HTTP 401 for anonymous workspace access; the Supabase security advisor returned no findings.

Google and email/password are enabled in the project's public Auth settings. The production URL is configured and an OAuth cancellation correctly returns to Northline. A full Google account sign-in still needs user verification.

For another checkout or deployment:

1. Use the existing `srwzgwodlpylezdaipce` project; do not create a duplicate.
2. The workspace migration is already installed in this project. Apply it only when initializing a different empty database.
3. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the project dashboard. Never use a service-role or secret key in these browser-visible variables.
4. Enable email/password auth. Keep email confirmation enabled; configure production email delivery before a public launch.
5. Set the Auth Site URL and allowed redirect URL to the exact application document URL (for example `<origin>/`, or `<origin>/app/` for a subdirectory deployment). Google and email confirmation use PKCE and return there with a one-use `?code=`. Open confirmation links in the same browser that started sign-up. The app exchanges the code, removes callback parameters, then validates the user before opening the workspace. Include development document URLs only while developing.
6. Rebuild after environment changes. Vite embeds these public values at build time.
7. Configure Google using [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md). Verify Google consent, cancelled/expired callbacks, email sign-up, confirmation, sign-in, refresh, sign-out, and expired sessions with a real project. With two test users, verify that each can read/update only their own workspace and that anonymous requests cannot read data.

### Protection model

`/#/app/*` validates the user with Supabase `auth.getUser()` before reading their workspace. Hash routes serve the public app shell; private data protection comes from the database's Row Level Security, not from hiding frontend code. The migration explicitly enables RLS, revokes anonymous access, and restricts SELECT, INSERT, UPDATE, and DELETE to `auth.uid() = user_id`. UPDATE also checks the resulting owner. No user-editable metadata or privileged keys are used for authorization.

The initial storage model uses one JSON snapshot per user. Simultaneous edits from multiple devices use last-write-wins semantics; add optimistic concurrency before supporting coordinated multi-device editing. Live SQL and anonymous API access checks passed. The provider and production return URL are configured. A full Google account sign-in still needs user verification.

## Deployment

Production: https://northline-bahrain.vercel.app/

- Vercel project: `prj_qxwKj4JA488Ma9AJktColvsqIR6c` (`northline-bahrain`)
- Account: `team_xwKACwKczzvsN97PQXPLT8tT` (`wacns-projects`)
- Deployment: `dpl_ttdbwjAnJ8EiKPT3B4YUCmVsQibi`, READY, production
- Source was uploaded directly from this workspace; no Git commit was used.
- Public Supabase build variables are configured for production, preview, and development.
- Production is publicly reachable; Vercel authentication remains enabled on previews. Private finance data is protected by Supabase authentication and RLS.

In Supabase URL Configuration, set Site URL and an allowed Redirect URL to exactly `https://northline-bahrain.vercel.app/`. This final dashboard setting cannot be changed by the available connector tools. Google’s callback stays `https://srwzgwodlpylezdaipce.supabase.co/auth/v1/callback`.

## Verification completed

- Unit tests: transaction arithmetic, single-fils precision, category totals, invalid amounts, missing accounts, BHD formatting, and Bahrain midnight/month rollover.
- Desktop browser: unauthenticated redirect with no Supabase configuration, demo entry, transaction persistence across reload, CSV download, budget creation, and goal progress.
- Mobile browser: 390px layout without horizontal overflow and working navigation.
- Bahrain browser regression: fixed regional settings, preserved legacy demo records, and Bahrain dates while the browser is set to America/Los_Angeles.
- Google OAuth browser tests with mocked Supabase: account-selection redirect with PKCE challenge, code exchange, user validation before data access, sign-out, and cancelled/expired callback recovery. These do not contact Google or establish live provider readiness.
- Production build.

Browser screenshots are generated in ignored `artifacts/` by the tests. Live database isolation and anonymous API denial are verified. Production is deployed; a complete Google account consent/session test still needs user verification.


Live HTTP and browser checks: login loads, Google button is enabled, BHD demo loads, unauthenticated private routes redirect to login. Supabase OAuth authorization redirects to accounts.google.com with the correct Supabase callback. The live OAuth cancellation check returns to the production origin. A complete Google account consent and return flow still needs a user sign-in.
