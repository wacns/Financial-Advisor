# Testing

Run from the repository root with Node.js 24:

```sh
npm ci
npm test
npx playwright install chromium
npm run test:e2e
npm run test:oauth
npm run build
```

- `tests/unit/`: Node's test runner, importing application modules from `src/`.
- `tests/e2e/`: Playwright browser workflows. The default configuration excludes OAuth and uses port 5173.
- `playwright.auth.config.js`: isolated mocked OAuth suite on port 5174 with fake public configuration.
- `artifacts/`, `test-results/`, and `playwright-report/`: generated and ignored by Git.

On Linux hosts with system Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` for the browser commands instead of downloading a browser. On fresh Linux CI images, use `npx playwright install --with-deps chromium` to install required system libraries too.

The browser tests use demo storage or mocked Supabase responses and do not write real financial records. OAuth tests do not establish live Google consent readiness; a real user must verify that flow.

## Existing coverage

- Unit tests: transaction arithmetic, single-fils precision, category totals, invalid amounts, missing accounts, BHD formatting, and Bahrain midnight/month rollover.
- Desktop browser: unauthenticated redirect with no Supabase configuration, demo entry, transaction persistence across reload, CSV download, budget creation, and goal progress.
- Mobile browser: 390px layout without horizontal overflow and working navigation.
- Bahrain browser regression: fixed regional settings, preserved legacy demo records, and Bahrain dates while the browser is set to America/Los_Angeles.
- Google OAuth browser tests with mocked Supabase: account-selection redirect with PKCE challenge, code exchange, user validation before data access, sign-out, and cancelled/expired callback recovery. These do not contact Google or establish live provider readiness.
- Planning unit tests cover schedule month ends/leap years, repeat protection, principal/fee separation, project totals, old-workspace compatibility, and invalid date/amount rejection.
- Planning browser tests cover bills/income, edit/pause/resume, repayments, project expenses, archive/reopen, mobile layout, and authenticated JSON persistence using a mocked Supabase service.
- Production build.
- Reports unit tests cover atomic transfer validation, fils precision, wealth preservation, account-scoped totals, custom categories, budget aggregation, calendar projections, leap years, paused schedules and recorded history.
- Reports browser tests cover failed and successful transfers, reload persistence, account/type filters, transfer CSV fields, report scopes, calendar payment recording, and 360px layouts.
- Mocked Supabase browser checks also cover transfer balances and calendar payment history surviving authenticated workspace writes and reloads. These mocks do not verify live cloud persistence or provider readiness.

Browser screenshots are generated in ignored `artifacts/` by the tests. Live database isolation and anonymous API denial are verified. Production is deployed; a complete Google account consent/session test still needs user verification.


Live HTTP and browser checks: login loads, Google button is enabled, BHD demo loads, unauthenticated private routes redirect to login. Supabase OAuth authorization redirects to accounts.google.com with the correct Supabase callback. Following the dashboard update, live cancellation checks confirmed that both the application-specific redirect and the default Supabase Site URL return to `financial-advisor-partner.vercel.app`. See [DEPLOYMENT.md](DEPLOYMENT.md). A complete Google account consent and return flow still needs a user sign-in.
