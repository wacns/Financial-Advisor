# Authentication and data ownership

Run all commands from the repository root. Local configuration belongs in the root `.env.local`.

## Supabase connection

Connected to **Financial-Advisor** (`srwzgwodlpylezdaipce`) in **WACNS's Org** (`xuhlnscnbxqvaydhzpdf`). The user created this project. Its API URL and publishable key are configured in ignored `.env.local`, and the workspace migration has been applied remotely.

Live verification passed: own-workspace reads/inserts, cross-user read/update/delete denial, forged-owner insert denial, owner reassignment denial, BHD-only enforcement, and anonymous read denial. Test fixtures were rolled back. The public Data API returned HTTP 401 for anonymous workspace access; the Supabase security advisor returned no findings.

Google and email/password are enabled in the project's public Auth settings. The production URL is configured and an OAuth cancellation correctly returns to FinancialAdvisor. A full Google account sign-in still needs user verification.

For another checkout or deployment:

1. Use the existing `srwzgwodlpylezdaipce` project; do not create a duplicate.
2. The workspace migration is already installed in this project. Apply it only when initializing a different empty database.
3. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the project dashboard. Never use a service-role or secret key in these browser-visible variables.
4. Enable email/password auth. Keep email confirmation enabled; configure production email delivery before a public launch.
5. Set the Auth Site URL and allowed redirect URL to the exact application document URL (for example `<origin>/`, or `<origin>/app/` for a subdirectory deployment). Google and email confirmation use PKCE and return there with a one-use `?code=`. Open confirmation links in the same browser that started sign-up. The app exchanges the code, removes callback parameters, then validates the user before opening the workspace. Include development document URLs only while developing.
6. Rebuild after environment changes. Vite embeds these public values at build time.
7. Configure Google using [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md). Verify Google consent, cancelled/expired callbacks, email sign-up, confirmation, sign-in, refresh, sign-out, and expired sessions with a real project. With two test users, verify that each can read/update only their own workspace and that anonymous requests cannot read data.

### Protection model

`/#/app/*` validates the user with Supabase `auth.getUser()` before reading their workspace. Hash routes serve the public app shell; private data protection comes from the database's Row Level Security, not from hiding frontend code. The migration explicitly enables RLS, revokes anonymous access, and restricts SELECT, INSERT, UPDATE, and DELETE to `auth.uid() = user_id`. UPDATE also checks the resulting owner. No user-editable metadata or privileged keys are used for authorization.

The initial storage model uses one JSON snapshot per user. Simultaneous edits from multiple devices use last-write-wins semantics; add optimistic concurrency before supporting coordinated multi-device editing. Live SQL and anonymous API access checks passed. The provider and production return URL are configured. A full Google account sign-in still needs user verification.

