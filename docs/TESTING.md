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
- `playwright.auth.config.ts`: isolated mocked OAuth suite on port 5174 with fake public configuration.
- `tests/unit/native-auth.test.ts`, `notifications.test.ts`, `push-server.test.ts`: native callback, device-consent and push-server contracts without real provider sends.
- `tests/e2e/mobile-shell.spec.ts`: Shared React mobile tabs and web notification availability.
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

`tests/unit/feature-parity.test.ts` adds currency/reversal atomicity, reconciliation, hierarchy/template behavior, cycle-day clamping and allocation/overlap checks, salary and forecast conversion, project payments/links/contracts/attachments, malformed backups and full reference backup unit conversion, duplicate-aware CSV imports, receipt ambiguity, flexible report boundaries, foreign-currency debt repayments and linked loan installments.

`tests/e2e/features.spec.ts` exercises edit/template/delete persistence, cycle-budget validation, project agreement/milestone/payment creation, warranty/CSV/previewed backup restore, Arabic/RTL/dark/reporting preferences, all new routes at 360px and real local browser OCR from a generated receipt image. It verifies that OCR review/cancellation never persists a transaction. Existing demo, account, report, calendar and mocked OAuth flows remain in the suite.

Native local module source compilation, platform SDK installation and device verification have separate requirements. A Linux session cannot compile Apple Vision/Swift into an iOS app. See the release checklist in MOBILE.md and the coverage distinctions in FEATURE-PARITY.md.

Implementation validation on 2026-10-18: 57 unit tests, 19 demo browser tests and 2 mocked OAuth tests passed. SDK dependency checks, Android/iOS Hermes exports and clean native prebuild passed. The reminder dispatcher passed Deno type checking, was deployed as version 2, and rejects unauthenticated requests with HTTP 401. These checks sent no real test notifications and changed no reference financial records.

Final follow-up checks cover reimporting exported currency/time/label CSV fields, refusal to import into another currency, and the existing transfer/account browser regressions. Native relocking retains the mounted workspace under a hidden accessibility-excluded view, preserving listeners and drafts until unlock. Physical-device auth/tap checks remain required.

Android local-module verification also passed `:financial-advisor-native:compileDebugKotlin`, including its generated resources and Expo Modules Core dependencies, with Android SDK 37.0/Build Tools 37.0.0, NDK 27.1 and JDK 21. The first parallel attempt lost its Gradle daemon; a one-worker retry with in-process Kotlin and a 1536 MB Gradle heap completed successfully. This compiles the OCR/widget library, not a signed APK or an iOS binary.

