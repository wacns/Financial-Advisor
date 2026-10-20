# Budget Tracker specification compared with FinancialAdvisor

Reviewed 20 October 2026 against the uploaded `budget-tracker-features.md` and FinancialAdvisor source at `1e0ede7` (released application 1.7.0). The upload describes another app, including planned features; its statements are not evidence that those features exist here. This is a code-based audit, not a test of the reference site's private records. No records were changed during the comparison.

## Current capabilities

| Uploaded capability | Current status | Evidence and difference |
| --- | --- | --- |
| Email/password signup, confirmation, login, logout | Implemented | `src/application/useWorkspace.js`, `src/application/Login.jsx`; Google login also exists. |
| Auth sessions and token refresh | Implemented | `useWorkspace.js`, `src/auth.js`, `src/platform/runtime.*`; PKCE and native return handling. Workspace reads validate the user. |
| Profile/settings bootstrap trigger | Different design | Personal data/settings live in an owned `northline_workspaces` document, normalized when loaded. We do not have the upload's `profiles`/`user_settings` table contract. |
| Private user data / RLS | Implemented with a different schema | Owner-isolated workspace plus separately protected shared-account tables. Shared accounts have role-aware server mutations; not every personal collection is a separate SQL table. See `supabase/migrations`. |
| Monthly navigation, income/expense/net summary | Implemented | `src/application/App.jsx`, `FinancialScreens.jsx`, `src/finance.js`; adjustable salary cycles and custom/rolling report ranges go beyond calendar months. |
| Expense breakdown chart | Implemented | `TrendChart.jsx`, `ReportsSettings.jsx`, `src/domain/reports.js`; categories, accounts, contacts and labels are supported groupings. |
| Create default sections and copy recurring entries on visiting a month | Different design | Categories, cycle-budget allocations and recurring schedules are separate from actual transactions. Visiting a month does not create spending or change balances. |
| Section/category create, rename, delete | Partial equivalent | Category management and sub-budgets exist in `ManagementScreens.jsx`, `src/domain/commands.js`. Safe deletion/rename preserves referenced history; there are no month-owned section cards with cascade deletion. |
| Duplicate an entire section and every entry | Missing as specified | Individual transaction copy, templates and cycle-budget copy exist. Copying all actual entries would duplicate balances; a future plan-section copy should copy planned lines only. |
| Entry name, amount, income/expense and date | Implemented | Reviewed transaction forms and ledger commands; also accounts, contacts, tags, receipts and currency. |
| Entry start/end validity spanning months | Partial | Actual entries have an accounting date. Subscriptions have trial/status fields and installments have finite occurrences, but generic planned lines do not have validity intervals. |
| Recurring carry-forward | Different design | Bills/salary schedules and commitment schedules project due dates and record a reviewed payment once. They do not clone actuals when a month opens. |
| Percentage / conditional / parsed text formulas between entries | Missing | No dependency formula engine or formula builder. APR, conversions, forecasts and installment allocation are domain calculations, not this feature. |
| Global currency selection and device sync | Implemented with additional semantics | `featureForms.js`, `src/domain/model.js`, `src/locale.js`; account currencies are preserved and reporting converts using saved rates. Changing reporting currency does not merely relabel historical numbers. |
| Light/dark theme | Implemented | `appearance.jsx`; also system theme, Arabic/English and reduced motion. |
| Font selector / Nunito / Quicksand | Missing | No user-selectable font setting. Existing shared semantic color objects use hex values rather than the upload's HSL/Tailwind system. |
| Anonymous read-only monthly share links | Missing | Shared accounts require login and provide owner/editor/viewer roles. They are not anonymous links or a way to publish a personal month's data. |
| Revoke, reactivate and delete public links | Missing | Shared-account invitations are expiring/single-use and membership can be managed. This differs from reactivatable public links. |
| Current-month CSV export | Partial equivalent | Transaction CSV and selected report CSV exist; current dates/accounts can be filtered. The export schema has actual ledger fields, not planned section/formula/start/end columns. |
| PDF report export | Missing | PDF attachments can be stored, but generating a PDF budget/report is not implemented. |
| Save feedback and failed-save recovery | Partial | `useWorkspace.js` waits for successful persistence before committing state; EntryModal disables duplicate submission, retains values on error and shows errors; save messages exist. No dedicated saved/idle indicator state machine matching the upload. |
| Form drafts restored after refresh / leave-page guard | Missing | EntryModal uses component state; unsaved form edits are not durably restored. Privacy gate/secure mobile storage and saved workspaces do not provide draft persistence. |
| Stable user dependency preventing refresh data loss | Partial/different | User identity/generation/write guards exist in `useWorkspace.js`; the stronger persistent-draft guarantee has not been implemented or verified. |
| Vercel deployment / static routing | Implemented differently | Private GitHub source deploys to Vercel. Hash routes work without route rewrites. Mobile uses Expo/React Native; desktop uses Electron. No Tailwind/Lovable dependency is required. |

