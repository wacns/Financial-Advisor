# Capture, assistant and AI funding

Capture & assistant is shared by React web, React Native and Electron. Text parsing and Local insights work on the device. Device speech is opt-in and prefers on-device recognition where supported. Every suggestion opens a reviewed entry form; speech, SMS, Shortcuts and model responses cannot post transactions automatically.

## Choose how AI requests are funded

| Option | Who provides access | Charges and availability |
| --- | --- | --- |
| Local insights | No provider/key | Works locally, without AI usage charges. |
| My ChatGPT subscription | The user's separately authorized ChatGPT plan | Foundation only, awaiting OpenAI approval and connection setup. Identity sign-in alone does not authorize subscription inference. |
| FinancialAdvisor AI | The owner's server-side Gateway key | Prepaid app credits, with an explicit displayed per-question credit price and consent. Pricing and purchases are not configured yet. |
| My own API key | Each user's OpenAI API or Vercel AI Gateway key | The provider bills the user's API account. No FinancialAdvisor credits are charged. The key is session-only. |

The app never silently changes funding options. Ordinary API-key calls are billed separately from ChatGPT subscriptions. All cloud questions require sign-in, cloud-processing consent and explicit acceptance of the chosen charges. Missing keys, pricing, permission, allowance or credits produce a clear error rather than a paid fallback.

## Bring your own key

In Capture & assistant, select **My own API key**, choose OpenAI API or Vercel AI Gateway, enter the key and an exact model ID available to that account, review provider pricing, and accept provider charges. Choose whether to include the displayed aggregate summary, allow cloud processing and ask a question. OpenAI uses the Responses API; Gateway uses a `provider/model` ID. Structured-output support depends on the selected model. Check the provider's current catalog and prices; the app does not estimate a currency price for an arbitrary model.

The key stays in the screen's memory, is sent over HTTPS to the assistant Edge Function and selected provider, and is cleared on leaving the screen, changing funding options/provider, signing out, or choosing Clear API key. It is not written to browser/session storage, financial records, backups or the credit database. The app does not log prompts or credentials. Only fixed OpenAI/Gateway endpoints are supported; custom base URLs are rejected. Provider account retention and charging policies still apply, including possible charges for failed API requests. No real provider call was made during implementation verification.

## Configure the owner's hosted service