Remote iOS verification on 2026-10-18 passed [GitHub Actions run 39127356895](https://github.com/wacns/Financial-Advisor/actions/runs/39127356895) at commit `9077abd`: CocoaPods installed the local Apple Vision module, Xcode built the device app in Release without signing, Hermes compiled the embedded JavaScript, and the workflow uploaded `fa-ios-9077abd.ipa` as artifact `ipa`. The initial run exposed Firebase's unsupported SPM/static-framework combination; the app's Expo plugin now selects Firebase's CocoaPods/static-framework integration, verified through clean and repeated prebuild. Workflow actionlint and shell syntax checks passed. The workspace's artifact download was blocked with HTTP 403, so verification used the successful job logs and artifact metadata rather than local IPA inspection. Signing, installation and physical-device checks remain pending; see [IOS-BUILDER.md](IOS-BUILDER.md).

## Cross-platform release verification

The [v1.6.0 preview release](https://github.com/wacns/Financial-Advisor/releases/tag/v1.6.0) was published on 2026-10-19 from commit `f9c4edb` by [successful run 39210604546](https://github.com/wacns/Financial-Advisor/actions/runs/39210604546). Verification, Android manifest merging, APK/AAB compilation, APK signature validation, unsigned iOS IPA packaging, all desktop build jobs and release publication passed. The 19 published assets contain 18 checksummed files plus `SHA256SUMS.txt`; every recorded SHA-256 matches GitHub's uploaded asset digest, and the downloaded desktop update metadata matches its checksum.

The APK and IPA were also downloaded from the published Release, matched against the checksums and checked for ZIP integrity. The APK contains its Android manifest, DEX, embedded JavaScript bundle and native libraries for ARM64, ARMv7, x86 and x86_64. The IPA contains an iPhoneOS ARM64 executable and embedded Hermes bundle, with bundle ID `com.wacns.financialadvisor`, version `1.6.0`, build `4`, and no root app code signature. This inspection does not replace installation or physical-device testing. The earlier Actions-artifact storage 403 did not prevent these Release downloads.

The initial combined [release run 39129285020](https://github.com/wacns/Financial-Advisor/actions/runs/39129285020) passed verification, iOS IPA packaging and all desktop jobs (Windows x64 EXE, macOS Intel/Apple Silicon DMG/ZIP, Linux x64 AppImage/DEB). Android stopped before app compilation because `android-actions/setup-android` requested Google's retired `tools` package. Publication was skipped, so that failed run created no release. The corrected workflow uses the runner's preinstalled SDK and pins Ubuntu 24.04 rather than following the Ubuntu 26 migration.

On 2026-10-19, workflow actionlint, application lint and all 60 unit tests passed. The packaged Linux app also passed the isolated Electron smoke test, including demo navigation, local receipt OCR and expense review/cancellation without recording, settings/reload, renderer isolation and rejection of an unrelated external sign-in destination. These checks use a temporary user-data directory and do not edit real financial records. They do not establish Windows/macOS installation, Android/iOS device behavior, store approval or live update delivery.

The next [release run 39208324069](https://github.com/wacns/Financial-Advisor/actions/runs/39208324069) confirmed SDK setup and all non-Android packaging, then exposed a Firebase notification-channel manifest conflict during the Android app build. The Expo plugin now adds explicit `tools:replace="android:value"` overrides for the three app-owned Firebase metadata values, preserving notification opt-in and the `payment-reminders` channel. Clean and repeated prebuilds were checked for one correctly namespaced override per value. CI now checks release manifest merging before starting APK/AAB compilation and enables Gradle's build cache.


## Public desktop feed verification (2026-10-19)

[Desktop v1.6.1](https://github.com/wacns/financial-advisor-releases/releases/tag/v1.6.1) was published by [run 39219635722](https://github.com/wacns/Financial-Advisor/actions/runs/39219635722). Every Windows/macOS/Linux build and the cross-repository publisher passed. The public repository contains desktop binaries and metadata; the source repository remains private. All 15 SHA256SUMS entries match GitHub asset digests. Lint, all 63 unit tests, actionlint, source Electron smoke tests and a locally packaged Linux smoke test passed. Packaged runtime configuration and electron-builder's generated updater configuration both contain the public generic feed URL.

[Connection check 39220276021](https://github.com/wacns/Financial-Advisor/actions/runs/39220276021) passed Expo project access and anonymous reads of all three desktop metadata files. An isolated packaged Linux Electron session then used the real updater to confirm that v1.6.1 is current. With only its in-memory current-version comparison changed to simulate v1.6.0, it found v1.6.1 and downloaded the 146,023,767-byte AppImage through the public feed with updater checksum validation. Automatic installation on quit stayed disabled; no installer was executed and no real financial records were opened. This confirms update detection/download, not an installed OS upgrade, Windows/macOS delivery or signing.

The mobile preview update was published for both platforms in [run 39218236828](https://github.com/wacns/Financial-Advisor/actions/runs/39218236828). Android runtime `acaeee71b27239c3bd7f21d2e1889b1b8d672fcd` and iOS runtime `f55df848df9f82205a5a70fb0e710195ee5172ac` exactly match the fingerprints embedded in the released v1.6.0 APK/IPA. Physical Android testing was deferred by the user; iOS signing and installation remain pending.


## Public mobile installer publication (2026-10-19)

[Run 39226937534](https://github.com/wacns/Financial-Advisor/actions/runs/39226937534) mirrored the existing v1.6.0 APK, AAB and unsigned IPA to the [public releases repository](https://github.com/wacns/financial-advisor-releases/releases/tag/v1.6.1), with MOBILE-SHA256SUMS.txt. Every mobile asset's GitHub SHA-256 digest and size matches its private original; unauthenticated HEAD requests returned HTTP 200 for all three downloads. All desktop metadata files still report v1.6.1. The publisher validates private-source checksums before upload, rejects unexpected/source files and refuses different existing public binaries. All 66 unit tests and actionlint passed. The initial attempt exposed a GitHub draft-release lookup limitation; the publisher now retrieves newly created drafts through the release listing, and the corrected workflow passed. iOS signing and device installation remain unverified.


## Unified release consolidation (2026-10-20)

[Run 39379150170](https://github.com/wacns/Financial-Advisor/actions/runs/39379150170) copied the existing mobile v1.6.0 assets into [public release v1.6.1](https://github.com/wacns/financial-advisor-releases/releases/tag/v1.6.1). All 20 assets, including both checksum lists and desktop updater files, match the sizes and SHA-256 digests recorded before consolidation. Unauthenticated APK/AAB/IPA download checks returned HTTP 200; all three desktop feed documents still report v1.6.1. The redundant public v1.6.0 release was deleted only after verification; its tag and private source release remain available. The public repository now lists exactly one release. Mobile filenames and embedded versions remain v1.6.0; desktop builds remain v1.6.1. Actionlint and all 66 unit tests passed. Desktop release automation now attaches the existing mobile build under the same public release version, and the manual mobile publisher accepts a separate destination version.

## Public release changelogs (2026-10-20)

[Update release notes run 39379810597](https://github.com/wacns/Financial-Advisor/actions/runs/39379810597) published the v1.6.1 description from its versioned Markdown and created public CHANGELOG.md and release-notes/1.6.1.md. Anonymous requests for both Markdown files returned HTTP 200 and matched the generated content exactly. The release body also matched the authored notes; all 20 asset IDs, sizes and digests were unchanged. The public repository still has one release and the application repository remains private. All 70 unit tests and actionlint passed. Missing or invalid version notes fail validation, and public history excludes notes newer than the latest public release. The notes workflow was tested without rebuilding or replacing installers.

## Commit/PR release history (2026-10-20)

[Run 39380794301](https://github.com/wacns/Financial-Advisor/actions/runs/39380794301) published generated source history for v1.6.1 using separate source-read and public-publishing credentials. Its three entries exactly match the private comparison `v1.6.0...desktop-v1.6.1`, with GitHub-verified @wacns authors and real commit URLs. The head tag points to the verified desktop build commit ef59f9ba542b5febcfa36bbc4cdbcee3db055433. Source comparison API access succeeded and returned three commits; no merged PRs belong to this range. Unit fixtures verify merged-PR deduplication and fallback for direct commits, unmerged PRs and PRs merged outside the release range. All 74 unit tests and actionlint passed.

The public history JSON was checked for its exact metadata-only keys; no source files or patches are published. Public release notes and CHANGELOG.md contain the generated entries and the private Full Changelog comparison link, with an access notice. The source repository remains private, the public repository still has one release, and all 20 asset IDs, sizes and digests are unchanged. Regenerating after the workflow commit reused the saved snapshot and retained the same three entries rather than including later tooling commits.

## Walletry-inspired tools (2026-10-20)

Source commit `cb4e94e45c451a119878012002199d0f09bf6272` passed all 90 unit tests, all 27 browser tests and eight feature browser tests against the production web app. The feature workflows cover organization metadata, multi-account filtering, text-capture review and currency selection, subscription history, exact installment allocation/reversal, phone layouts and shared-account role-aware UI. Browser scenarios use demo or mocked data; they do not edit a user's financial workspace.

Lint, web build, native Hermes exports, clean native project generation, isolated desktop smoke checks and workflow actionlint passed. The assistant function passed Deno type-checking; the deployed endpoint rejected unauthenticated requests and allowed the desktop origin. No paid model request was made. The shared-account and assistant-quota SQL regression scripts passed locally and against the hosted database, including role isolation, revision conflicts and quota enforcement. Both use rolled-back synthetic data; a follow-up check found zero synthetic test users remaining.

The iOS build verifies actual Xcode source paths and type-checks the Shortcuts Swift source before compiling the device application. Native speech, Shortcuts, signed installation, push delivery and actual OS upgrades still need physical-device tests. ChatGPT subscription usage is documented as a separate approval-dependent integration and has not been connected or tested. See [feature scope](WALLETRY-PARITY.md) and [assistant setup](ASSISTANT.md).

[Release run 39390877558](https://github.com/wacns/Financial-Advisor/actions/runs/39390877558) passed verification, Android APK/AAB compilation and signature validation, unsigned iOS device IPA packaging, all Windows/macOS/Linux builds, private publication and both public publishers. [Public v1.7.0](https://github.com/wacns/financial-advisor-releases/releases/tag/v1.7.0) contains 20 assets with all eight requested installer formats. All 18 SHA-256 entries across `SHA256SUMS.txt` and `MOBILE-SHA256SUMS.txt` match the uploaded GitHub digests. Installers and blockmaps match private-original digests and sizes; public updater files use the public download URLs.

All three desktop update feeds report 1.7.0. Public release notes contain all 15 verified source commit entries, with the real comparison `desktop-v1.6.1...v1.7.0`. The metadata-only history records the expected base `ef59f9b` and build head `cb4e94e`. The application repository remains private. Earlier failed/cancelled attempts were superseded by this successful run; they did not publish a 1.7.0 release.

Unauthenticated download HEAD requests returned HTTP 200 for an asset in each of the eight installer formats. This confirms public download access, without executing installers or changing a user's records.

## AI funding and Budget Tracker audit (2026-10-20)

The 1.7.1 implementation passed 98 unit tests and 30 browser tests, including funding consent, quote changes, ephemeral keys, absence of financial writes, and the unavailable ChatGPT foundation. Web build, Android/iOS Hermes exports, desktop smoke checks, workflow actionlint and Edge Function Deno type-check passed. OpenAI provider APIs were verified against installed version-matched SDK documentation. No real paid provider request or OpenAI OAuth session was attempted.

The prepaid-credit SQL regression passed locally and on the hosted database. It verifies service-only grants, idempotent payment references, owner-only status, nonnegative balances, request replay protection, completion/refund transitions and metadata minimization. A concurrent local test submitted two seven-credit reservations against a ten-credit wallet: one reserved and one failed for insufficient funds, leaving three credits. Hosted synthetic users were rolled back; a follow-up count was zero. No real user credit or financial balance was changed.

The deployed assistant v3 returned public capabilities with BYOK enabled, hosted pricing/purchases disabled and ChatGPT identity/plan access disabled. Anonymous status and inference requests returned 401. The four existing private/public release titles were renamed to their exact version tags, with asset IDs, sizes, digests, descriptions and prerelease flags verified unchanged. The Budget Tracker document is an audit and roadmap, not a claim that its missing features were added.

Publishing exposed two configuration issues: the inherited commit email was not attributed to the GitHub owner, blocking Vercel, and four local migration timestamps differed from Supabase's recorded versions (three predated this change). The repository-local email now uses the same verified GitHub noreply identity as prior successful deployments. Local migration filenames were aligned with the hosted history only after comparing all SQL (the ownership migration differs only in comments/formatting). No migration was re-applied, no remote history was rewritten and no financial records were changed by this correction.

Production deployment `063ccdf` is ready and its Vercel and Supabase Preview checks pass. All 11 feature browser tests passed against the deployed site. Direct production capability reads matched the expected availability; phone checks at 390px for BYOK, hosted and ChatGPT modes found no page errors or horizontal overflow. Provider and authenticated write paths in browser tests use mocks, while SQL authorization/accounting checks ran against the real database with rolled-back synthetic data.

[Release run 39396412697](https://github.com/wacns/Financial-Advisor/actions/runs/39396412697) passed every verification, platform build and publication job. [Public v1.7.1](https://github.com/wacns/financial-advisor-releases/releases/tag/v1.7.1) has the exact tag as its display name, 20 assets and all eight installer formats. All 18 entries in the two checksum lists match GitHub upload digests. Every installer/blockmap matches its private original, all eight anonymous download checks returned HTTP 200, and all three desktop feed files report 1.7.1. The source repository remains private.

The two generated history entries and real comparison `v1.7.0...v1.7.1` match the verified base `cb4e94e` and immutable installer build head `3fe9023`. The later `063ccdf` migration-filename/attribution correction changes no application runtime code. Successful compilation and public downloads do not establish physical-device installation, signing or actual update delivery. No ChatGPT subscription inference or real paid provider request was tested.