## The upload's planned features

| Planned capability | What we have | Recommended implementation |
| --- | --- | --- |
| Share one month, a range, or all months | Authenticated shared-account ledger only | Add explicit report snapshots with month/range selection, preview/redaction, expiry and revocation. Snapshot reads should reveal only selected data; do not give anonymous users SELECT access to active share rows. Start with one month/range; avoid live all-history publication by default. |
| Lock entries and sections | No generic locks | Add planning locks and an explicit unlock action. Treat UI locks as accidental-edit protection. If locks must restrict collaborators, enforce them in server mutations; a local toggle is not authorization. |
| View / Edit / Master Edit modes | Shared-account roles, native biometric privacy; no global edit mode | Add a simple review mode first. Reserve unlock/override for authenticated owners with deliberate confirmation. Do not let a local Master Edit setting bypass database roles. |
| Flexible recurrence intervals | Subscriptions/installments already support interval + daily/weekly/monthly/yearly; general Bills has fixed frequencies | Extend general Bills/salary to the same shared anchored schedule helper, optionally adding start/end and occurrence limits. Keep one schedule; project occurrences rather than cloning ledger entries. |
| Replace an open-ended entry with a new version | No generic validity/version chain | Add effective-dated planned-line versions with stable IDs. Offer “end previous plan” with a preview; retain old versions and never rewrite posted historical transactions automatically. |
| Combined / income-expense split table | Transaction lists/day grouping and filters; no spreadsheet-style budget table | Add a responsive planning table on web/desktop and accessible cards on phones. Reuse filtering, money/date formatting and the same commands instead of a second persistence path. |

## What to implement next

1. **Recoverable drafts and clear save status.** Restore drafts only for the same user/workspace/form, expire them, exclude passwords/API keys, and make discard explicit. Use encrypted native storage and opt-in browser persistence for sensitive financial drafts. Browser leave-page prompts are a best-effort supplement, not a guarantee against data loss.
2. **PDF and scoped report exports.** Reuse the report range/filters and currency calculations so exported totals agree with the screen. Use native sharing and browser downloads/print adapters.
3. **A planned-budget layer with formulas.** Keep plans separate from actuals. Support percentage and ordered conditional rules first, with stable entry IDs, a dependency graph, cycle/missing-reference errors, documented rounding and explicit dates. Natural-language input should produce a previewed rule; never evaluate arbitrary JavaScript. This also gives section-copy and effective-dated entries a safe home.
4. **Generalize recurrence.** Reuse the existing commitment scheduler for bills/salary rather than building another month-copy engine. Test anchored month ends, leap years, cancellation, end dates and duplicate recording.
5. **Responsive table and review/lock modes.** Apply the same commands and server permissions in every layout. Review mode and locks prevent mistakes; shared-account roles provide authorization.
6. **Explicit share snapshots.** Add only after scope/redaction/revocation is verified. Existing authenticated viewer access remains suitable for ongoing collaboration.
7. **Font selection.** A lower-priority preference; bundle licensed fonts consistently across web, mobile and desktop and check Arabic fallback.

These are recommendations, not features silently added by this audit. FinancialAdvisor already exceeds the upload in multi-account/currency tracking, transfers/reconciliation, goals, loans, project commitments, planned-versus-actual budgets, CSV import, OCR, subscriptions/installments, collaborative ledgers, notifications and native/desktop distribution. Bank connections remain absent. The upload's “out of scope” list does not override our app's existing capabilities or roadmap.

## AI and release work requested alongside this audit

- Release display names use the tag (`v1.7.0`) while retaining the real prerelease/signing status; renaming does not rebuild or relabel binaries.
- Support local insights, optional ChatGPT plan usage after approval, a prepaid owner-funded hosted service, and session-only bring-your-own-key requests. These are separate funding choices with explicit consent, not automatic billing fallbacks.
- Purchases and hosted pricing remain disabled until the owner chooses rates and a payment provider. ChatGPT integration remains unavailable until an approved registration is configured. See [AI setup](ASSISTANT.md).
