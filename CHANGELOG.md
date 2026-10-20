# Changelog

## 1.6.1 — Public downloads and unified releases (2026-10-20)

- Connect Windows NSIS and Linux AppImage installers to a public update feed without exposing repository credentials.
- Publish APK/AAB, unsigned IPA and desktop installers in one public release, retaining actual binary versions and separate checksum lists.
- Verify mobile downloads against the private originals and public upload digests; preserve the private source repository.
- Attach existing mobile builds to desktop releases automatically and support a separate destination release version.
- Add versioned public release notes, a public changelog and an Actions workflow to refresh descriptions without rebuilding installers.
- Generate verified merged-PR/direct-commit entries with author links and a real private source comparison, retaining immutable release history checkpoints.

## 1.6.0 — Installers and updates (2026-10-18)

- Add Android APK/AAB and Windows, macOS and Linux desktop installer builds to a combined GitHub Release workflow; reuse MobAI for the unsigned iOS IPA.
- Add Electron with bundled shared React UI, isolated/sandboxed renderer and system-browser PKCE sign-in.
- Add Expo Updates with native fingerprint compatibility and a separate channel-based publishing workflow, plus desktop update-feed support and restart controls in Settings.
- Keep preview signing, private download-feed limitations, production credentials and device verification explicit in `docs/RELEASES.md`.

## 1.5.0 — Reference feature expansion (2026-10-18)

- Add account/transaction/goal editing and deletion, explicit balance reconciliation, transaction times/labels/templates, currency-aware transfers and account terms with linked loan installments.
- Add cycle budgets with weekly/category allocations and overlap checks, dedicated salary months, recurring transfers/daily repeats, personal money lent and commitment forecasting.
- Add project allocations, reserves, vendor agreements/variations, milestones, payments, linking, documents and project export.
- Add flexible reports, categories/subcategories, warranties/receipt photos, local OCR review, validated full backup restore/reference conversion and duplicate-aware CSV import.
- Add manual exchange rates/reporting currencies, Arabic/RTL, appearance/motion preferences, Android widget integration and native privacy controls. Native device/provider release checks remain required; see docs/FEATURE-PARITY.md.
- Extend reminder preferences and backend cadence without changing existing financial records or the per-user RLS schema.


## 1.4.0 — React and React Native

- Replaced Ionic/Capacitor with shared React Native screens, React Native Web, and Expo.
- Migrated accounts, transfers, transactions, budgets, goals, planning, calendar, reports, settings and entry forms to React components.
- Retained existing Supabase workspace data, browser routes, BHD precision and domain logic.
- Added native SecureStore session storage, Expo system-browser PKCE, share-sheet exports, safe areas and Android back navigation.
- Adapted opt-in push to React Native Firebase while retaining the deployed FCM backend.
- Added reproducible Expo configuration and EAS build profiles; native projects are generated instead of versioned.
- Updated browser workflows and added shared-entry, secure-storage and duplicate callback regression coverage.

## 1.3.0 — Ionic and native mobile

- Added Ionic Core components, responsive mobile tabs and native-safe layouts.
- Generated Capacitor iOS/Android projects, system-browser OAuth callbacks and secure native auth storage.
- Added share-sheet exports and native notification preferences with opt-in permissions, token rotation and disconnect handling.
- Installed ownership-protected device registration and service-only delivery tracking in the existing Supabase project.
- Deployed authenticated registration/test functions and a secret-protected FCM reminder dispatcher. Firebase/APNs credentials and the optional scheduler still require setup.
- Added native auth, notification lifecycle, push-server and Ionic navigation tests, plus a platform setup guide.

## FinancialAdvisor Partner hosting — 2026-10-16

- Connected `financial-advisor-partner.vercel.app` and renamed the Vercel project to `financial-advisor-partner`.
- Updated the public links and verified the application redirect and default Site URL on the new origin after the Supabase dashboard update.

## FinancialAdvisor branding — 2026-10-16

- Aligned the product name, wordmark, page metadata, accessible labels and export filenames with the Financial-Advisor repository.
- Kept existing workspace identifiers and the current hosting origin compatible with saved data and sign-in.

## 1.2.0 — A clearer rhythm

- Added a dashboard financial pulse with spending comparisons, category budget room, and next payment totals.
- Rebuilt Insights with account filtering, category spending charts, six-month cash-flow comparisons, exact monthly figures, and top spending descriptions.
- Added a payment calendar with daily details, recurring projections, recorded payment history, and direct payment recording.
- Added manual account transfers that update both balances while preserving total wealth and excluding transfers from income, spending, and budgets.
- Added transaction account filtering and transfer-aware CSV exports with account and destination columns.
- Added illustrative historical records to fresh demo workspaces and refined the responsive layouts.
- Added calculation and browser coverage for transfers, reports, calendar projections, and authenticated workspace persistence.

## Repository layout — 2026-10-16

- Made the repository root the application root; removed the redundant `northline/` wrapper.
- Grouped unit and browser tests under `tests/unit/` and `tests/e2e/` and updated their imports/configuration.
- Consolidated onboarding in the root README and moved detailed guides into `docs/`.
- Added Node.js 24 and editor conventions, and required unit tests before Vercel builds.
- Preserved application source, dependencies, routes and database migrations.

## 1.1.0 — Planning your financial life

- Added Bills & salary with weekly, monthly and yearly schedules, due/overdue status, editing, and pause/resume.
- Added explicit payment/income recording, linking each occurrence to its transaction and preserving month-end schedule anchors.
- Added Debts & loans with principal tracking, monthly due dates, repayment history, and manual interest/fee separation.
- Added Projects with budgets, linked expenses, all-time spending, and archive/reopen controls.
- Added the On your horizon overview for upcoming scheduled income and payments.
- Preserved older BHD workspaces by introducing empty planning collections on load.
- Rejected impossible dates before they can affect balances or charts.
- Reduced the production JavaScript bundle by importing only the icons used by Northline.

Future reference-inspired candidates: warranties and receipt attachments, salary-cycle reporting, statement import, and conflict-safe multi-device editing. These are not implemented in this release.
