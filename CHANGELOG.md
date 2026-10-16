# Changelog

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
