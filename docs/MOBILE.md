# Ionic, iOS, Android and push notifications

FinancialAdvisor now uses **Ionic Core 9** web components with Vite and **Capacitor 8**. The existing finance modules, web routes, BHD arithmetic and Supabase workspaces are shared by the web, iOS and Android apps. This is a framework-independent Ionic integration; no React or Angular rewrite is required.

Native projects are versioned in `android/` and `ios/`. The provisional bundle/package ID is `com.wacns.financialadvisor`. Confirm it before registering production Firebase apps or App Store/Play Console records; an existing store app must retain its original ID. The native app bundles `dist/` assets and does not load the hosted website through `server.url`.

## Build and run

Use Node.js 24, JDK 21 and Android SDK Platform/Build Tools 36 for Android. iOS requires a Mac with the Xcode version supported by Capacitor 8 and a configured signing team. The generated project uses Swift Package Manager, including the Firebase package-identity workaround in `capacitor.config.json`.

```sh
npm ci
# Copy the public client configuration template and fill in the existing
# Supabase project URL and publishable key. Never use a service-role key here.
cp .env.example .env.native.local
npm run native:sync
npm run native:android
# On a Mac:
npm run native:ios
```

`native:sync` builds in Vite's `native` mode and syncs both platforms. `.env.native.local` is ignored by Git and is separate from normal web development/test configuration. Build-server variables can supply the same public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Native builds check these values before packaging. Existing public client values were used for the verified local debug build; they must be configured again on another checkout/build server.

Android Studio can run the app on an emulator or device. A debug APK can also be generated with `cd android && ./gradlew assembleDebug` once `ANDROID_HOME`/`JAVA_HOME` are configured. Release signing, distribution profiles, certificates and Firebase credentials are not committed. App icons and store artwork should be finalized before release.

The mobile shell adds Ionic bottom tabs, safe-area spacing and Android back handling. CSV and backup exports use the native share sheet. Auth sessions and PKCE verifiers use iOS Keychain / Android Keystore-backed storage; demo samples remain in their existing browser/WebView storage namespace. Native sessions and the hosted website's browser sessions are separate.

## Native sign-in: one Supabase dashboard addition

