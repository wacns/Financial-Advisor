# Features and Bahrain conventions

The product name is **FinancialAdvisor** and the repository is **Financial-Advisor**. Bahrain identifies the current region and BHD settings, rather than the product brand. Existing `northline_workspaces` and demo storage identifiers are retained for data compatibility.

## Features

- Responsive dashboard with account balances, monthly income, expenses, savings rate, and a cash-flow chart.
- Manual accounts and transactions, searchable activity, monthly filtering, and CSV export.
- Category budgets with spending progress and over-budget states.
- Savings goals with editable progress, spending insights, and fixed Bahrain regional settings.
- Google OAuth and email/password Supabase sign-in, sign-up, sign-out, authenticated route gating, and workspace persistence when configured.
- Recurring bills, subscriptions and salary schedules, with weekly/monthly/yearly repeats, due states, editing and pause/resume.
- Manual payment recording that creates one transaction and advances the schedule without moving real money.
- Debt tracking with monthly due dates, repayment history, and separate cash/principal amounts.
- Project budgets, linked expenses, remaining-budget indicators, and archive/reopen controls.
- A separate demo namespace with sample data. Real accounts begin empty.
- Shared React screens and Expo iOS/Android apps with secure native auth storage and share-sheet exports.
- Native push notification registration and a protected reminder backend; Firebase/APNs setup and device validation are required before delivery. See [MOBILE.md](MOBILE.md).
- Dashboard financial pulse with spending comparisons, category budget room, and next scheduled payments.
- Account-specific Insights with category progress charts, six-month income/expense trends, exact figures, and largest spending descriptions.
- Payment calendar with recurring projections, daily details, recorded payment history, and payment recording.
- Manual account transfers, transaction account filters, and transfer-aware CSV exports.

Balances are entered manually; adding a transaction adjusts its selected account. Goal progress does not transfer funds. All amounts use Bahraini dinars (BHD) with three decimal places; calculations preserve fils. CSV downloads reflect the active month and search filters and include three-decimal BHD amounts and an explicit currency column.


## Reports, calendar and transfers (v1.2)

**Overview and Insights:** the financial pulse links directly to reports, budgets and the calendar. Its payment total includes only the next occurrence of each bill or loan due in the selected month. Budget room sums only the categories with budgets; an individual category may exceed its limit even when the combined remaining amount is positive. Insights can be scoped to one account or all accounts. Six-month charts and previous-month comparisons use recorded calendar-month totals, which may be incomplete. Exact amounts accompany each bar. Spending categories and descriptions are derived from actual expense records, including custom categories. Fresh demos include five earlier months of illustrative history; existing workspaces are preserved. Reset sample data in Settings to refresh an older demo.

**Calendar:** recurring weekly, monthly and yearly schedules are projected forward from their next due date into the selected month. Anchored month ends and leap years are preserved. Paused schedules are hidden. Loans show only their next repayment because future principal/fee splits are unknown. Only a schedule's next due occurrence offers a recording action; later projections cannot create transactions. Recorded recurring payments appear on their actual payment date. Browsing the calendar never changes balances or schedules, and it never executes payments. Native push reminders are separately opt-in and require the setup in [MOBILE.md](MOBILE.md).

**Transfers:** use **Record transfer** in Accounts or Transactions after moving money yourself. Choose two different accounts, a BHD amount, a date and a description. A single transfer record subtracts from the source and adds to the destination using integer fils. Total account wealth is unchanged. Transfers are excluded from income, expenses, category budgets, project spending and cash-flow charts, and appear under either account in transaction filters. Negative source balances are allowed, as with other manual entries. Exports respect month, search, transaction type and account filters; the appended `Account` and `To Account` columns identify the transfer direction. These fields use the existing authenticated JSON workspace persistence; no schema migration is required.


## Planning workflows (v1.1)

**Bills & salary:** add a schedule and its receiving/paying account. The list shows the next occurrence only; the monthly summary includes the next occurrences due in the selected month, including planned loan repayments. Overdue items are based on Bahrain’s current date. Recording a payment creates a transaction and advances one interval. January 31 becomes February 28/29, then March 31. Weekly repeats advance seven days; yearly repeats retain their original month/day. Pause/resume preserves history. Old unpaid occurrences are not skipped automatically.

**Debts & loans:** enter the current outstanding principal and planned monthly payment. Adding a debt does not change account balances. When recording a repayment, enter the actual cash payment and its principal portion from your statement. Only principal reduces the debt; the full cash payment reduces the selected account. Interest/fees are the difference, entered manually; no APR, interest accrual, payoff estimate, or financial advice is implied. The next due date advances one month.

**Projects:** create a budget and optionally a target date and notes. Add an expense from a project card, or select a project in the transaction form. The same transaction affects the account once and counts toward the project budget across all dates. Archived projects retain transactions and can be reopened. Income cannot be tagged as project spending.

Existing workspaces get empty `recurring`, `debts`, and `projects` arrays on load without losing existing values or receiving sample data. These collections use the existing per-user JSON storage and RLS policies; no database migration is needed. New demo workspaces include examples; reset the demo in Settings to refresh an older sample workspace if desired.

## Bahrain localization

- English interface, Bahrain-only country setting, and fixed BHD currency. No currency switcher.
- BHD amounts have three decimal places (1 dinar = 1,000 fils), including entry forms, balances, budgets, goals, and CSV exports. Account and transaction arithmetic uses integer fils.
- Default dates and month selection use `Asia/Bahrain` (UTC+03:00), independent of the device's time zone. Display dates use day-first English Gregorian formatting. Date-input appearance follows the platform's controls; stored dates are ISO civil dates.
- Demo data uses sample NBB / BBK accounts, Bahrain merchants, EWA / Batelco bills, and local savings goals. These are illustrative manual records, not bank or merchant integrations.
- The Bahrain demo uses `northline-bh-demo-v1`. Older `northline-demo` data is left intact and is never silently converted or relabeled as BHD.
- Authenticated workspaces with a non-BHD currency are rejected without modifying their records. The installed schema defaults to BHD and constrains new workspace data to BHD.

