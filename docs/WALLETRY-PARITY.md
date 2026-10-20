# Walletry reference and implementation

Reference reviewed on 20 October 2026: [Walletry on the Singapore App Store](https://apps.apple.com/sg/app/walletry-expense-tracker/id6458391876), Apple's public lookup metadata/screenshots (v27.0.0), and [the developer's feature list](https://walletry.app). Public listing material is evidence of advertised features, not a test of Walletry's signed-in or paid workflows. No Walletry code, artwork or branding is copied.

FinancialAdvisor already has shared React web/native screens, multi-currency accounts, transfers, categories/subcategories, transaction templates, tags/labels, budgets and cycles, reporting, receipt OCR, privacy controls, exports and mobile reminders.

This implementation adds first-class payees/payers, managed colored tags, account colors/icons/defaults/exclusion from totals, reward tracking, pinned/day-grouped transactions, advanced search, rolling report ranges, multiple-account chart scopes, dedicated subscriptions and finite installment schedules. Subscription/plan payments distinguish an expense from a manual tracking-only acknowledgement. Existing workspaces gain empty collections, with no automatic financial records or balance changes.

Implemented in 1.7.0:

| Reference capability | FinancialAdvisor implementation |
| --- | --- |
| Shareable accounts | Separate Supabase shared ledger; owner/editor/viewer permissions, expiring one-use invitations, audit history, realtime/poll refresh, optimistic conflict protection and CSV export. No personal records are copied or shared automatically. |
| Custom accounts | Colors/icons, default account, optional exclusion from tracked totals, last four digits, credit/loan/investment terms and expense reward points. |
| Contacts and tags | Payee/payer roles, linked-entry totals/search and managed colored tags; category appearance and safe rename propagation. |
| Search and charts | Pinned/day-grouped transactions, multi-account/date/amount/contact/tag search; rolling periods, multi-account report scopes and payee grouping. |
| Budget guidance | Existing category/cycle budgets plus days remaining, daily allowance and approaching/exceeded-limit notices. |
| Subscriptions | Billing interval, provider, trial end, HTTPS website, pause/resume/cancel, payment history and annualized monthly cost. No automatic charge. |
| Installments | Finite schedules with last-payment rounding, exact total/remaining/progress, history and reversible linked expenses. Manual paid acknowledgements do not create spending. |
| Calendar and reminders | New plans appear in the central calendar/overview and existing opt-in payment reminders. Paid, cancelled and paused occurrences are excluded from due reminders. |
| Text and voice entry | Local multi-message parser with Arabic digits, conservative amount/date ambiguity handling, editable draft review, matching-currency account selection and duplicate-message protection. Browser/native speech is opt-in. |
| Money assistant | Local aggregate insights. Optional cloud function verifies the user, requires consent, accepts an optional allowlisted aggregate summary, validates suggestions and enforces 20 requests per UTC day with five-second spacing. No model tools or database writes. |
| Currency tools | Saved-rate calculator, explicit fetch → review → apply for reference quotes, date/source/history, manual rate editing and an external ATM search. |
| Shortcuts and widgets | iOS 16+ App Intents for text/expense draft review; strict capture URLs on iOS/Android. Existing Android quick-entry/template widgets remain. |
| Receipts and exports | Existing local receipt OCR, reviewed expense entry, photo/PDF attachments, transaction CSV and complete JSON backup/restore; new metadata is preserved in backups. PDF text OCR is not added. |

The shared-account migration and assistant quota migration are additive and deployed to `srwzgwodlpylezdaipce`. Database regression scripts create synthetic accounts inside a transaction and roll back all test data. No reference-site or existing personal financial records were modified.

Cloud AI requires server-only `AI_GATEWAY_API_KEY` and `AI_GATEWAY_MODEL` secrets; see [assistant setup](ASSISTANT.md). It returns a clear unavailable response until configured. No provider key, credit purchase or budget change is made automatically. Local capture, insights and other features do not require AI credentials.

Native speech permissions/code and App Intents require installing the new native binary; Expo updates cannot add them to 1.6.0. iOS Shortcuts open drafts for review and do not read the SMS inbox, Apple Pay history or bank accounts. Device speech services may process audio online when on-device recognition is unavailable. Physical-device permission, audio, automation and push delivery require device verification.

Not included: dedicated Apple Watch/visionOS applications, iOS WidgetKit/Control Center widgets, Live Activities, financial institution connections, automatic bill payment, cryptocurrency precision or a broader currency catalog. Shared ledgers are independently scoped; personal budgets/reports do not silently include shared balances. These distinctions prevent double-counting existing personal records.

Verification includes unit regressions, browser desktop/phone workflows, mocked authenticated UI permissions, real local/hosted SQL authorization tests, web/native bundle exports, native project generation, AI function type-check and an unauthenticated deployed-endpoint rejection check. Installer compilation results are recorded with the release workflow; successful builds do not replace physical-device testing.
