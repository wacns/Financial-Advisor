# Enable Google sign-in for Northline Bahrain

The app implementation is complete and tested with a simulated Supabase service. Northline is now connected to the user's **Financial-Advisor** Supabase project (`srwzgwodlpylezdaipce`). Google is now enabled in the project's Auth settings. Northline is deployed at https://northline-bahrain.vercel.app/. The final Supabase Site URL / Redirect URLs configuration and a complete user Google consent/session test remain pending.

## 1. Supabase project — connected

The workspace migration is installed, ownership rules passed live transactional tests, anonymous REST reads are denied, and the security advisor reported no findings. `.env.local` contains the project URL and public publishable key. No privileged key is used by the app.

## 2. Create a Google OAuth client

In [Google Auth Platform](https://console.cloud.google.com/auth/overview):

- Configure consent branding as **Northline Bahrain**, with your support/contact email and the final application domain.
- Choose the intended audience. During testing, add the Google accounts that will test the app; publish the consent app for general availability when ready.
- Configure only the identity scopes: `openid`, email, and profile. Northline does not request Gmail, Drive, or other Google data access.
- Create an OAuth client of type **Web application**.
- Set the authorized JavaScript origin to the final site origin (scheme and hostname, no hash route).
- Copy the exact callback URI from Supabase → Authentication → Sign In / Providers → Google into Google's **Authorized redirect URIs**. For this project, use exactly `https://srwzgwodlpylezdaipce.supabase.co/auth/v1/callback`.

## 3. Enable Google in Supabase

In [this project’s Google provider settings](https://supabase.com/dashboard/project/srwzgwodlpylezdaipce/auth/providers), enable Google and save the OAuth **client ID** and **client secret** from Google. Enter the secret directly in Supabase; do not paste it into chat, commit it, or put it into a `VITE_` variable. No Google secret or Google client ID is needed in the frontend code.

In Supabase URL Configuration, set the Site URL and redirect allow list to the exact application document URL. A root deployment uses `https://<app-domain>/`; a subdirectory deployment uses that document path. The callback is handled before hash routing, so it needs no additional server route. For local testing add `http://localhost:5173/` (or the exact origin used in the browser).

The two callbacks serve different purposes:

- **Google → Supabase:** the `/auth/v1/callback` URL copied from the provider settings.
- **Supabase → Northline:** the application's document URL, which receives `?code=...` and exchanges it using the browser's PKCE verifier.

## 4. Verify live behavior

Rebuild with the Supabase URL and publishable key, deploy, and test **Continue with Google**. Confirm account selection, consent, opening the empty BHD workspace, a saved transaction surviving reload, sign-out, and cancellation. Use two accounts to verify the database ownership policies. The demo stays independent of signed-in records.

Automated local checks:

```sh
npm test
npm run test:e2e
npm run test:oauth
npm run build
```

Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` before the browser commands on this environment. The OAuth test suite uses a separate local port and fake public configuration, with Supabase endpoints intercepted in the browser; it never authenticates a real Google account.

Production application origin: `https://northline-bahrain.vercel.app`

Supabase Site URL and allowed Redirect URL: `https://northline-bahrain.vercel.app/`
