# Capture and assistant

Capture & assistant is shared by React web, React Native and the Electron desktop app. Text parsing and Local insights run locally. Voice asks the selected device/browser speech service for a transcript; it prefers on-device recognition where supported. All captured entries open the normal reviewed entry form. No speech, SMS, Shortcut or model response posts a transaction automatically.

The cloud assistant is optional. Its Supabase Edge Function is deployed but remains unavailable until both server secrets are configured. The separate ChatGPT subscription option described below is not connected yet.

1. Create or choose a Vercel AI Gateway API key in your own account and choose a supported text model from the current [Gateway model catalog](https://ai-gateway.vercel.sh/v1/models). For example, `openai/gpt-5-nano` was in the catalog on 2026-10-20; choose according to your budget and test its structured-output behavior.
2. In [Supabase Edge Function secrets](https://supabase.com/dashboard/project/srwzgwodlpylezdaipce/functions/secrets), set `AI_GATEWAY_API_KEY` and `AI_GATEWAY_MODEL`. Keep the key out of chat, source, client config and `EXPO_PUBLIC_*` variables.
3. In the signed-in app, open Capture & assistant → Cloud AI. Choose whether to share the displayed aggregate summary, allow cloud processing, and ask a question. First test without a financial summary. Review any proposed entry before saving.

The endpoint verifies the Bearer token using Supabase `auth.getUser`, then enforces consent and strict input/output validation. It does not retrieve a workspace or supply model tools. Unknown summary fields are discarded; the optional summary contains only the displayed aggregate totals and top category totals. Each question is independent; previous chat messages are not sent. The app keeps its conversation in memory only while the screen is open. Provider retention depends on the chosen Gateway/provider account; the app does not promise zero provider retention.

The database quota permits at most 20 attempted requests per user per UTC day and five seconds between attempts. The function caps output tokens at 1,500, disables retries and times out after 25 seconds. Failed provider attempts still count. Quota records contain user ID, date, count and request time only; no prompt, financial summary or model response is stored. These controls bound use but do not replace a provider budget configured in your own account. No paid provider call has been made by this implementation.

Backend sources: `supabase/functions/financial-assistant`, `supabase/migrations/20261020071106_assistant_quota.sql`. AI SDK dependencies are pinned server-side and excluded from the client bundle. To verify locally:

```sh
npm ci --prefix supabase/functions/financial-assistant --ignore-scripts
cd supabase/functions/financial-assistant
npx --yes deno@2.9.6 check --config deno.json index.ts
```

The function performs its own authentication, so `verify_jwt = false` disables only Supabase's legacy gateway JWT check. It never permits an unauthenticated model request. Unit tests verify this boundary; SQL tests cover quota isolation, burst/daily caps and denial of direct counter modification.

iOS Shortcuts actions “Review payment text” and “Review expense” require iOS 16+ and a new signed native build. Personal SMS/Apple Pay automations may pass text/amount parameters with user authorization. Both mobile platforms accept `com.wacns.financialadvisor://capture?amount=4.250&currency=BHD&name=Coffee`, or `?text=` with URL-encoded payment text. Links do not contain session tokens and cannot save records. Review direction, account, currency, amount and date in the app.

## Using a user's ChatGPT subscription

OpenAI's [Sign in with ChatGPT quickstart](https://developers.openai.com/siwc/quickstart), checked on 2026-10-20, supports optional ChatGPT plan usage for eligible AI requests. Availability depends on both the app registration and the user's account. Open-source integrations have a documented registration flow; private clients require selection/approval. FinancialAdvisor's source is private, and public installers do not make it an open-source project. Keep the source private and request the approved private-app integration rather than using the open-source registration route.

The owner can submit the [OpenAI interest form](https://openai.com/form/sign-in-with-chatgpt-interest/) and choose **Sign in and ChatGPT plan use for AI requests**. Suggested application details:

- Product: FinancialAdvisor.
- Website: https://financial-advisor-partner.vercel.app/.
- Description: A private-source personal finance app for web, iOS, Android and desktop. Users review expenses, budgets, subscriptions and installment plans. We want an optional Continue with ChatGPT connection so eligible users can use their own plan for finance explanations and editable transaction suggestions. Users explicitly choose whether to share an aggregate financial summary. The assistant cannot execute transactions or modify records.
- Requested capability: identity linking and optional ChatGPT plan usage for the existing assistant, with user-controlled disconnection and usage limits. Please confirm availability and registration/callback requirements for the hosted web app and native/desktop clients.

No application has been submitted by this implementation, and no OpenAI client ID or approval is configured. The integration is not enabled by setting the existing Gateway secrets. Once OpenAI supplies an approved client registration and request contract, implement and verify:

1. **Connect from the existing signed-in account.** Use the approved OAuth/OIDC flow with PKCE, state and nonce validation. Explicitly confirm linking to the current FinancialAdvisor account; do not silently merge accounts by email or replace the existing Supabase session with an OpenAI token.
2. **Protect credentials.** Use a server-side token store for hosted web, or platform secure credential storage where supported by the approved native/desktop flow. Keep provider tokens out of renderer/browser storage, logs, analytics, URLs and financial backups. Register exact callback URLs for each approved client.
3. **Obtain separate plan-use consent.** Show Continue with ChatGPT, identify when the user's plan is in use, link to ChatGPT usage settings, support disconnect and token expiry, and handle ineligible accounts or exhausted allowances. Do not silently fall back to a separately billed provider.
4. **Use the approved Responses API path.** Do not send subscription OAuth tokens to AI Gateway. The current [preview contract](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) requires streaming and `store: false`, and rejects several options used by the current Gateway path, including `max_output_tokens`. Confirm the private client's contract rather than reusing this handler unchanged. Retain consent, aggregate-only optional context, response validation, timeouts and reviewed drafts.

Plan use shares the user's included allowance and is not unlimited. Additional credit usage depends on the user's explicit ChatGPT settings. See [OpenAI's user guide](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites). Ordinary API billing remains separate; local insights and capture continue working without either cloud connection.
