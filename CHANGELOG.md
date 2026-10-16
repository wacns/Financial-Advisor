# Changelog

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
