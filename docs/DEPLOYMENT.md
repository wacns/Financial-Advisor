# Deployment

Production: https://northline-bahrain.vercel.app/

- Vercel project: `prj_qxwKj4JA488Ma9AJktColvsqIR6c` (`northline-bahrain`)
- Account: `team_xwKACwKczzvsN97PQXPLT8tT` (`wacns-projects`)
- GitHub repository: `wacns/Financial-Advisor`, root directory **repository root** (leave Vercel Root Directory blank), production branch `main`.
- The Vercel Git integration is connected; pushes to `main` trigger production builds.
- Commits must use an email recognized by the connected GitHub account. For this repository, use `43343208+wacns@users.noreply.github.com`; an unlinked author email causes Vercel to block the deployment before building.
- Public Supabase build variables are configured for production, preview, and development.
- Production is publicly reachable; Vercel authentication remains enabled on previews. Private finance data is protected by Supabase authentication and RLS.

In Supabase URL Configuration, set Site URL and an allowed Redirect URL to exactly `https://northline-bahrain.vercel.app/`. This final dashboard setting cannot be changed by the available connector tools. Google’s callback stays `https://srwzgwodlpylezdaipce.supabase.co/auth/v1/callback`.

## Build settings

- Framework: Vite; Node.js: 24.x.
- Install: `npm ci`.
- Build: `npm test && npm run build` (defined in root `vercel.json`).
- Output: `dist`.
- No working-directory override or `cd northline` is needed.

The unit suite must pass before Vercel builds a deployment. Run both browser suites before pushing changes; the Vercel build does not install browser binaries or run Playwright. The existing Git integration remains responsible for deployment, so no second deployment workflow or Vercel token is required.

## Existing local checkouts

After pulling the root-layout change, move any ignored `northline/.env.local` and `northline/.vercel/` into the repository root. These local files were never in Git, so Git cannot move them. Run `npm ci` from the root to install dependencies there. The old nested `node_modules`, `dist`, and browser artifacts are disposable; remove them only after confirming no local work remains in that folder. Do not commit environment files or Vercel metadata.

The public site URL and OAuth callback URLs stay the same: a repository directory move does not change URL routes. Database migrations are preserved byte-for-byte and must not be reapplied for this move.
