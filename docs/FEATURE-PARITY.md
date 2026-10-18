# Reference coverage and release verification

Reference: https://financialadvisorapp.pages.dev/. Comparison and implementation: 18 October 2026. We inspected the reference's publicly served modules; its signed-in workflows and native bridge were not controlled. No reference records were changed. This is functional coverage of the identified features, not a claim that every detail of either app has been independently verified.

| Area | Implementation | Verification |
| --- | --- | --- |
| Accounts and terms | Edit/delete, balance reconciliation, account currencies, APR/limit/cost, tenure/maturity and linked loan installments | Ledger/term/loan unit checks; existing account browser flows |
| Transactions and organization | CRUD, reversals, times, labels, notes, copies and templates | Unit checks and browser edit/template/delete/reload workflow |
| Transfers | Currency conversion, actual received amounts and recurring transfers | Both-account reversal and original transfer/browser regression checks |
| Goals and basic budgets | Goal editing/deletion, retained currency; monthly/yearly limits and deletion | Domain validation and existing goal/budget browser checks |
| Advanced budgets | Cycles, four weeks, sub-budgets, category rules, overlap checks, copy, savings and forecasts/history | Unit boundary/overlap checks; browser create/sub-budget/error/reload |
| Salary and recurring forecast | Daily schedules, dedicated salary months/history, reclassification, frequency averages and commitment ratio | Unit salary/forecast and existing bill/income/browser checks |
| Personal debts | Borrowed/lent direction, currency-aware principal, history and safe reversal | Principal/cash unit checks and repayment browser regression |
| Projects | Allocations, contingency, contracts, variations, milestones, partial payments, link/unlink, documents and export | Allocation/date/payment/linking/backup unit checks; browser project-payment workflow |
| Reports | Quarter/year/custom periods, grouping, scopes, drill-down and cycle-aware views | Date/conversion unit checks and original reports/calendar browser regressions |
| Warranties and receipts | Warranty records/expiry/photos; local OCR into reviewed draft | Browser warranty/backup workflow and actual image OCR, without automatic posting |
| Imports and categories | Category hierarchy rename/delete, full previewed restore, reference conversion and CSV duplicate handling | Unit corrupt/duplicate/reference checks; browser CSV/backup restore |
| Preferences | Multi-currency reports, manual rates, Arabic/RTL, themes and motion | Browser Arabic/dark/currency/reload plus small-phone route checks |
| Android widgets | Native provider, pin request, template buttons, owner-checked draft links and clearing | Android native module Kotlin/resources compilation, Expo autolinking/configuration and Hermes export; launcher/physical-device checks required |
| Native privacy and OCR | Device unlock, background cover, capture prevention, secure preferences; ML Kit Android and Apple Vision iOS | Android local OCR module source compilation, native configuration and Hermes export; physical-device and Xcode checks required |
| Native push | Opt-in registry, FCM server, reminder preferences and deduplication | Mocked registry/server/auth checks; Firebase/APNs and real-device delivery required |

Automated checks exercise local demo workspaces or mocked Supabase accounts. They do not modify a live user's financial records. Existing live cloud RLS/auth architecture is preserved; no financial-record migration runs during deployment. New backup imports and record mutations happen only through user actions in the app.

Use the native release checklist in [MOBILE.md](MOBILE.md) before treating device-only features as released. OCR currently targets printed English/Latin receipts; Arabic UI does not imply Arabic OCR. Exchanges are manual, account data is manual, and no bank aggregation or payment execution is included. Native signed-in use still needs connectivity to load/save cloud data.