Set these server-only values in [Supabase Edge Function secrets](https://supabase.com/dashboard/project/srwzgwodlpylezdaipce/functions/secrets):

- `AI_GATEWAY_API_KEY`: the owner's Gateway API key.
- `AI_GATEWAY_MODEL`: a supported structured-output text model from the current [Gateway catalog](https://ai-gateway.vercel.sh/v1/models).
- `AI_HOSTED_CREDITS_PER_REQUEST`: integer 1–1000000 app credits per successfully completed question.
- `AI_HOSTED_PRICING_VERSION`: version label, 1–80 letters/digits/dots/underscores/hyphens. Change it when the price changes.

All four values are required to enable hosted inference. No credit price, currency conversion, credit bundle or payment provider has been chosen automatically. **Purchases remain disabled**, even if the inference price is configured. Never put a server key into chat, client configuration or `EXPO_PUBLIC_*` variables. Configure a provider budget in the owner's own account.

Credits are separate from financial accounts. Private tables store wallet balances, idempotent grants and per-request reservation/completion/refund metadata. Only the service role can change credits. Authenticated users can read their own balance and last 20 request statuses through `fa_ai_credit_status`; they cannot grant themselves credits by changing a workspace or user metadata.

For a future payment integration, verify the payment provider's signed webhook server-side before calling `fa_ai_credits` with `p_action: 'grant'`, the authenticated purchase's user ID, a positive integer amount and the verified unique event reference. A repeated matching reference does not mint credits twice; a different user/amount with the same reference is rejected. There is no client top-up endpoint or unverified success-page credit grant. Administrative trial grants, if desired later, use the same trusted service RPC and a unique audit reference; none were issued to real users here.

A question reserves its quoted price atomically before inference. Successful validated output completes the reservation; provider/output failure attempts an idempotent refund. Reusing the same request ID never invokes a second provider request or charge. If the function/database connection fails during settlement, inspect the user's recent request status before retrying. An administrator can reconcile a genuinely abandoned `reserved` request with the service-only `refund` action using its user/request IDs. Completed requests cannot be refunded by that action. Automatic expiry/refunds and user refund/credit purchase flows are not implemented. Provider costs for failed or interrupted calls can still fall to the owner.

## Authentication, privacy and limits

The Edge Function verifies the Bearer token with Supabase `auth.getUser`. The public capabilities action exposes only availability and price metadata; private balance/history requires authentication. It never retrieves a financial workspace or supplies model tools. Unknown summary fields are discarded. Optional context contains month/currency, aggregate totals and top category totals; account names, descriptions, receipts, contacts and prior messages are not sent. Questions and conversation are kept in screen memory only. Provider retention depends on the selected account; zero provider retention is not promised.

The existing quota remains at most 20 attempts per user per UTC day and five seconds between attempts across cloud funding modes. Output is bounded to 1,500 tokens, retries are disabled and generation times out after 25 seconds. Failed provider attempts count toward quota. API keys never enter model prompts or request/credit metadata. The own-key OpenAI path sets `store: false`. Suggestions receive strict schema and amount/date/currency validation before the app offers review.

Sources: `supabase/functions/financial-assistant`, `supabase/migrations/20261020071106_assistant_quota.sql`, `supabase/migrations/20261020091000_ai_prepaid_credits.sql`. The function does its own authentication; `verify_jwt = false` disables only the legacy gateway check. AI SDK/OpenAI provider dependencies are pinned server-side and excluded from client bundles. Check with:

```sh
npm ci --prefix supabase/functions/financial-assistant --ignore-scripts
npx --yes deno@2.9.6 check --config supabase/functions/financial-assistant/deno.json supabase/functions/financial-assistant/index.ts
```

## ChatGPT sign-in foundation

OpenAI's [quickstart](https://developers.openai.com/siwc/quickstart), checked 20 October 2026, makes private-app access approval-dependent. FinancialAdvisor has no approval/client registration yet. The login page and assistant show **Continue with ChatGPT** in an unavailable state. The code supports the configured Supabase custom OIDC provider `custom:chatgpt`, PKCE/system-browser callbacks and explicit signed-in identity linking. It requests identity scopes only: `openid profile email`. No ChatGPT inference tokens are requested or saved through this login foundation.

After approval, configure **Authentication → Sign In / Providers → Custom Providers** using [Supabase's custom OIDC guide](https://supabase.com/docs/guides/auth/custom-oauth-providers) and OpenAI's registered client authentication method. Use identifier `custom:chatgpt`, issuer `https://auth.openai.com`, OpenAI discovery and exact callback `https://srwzgwodlpylezdaipce.supabase.co/auth/v1/callback`. Keep PKCE and nonce checks enabled. Register the app's existing allowed web and native return URLs in Supabase. Validate client authentication, claims/email handling, account creation, sign-out and linking against a test account before enabling it. Never treat an unverified matching email as ownership or expose the client secret in public configuration. Public-client registrations must use a Supabase/server flow compatible with the exact token authentication method OpenAI provisioned; do not invent a client secret.

Only after that configuration is verified, set server secret `CHATGPT_SIGN_IN_ENABLED=true`. This exposes identity sign-in, not subscription requests. Manual identity linking must also be enabled in Supabase to use the signed-in link action. Native/desktop callbacks reuse the existing session exchange and exact custom scheme. End-to-end OpenAI sign-in cannot be verified until an approved client exists.

**Subscription inference remains intentionally unavailable in this foundation.** The approved private-client plan-use contract, separate user consent, secure server-side token storage/refresh/revocation, account-specific model catalog and usage-limit UX must be connected after approval. Do not add plan scopes to the identity-only Supabase flow: its provider-token handling is not our subscription token vault. Do not send ChatGPT OAuth tokens to Gateway. The documented [plan API contract](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) requires streaming and `store: false` and rejects parameters used by the existing API-key path, including `max_output_tokens`; confirm the approved private-client contract before implementing it.

## Private approval and open-source alternatives

For the private hosted product, submit the [OpenAI interest form](https://openai.com/form/sign-in-with-chatgpt-interest/) with **Sign in and ChatGPT plan use for AI requests**. Suggested product description:

> FinancialAdvisor is a private-source personal finance app for web, iOS, Android and desktop at https://financial-advisor-partner.vercel.app/. Users review expenses, budgets, subscriptions and installment plans. We want optional ChatGPT identity linking and user-authorized plan usage for explanations and editable transaction suggestions. Users choose whether to share aggregate totals; the assistant cannot execute transactions or modify records. Please confirm registration/callback and plan-use requirements for hosted web and native/desktop clients.

The [open-source registration guide](https://developers.openai.com/siwc/token-sharing-open-source/sign-in) documents a direct local-client flow without a partner API key/client secret or commercial interest-form step. Eligible users authorize the client in their own browser; first registration uses `dynamic_agent_client` and returns a per-account issued client ID. That flow requires a stable installation host ID, one-use state/nonce and PKCE, exact loopback callback, JWT verification, secure local credential storage and token refresh. It is not a shared client ID or access token that can be copied into a website.

**Making a GitHub repository public does not automatically register a hosted website or grant commercial partner approval.** A genuinely open-source local client can follow the documented open-source route; our hosted/private identity integration follows its own registration requirements. Releasing an independently licensed local client is another possible architecture without publishing the entire hosted backend. Supported open-source licensing, release/distribution and the platform flow need to be decided before using that route. No repository visibility or license was changed here, and no interest form was submitted. [OpenAI's usage guide](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites) explains eligible accounts and shared plan limits.

## Native capture

iOS Shortcuts actions Review payment text and Review expense require iOS 16+ and a new signed native build. Authorized personal automations can pass text/amount parameters. Both platforms accept `com.wacns.financialadvisor://capture?amount=4.250&currency=BHD&name=Coffee`, or `?text=` with URL-encoded text. Links cannot contain session tokens or save records. Review direction, account, currency, amount and date. Microphone services may process audio online where on-device speech is unavailable.
