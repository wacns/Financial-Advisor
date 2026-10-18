# Deployment

Production: https://financial-advisor-partner.vercel.app/

- Vercel project: `prj_qxwKj4JA488Ma9AJktColvsqIR6c` (`financial-advisor-partner`)
- Account: `team_xwKACwKczzvsN97PQXPLT8tT` (`wacns-projects`)
- GitHub repository: `wacns/Financial-Advisor`, root directory **repository root** (leave Vercel Root Directory blank), production branch `main`.
- The Vercel Git integration is connected; pushes to `main` trigger production builds.
- Commits must use an email recognized by the connected GitHub account. For this repository, use `43343208+wacns@users.noreply.github.com`; an unlinked author email causes Vercel to block the deployment before building.
- Public Supabase build variables are configured for production, preview, and development.
- Production is publicly reachable; Vercel authentication remains enabled on previews. Private finance data is protected by Supabase authentication and RLS.

## Hostname transition

The Vercel project and public address are now `financial-advisor-partner` and `https://financial-advisor-partner.vercel.app/`. The original `https://northline-bahrain.vercel.app/` remains attached during the transition so existing links and sessions keep working.

**Verified URL configuration:** in [Supabase URL Configuration](https://supabase.com/dashboard/project/srwzgwodlpylezdaipce/auth/url-configuration), set:

- Site URL: `https://financial-advisor-partner.vercel.app/`
- Redirect URLs: add `https://financial-advisor-partner.vercel.app/` and retain `https://northline-bahrain.vercel.app/` during the transition. Preserve any required development entries.

The user updated Auth URL configuration in the Supabase dashboard. Live browser checks on 2026-10-16 confirmed that both the application-specific Google redirect and the default Site URL return to `https://financial-advisor-partner.vercel.app/` after OAuth cancellation. The new address also serves the app over HTTPS and reaches Google authorization. Complete Google consent and email confirmation must also be checked in the browser that started the flow; PKCE verifiers and sessions are scoped to their origin. Signed-in workspace records remain in the same Supabase project. Local demo edits and login sessions are separate between hostnames.

Google's provider callback remains `https://srwzgwodlpylezdaipce.supabase.co/auth/v1/callback`; changing the application address does not replace that callback.

## Build settings

- Framework: Vite; Node.js: 24.x.
- Install: `npm ci`.
- Build: `npm test && npm run build` (defined in root `vercel.json`).
- Output: `dist`.
- No working-directory override or `cd northline` is needed.

The unit suite must pass before Vercel builds a deployment. Run both browser suites before pushing changes; the Vercel build does not install browser binaries or run Playwright. The existing Git integration remains responsible for deployment, so no second deployment workflow or Vercel token is required.

## Existing local checkouts

After pulling the root-layout change, move any ignored `northline/.env.local` and `northline/.vercel/` into the repository root. These local files were never in Git, so Git cannot move them. Run `npm ci` from the root to install dependencies there. The old nested `node_modules`, `dist`, and browser artifacts are disposable; remove them only after confirming no local work remains in that folder. Do not commit environment files or Vercel metadata.

The earlier repository directory move did not change URL routes. The later hostname transition is covered above. Database migrations are preserved byte-for-byte and must not be reapplied for this move.

## v1.5 rollout

No database migration rewrites existing records. New fields and empty collections are normalized in memory; the next explicit save persists the upgraded JSON for that user. Root `currency: BHD` and existing RLS constraints remain; account currencies and reporting currency are separate fields. A backup restore remains an explicit in-app user action.

The web build's `prebuild` script stages self-hosted OCR worker/core/English-data assets under ignored `public/ocr/`; Vite copies them to the deployment. Commit the preparation script and lockfile, not generated binaries. OCR loads these assets only when requested. Rebuild installed native clients for the new module and privacy gate; Vercel cannot update an installed iOS/Android app.

The `dispatch-reminders` Edge Function was updated to version 2 with workspace hour/cadence and salary/check-in preferences. Its existing server-secret authentication remains in place. No authenticated test notification or dispatch send was made during implementation. Provider credentials and device delivery remain setup/verification tasks.

Production browser smoke checks passed for Overview, cycle budgets, salary, forecast, receipt scanner, warranties and data tools, with zero page errors. Both self-hosted OCR worker and English language data returned HTTP 200. An unauthenticated private route redirected to login. These used a fresh browser demo context and did not access or change private financial records.