In [Supabase URL Configuration](https://supabase.com/dashboard/project/srwzgwodlpylezdaipce/auth/url-configuration), add this **additional Redirect URL**:

```text
com.wacns.financialadvisor://auth/callback
```

Keep the web Site URL as `https://financial-advisor-partner.vercel.app/`. Do not replace it with the native scheme. Google's provider callback remains `https://srwzgwodlpylezdaipce.supabase.co/auth/v1/callback`.

On devices, Google sign-in opens the system browser and returns through the registered app scheme. Both warm and cold app launches consume PKCE codes. Email confirmations must return to the same device/app that began registration. Email/password sign-in does not need the browser callback. The native scheme is configured in Android's manifest and iOS URL types; a different bundle ID/scheme requires updating those files and `src/auth.js` / `src/mobile.js` together.

## Firebase and Apple setup

Use one Firebase project for both apps:

1. Register Android package `com.wacns.financialadvisor`. Download its `google-services.json` to `android/app/google-services.json`.
2. Register the iOS app with bundle ID `com.wacns.financialadvisor`. Add `GoogleService-Info.plist` to `ios/App/App/` and the **App target's resources** in Xcode.
3. In the Apple Developer account, enable Push Notifications for the app ID. Select a signing team and matching provisioning profile in Xcode. Push entitlement, APNs delegate callbacks and remote-notification background mode are already in the source project.
4. Upload the APNs authentication key, Apple team ID and key ID to this Firebase iOS app's Cloud Messaging settings. Keep the private `.p8` key outside Git/chat.
5. Enable Firebase Cloud Messaging HTTP v1. Create a server service account with the Firebase Cloud Messaging API Admin role scoped to this Firebase project.
6. In [Supabase Edge Function secrets](https://supabase.com/dashboard/project/srwzgwodlpylezdaipce/functions/secrets), set `FCM_SERVICE_ACCOUNT` to the service account JSON. Set `PUSH_CRON_SECRET` to a separate random secret of at least 32 characters if enabling scheduled reminders. Never put either value into a `VITE_` variable or the mobile app.
7. Run `npm run native:sync` again and rebuild/install both apps.

No Firebase app configs, APNs credentials or server service-account secret have been supplied in this migration. Push delivery cannot be verified until those are configured and a physical device is registered. iOS must also be compiled and exercised on a Mac/device; the Linux environment cannot compile an iOS binary.

Firebase auto-initialization is disabled in both platform manifests. The app requests permission only when a signed-in user taps **Settings → Enable notifications**. Demo users and web browsers cannot register native tokens. Android has a dedicated notification channel and monochrome status icon. iOS foreground presentation requests alerts and sound.

## Backend and device lifecycle

The migration `20261016083103_mobile_push_devices.sql` is already applied to `srwzgwodlpylezdaipce`. Do not reapply it there. The following Edge Functions are deployed:

| Function | Caller | Behavior |
| --- | --- | --- |
| `register-device` | Signed-in user JWT | Register/refresh this installation or disconnect its current owner |
| `send-push` | Signed-in user JWT | Send a generic test only to the caller's registered installation |
| `dispatch-reminders` | Scheduler with server-only `x-reminder-secret` | Send generic due/overdue payment reminders after 09:00 Bahrain time |

Registration derives the owner from a validated Supabase user, never a submitted `userId`. The device table's RLS permits only own-device reads/deletes; direct client inserts/updates are revoked. Registration limits each user to ten devices. A stable installation ID and rotating FCM token are retained for the current owner. Explicit disable/sign-out disconnects the registration and/or deletes the provider token; failure of both operations leaves notifications enabled and asks the user to retry. No token values appear in the UI.

Reminders include no balances, amounts, merchant names or account details. Taps navigate only to known app pages and still pass the normal authenticated route gate. Devices inactive for thirty days are skipped. Unregistered provider tokens are deleted after a delivery attempt.

The service-only delivery table and claim function prevent concurrent duplicate claims. Failed deliveries can retry, and expired claims can recover after five minutes. Successful reminders are keyed by user, installation and Bahrain date. As with external message systems, a provider acknowledgement lost during a failure can still produce a duplicate on retry. Test notifications target only the requested owned installation and are limited to one successful send per minute.

## Enable the reminder schedule after credentials work

No reminder job is scheduled yet. After a successful device test, save the same `PUSH_CRON_SECRET` in Supabase Vault under `financial_advisor_push_cron_secret`. Enable `pg_cron`, `pg_net` and Vault in the project, then run [setup-reminders.sql](../supabase/setup-reminders.sql) in the private SQL editor. The script verifies that the Vault entry exists without displaying its contents. Do not commit the secret or paste it into chat.

The job invokes the dispatcher hourly. Before 09:00 Bahrain time it does nothing; afterward it checks active expense schedules and outstanding debt payments due on or before the current Bahrain date. Paused schedules, income and fully repaid loans are excluded. A paid occurrence advances its existing schedule and therefore stops being due. Repeated hourly invocations deduplicate successful sends for that day. Disable the job with `select cron.unschedule('financial-advisor-payment-reminders');`.

## Verification and release boundary

Automated checks cover native OAuth callback validation, opt-in permissions, token rotation, account changes, registration failure recovery, navigation allow lists, generic FCM payloads, scheduler authentication and Bahrain dates. Live database tests verified own-device isolation, cross-user deletion denial, anonymous denial, revoked client registration writes and delivery-claim retry/deduplication. Test fixtures were rolled back. Anonymous calls to all three functions returned 401. Edge Function TypeScript checks passed.

The web build, native asset sync, 32 unit tests, 14 browser checks and Android debug APK compilation passed in this environment. The debug artifact is generated at `android/app/build/outputs/apk/debug/app-debug.apk` (and copied into ignored `artifacts/financial-advisor-debug.apk` for review). A signed iOS build, physical-device notification receipt/tap behavior, background delivery, APNs credentials, Firebase secrets, custom-scheme allowlisting and store submission require the platform setup above. This migration provides the implementation and native projects; it does not claim App Store / Play Store publication or live push delivery.
