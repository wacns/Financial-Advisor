# Features and Bahrain conventions

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

Balances are entered manually; adding a transaction adjusts its selected account. Goal progress does not transfer funds. All amounts use Bahraini dinars (BHD) with three decimal places; calculations preserve fils. CSV downloads reflect the active month and search filters and include three-decimal BHD amounts and an explicit currency column.


## Planning workflows (v1.1)

**Bills & salary:** add a schedule and its receiving/paying account. The list shows the next occurrence only; the monthly summary includes the next occurrences due in the selected month, including planned loan repayments. Overdue items are based on Bahrain’s current date. Recording a payment creates a transaction and advances one interval. January 31 becomes February 28/29, then March 31. Weekly repeats advance seven days; yearly repeats retain their original month/day. Pause/resume preserves history. Old unpaid occurrences are not skipped automatically.

**Debts & loans:** enter the current outstanding principal and planned monthly payment. Adding a debt does not change account balances. When recording a repayment, enter the actual cash payment and its principal portion from your statement. Only principal reduces the debt; the full cash payment reduces the selected account. Interest/fees are the difference, entered manually; no APR, interest accrual, payoff estimate, or financial advice is implied. The next due date advances one month.

**Projects:** create a budget and optionally a target date and notes. Add an expense from a project card, or select a project in the transaction form. The same transaction affects the account once and counts toward the project budget across all dates. Archived projects retain transactions and can be reopened. Income cannot be tagged as project spending.

Existing workspaces get empty `recurring`, `debts`, and `projects` arrays on load without losing existing values or receiving sample data. These collections use the existing per-user JSON storage and RLS policies; no database migration is needed. New demo workspaces include examples; reset the demo in Settings to refresh an older sample workspace if desired.

## Bahrain localization

- English interface, Bahrain-only country setting, and fixed BHD currency. No currency switcher.
- BHD amounts have three decimal places (1 dinar = 1,000 fils), including entry forms, balances, budgets, goals, and CSV exports. Account and transaction arithmetic uses integer fils.
- Default dates and month selection use `Asia/Bahrain` (UTC+03:00), independent of the device's time zone. Display dates use day-first English Gregorian formatting. Native date-input appearance follows the browser's own controls; stored dates are ISO civil dates.
- Demo data uses sample NBB / BBK accounts, Bahrain merchants, EWA / Batelco bills, and local savings goals. These are illustrative manual records, not bank or merchant integrations.
- The Bahrain demo uses `northline-bh-demo-v1`. Older `northline-demo` data is left intact and is never silently converted or relabeled as BHD.
- Authenticated workspaces with a non-BHD currency are rejected without modifying their records. The installed schema defaults to BHD and constrains new workspace data to BHD.

