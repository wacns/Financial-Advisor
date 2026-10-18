# Testing

Run from the repository root with Node.js 24:

```sh
npm ci
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run test:oauth
npm run build
```

- `tests/unit/`: Node's test runner, importing application modules from `src/`.
- `tests/e2e/`: Playwright browser workflows. The default configuration excludes OAuth and uses port 5173.
- `playwright.auth.config.js`: isolated mocked OAuth suite on port 5174 with fake public configuration.
- `tests/unit/native-auth.test.js`, `notifications.test.js`, `push-server.test.js`: native callback, device-consent and push-server contracts without real provider sends.
- `tests/e2e/mobile-shell.spec.js`: Shared React mobile tabs and web notification availability.
- `artifacts/`, `test-results/`, and `playwright-report/`: generated and ignored by Git.

On Linux hosts with system Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` for the browser commands instead of downloading a browser. On fresh Linux CI images, use `npx playwright install --with-deps chromium` to install required system libraries too.

The browser tests use demo storage or mocked Supabase responses and do not write real financial records. OAuth tests do not establish live Google consent readiness; a real user must verify that flow.

For native checks, run `npm run build:native` to export Android/iOS Hermes bundles, `npx expo install --check` for SDK dependency compatibility, and `npx expo prebuild --no-install --clean` to validate generated projects. Native binary builds require Android SDK 37 / Build Tools 37, NDK 27.1 and JDK 21, or a Mac with Xcode for iOS. Use `npm run native:android` / `npm run native:ios` or the EAS profiles. Edge Function TypeScript can be checked with `deno check supabase/functions/*/index.ts`. Physical-device push delivery and warm/cold auth returns require the Firebase/APNs and custom-scheme setup in [MOBILE.md](MOBILE.md).

## Existing coverage

- Unit tests: transaction arithmetic, single-fils precision, category totals, invalid amounts, missing accounts, BHD formatting, and Bahrain midnight/month rollover.
- Desktop browser: unauthenticated redirect with no Supabase configuration, demo entry, transaction persistence across reload, CSV download, budget creation, and goal progress.
- Mobile browser: 390px layout without horizontal overflow and working navigation.
- Bahrain browser regression: fixed regional settings, preserved legacy demo records, and Bahrain dates while the browser is set to America/Los_Angeles.
- Google OAuth browser tests with mocked Supabase: account-selection redirect with PKCE challenge, code exchange, user validation before data access, sign-out, and cancelled/expired callback recovery. These do not contact Google or establish live provider readiness.
- Planning unit tests cover schedule month ends/leap years, repeat protection, principal/fee separation, project totals, old-workspace compatibility, and invalid date/amount rejection.
- Planning browser tests cover bills/income, edit/pause/resume, repayments, project expenses, archive/reopen, mobile layout, and authenticated JSON persistence using a mocked Supabase service.
- Production web build and native Android/iOS Hermes exports.
- Shared entry-command atomicity and CSV formula protection; native secure-storage chunking, failed replacement recovery, and duplicate Expo callback delivery.
- Reports unit tests cover atomic transfer validation, fils precision, wealth preservation, account-scoped totals, custom categories, budget aggregation, calendar projections, leap years, paused schedules and recorded history.
- Reports browser tests cover failed and successful transfers, reload persistence, account/type filters, transfer CSV fields, report scopes, calendar payment recording, and 360px layouts.
- Mocked Supabase browser checks also cover transfer balances and calendar payment history surviving authenticated workspace writes and reloads. These mocks do not verify live cloud persistence or provider readiness.

Browser screenshots are generated in ignored `artifacts/` by the tests. Live database isolation and anonymous API denial are verified. Production is deployed; a complete Google account consent/session test still needs user verification.


Live HTTP and browser checks: login loads, Google button is enabled, BHD demo loads, unauthenticated private routes redirect to login. Supabase OAuth authorization redirects to accounts.google.com with the correct Supabase callback. Following the dashboard update, live cancellation checks confirmed that both the application-specific redirect and the default Supabase Site URL return to `financial-advisor-partner.vercel.app`. See [DEPLOYMENT.md](DEPLOYMENT.md). A complete Google account consent and return flow still needs a user sign-in.

## Dependency audit (2026-10-18)

The React migration pins transitive `@grpc/grpc-js` to 1.14.6 and Xcode tooling's `uuid` to 11.1.1 to address published advisories while retaining the supported Expo/React Native versions. Clean native prebuild checks Xcode's use of the compatible `uuid.v4()` API.

Two upstream advisories remain in the latest published build-tool dependencies: [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (3.0.3, used by Metro's file matching) and [node-forge certificate signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv) (1.4.0, used by Expo CLI certificate tooling). npm reports their dependent packages too, so the advisory count is larger than two. Fixed releases were unavailable at this check. Do not run `npm audit fix --force`: its suggested downgrade to Expo 44 / React Native 0.72 would break this SDK 58 project. Use trusted project/configuration inputs for native tooling and revisit these packages when upstream publishes fixes. The deployed Vercel application serves the Vite output; it does not run Metro or Expo CLI as a public server.


## v1.5 coverage

`tests/unit/feature-parity.test.js` adds currency/reversal atomicity, reconciliation, hierarchy/template behavior, cycle-day clamping and allocation/overlap checks, salary and forecast conversion, project payments/links/contracts/attachments, malformed backups and full reference backup unit conversion, duplicate-aware CSV imports, receipt ambiguity, flexible report boundaries, foreign-currency debt repayments and linked loan installments.

`tests/e2e/features.spec.js` exercises edit/template/delete persistence, cycle-budget validation, project agreement/milestone/payment creation, warranty/CSV/previewed backup restore, Arabic/RTL/dark/reporting preferences, all new routes at 360px and real local browser OCR from a generated receipt image. It verifies that OCR review/cancellation never persists a transaction. Existing demo, account, report, calendar and mocked OAuth flows remain in the suite.

Native local module source compilation, platform SDK installation and device verification have separate requirements. A Linux session cannot compile Apple Vision/Swift into an iOS app. See the release checklist in MOBILE.md and the coverage distinctions in FEATURE-PARITY.md.

Implementation validation on 2026-10-18: 57 unit tests, 19 demo browser tests and 2 mocked OAuth tests passed. SDK dependency checks, Android/iOS Hermes exports and clean native prebuild passed. The reminder dispatcher passed Deno type checking, was deployed as version 2, and rejects unauthenticated requests with HTTP 401. These checks sent no real test notifications and changed no reference financial records.

Final follow-up checks cover reimporting exported currency/time/label CSV fields, refusal to import into another currency, and the existing transfer/account browser regressions. Native relocking retains the mounted workspace under a hidden accessibility-excluded view, preserving listeners and drafts until unlock. Physical-device auth/tap checks remain required.

Android local-module verification also passed `:financial-advisor-native:compileDebugKotlin`, including its generated resources and Expo Modules Core dependencies, with Android SDK 37.0/Build Tools 37.0.0, NDK 27.1 and JDK 21. The first parallel attempt lost its Gradle daemon; a one-worker retry with in-process Kotlin and a 1536 MB Gradle heap completed successfully. This compiles the OCR/widget library, not a signed APK or an iOS binary.
