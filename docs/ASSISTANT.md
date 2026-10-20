# Capture and assistant

Capture & assistant is shared by React web, React Native and the Electron desktop app. Text parsing and Local insights run locally. Voice asks the selected device/browser speech service for a transcript; it prefers on-device recognition where supported. All captured entries open the normal reviewed entry form. No speech, SMS, Shortcut or model response posts a transaction automatically.

The cloud assistant is optional. Its Supabase Edge Function is deployed but remains unavailable until both server secrets are configured.

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
