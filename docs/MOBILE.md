# React Native, Expo, iOS, Android and push notifications

FinancialAdvisor uses React 19, React Native 0.88, Expo SDK 58 and React Native Web. Shared React components render browser DOM through Vite and native iOS/Android views through Metro/Hermes. The mobile apps do not wrap the hosted website. Financial calculations, forms, validation and Supabase workspaces are shared.

The package and bundle ID remains `com.wacns.financialadvisor`. The native callback remains `com.wacns.financialadvisor://auth/callback`. No database migration or new Supabase project is needed for this framework change.

## Build and run

Use Node.js 24. Local Android compilation requires JDK 21, Android SDK Platform/Build Tools 37 and NDK 27.1.12297006, as required by React Native 0.88. iOS compilation needs a Mac with the Expo SDK 58 supported Xcode toolchain, CocoaPods and a signing team. EAS can build both platforms remotely after the account/project and signing credentials are configured.

```sh
npm ci
cp .env.example .env.local
# Set the existing public Supabase URL and publishable key under both prefixes:
# VITE_SUPABASE_* for web; EXPO_PUBLIC_SUPABASE_* for native.
npm run dev
npm run build:native
npm run native:android
# On macOS:
npm run native:ios
# Start Metro for an installed Expo development build:
npm start
```

The demo works without backend configuration. Live native sign-in needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` at build time. Never use a Supabase service-role key or Firebase service account in `VITE_` / `EXPO_PUBLIC_` values. The previous `.env.native.local` was Vite/Capacitor configuration; Expo does not load that mode-specific file. Move its public values into `.env.local` with the new Expo names.

`app.config.js`, `firebase.json` and `plugins/` are the source of native configuration. `android/` and `ios/` are generated and ignored. Use `npm run native:prebuild -- --clean` to regenerate after configuration changes. Generated project edits are overwritten. Expo Go cannot load the native Firebase module; use a development build or a release build.

`eas.json` provides development, internal preview (Android APK), and production profiles. After linking your own Expo/EAS project, use `eas build --profile development --platform android`, `eas build --profile preview --platform android`, or `eas build --profile production --platform all`. EAS login, store records, signing and submission are separate release steps and have not been performed here. Because local Firebase files are ignored, configure EAS file environment variables `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICE_INFO_PLIST` for remote builds; the app config reads their file paths. Supply the public `EXPO_PUBLIC_SUPABASE_*` values in the corresponding EAS build environment too.

## Shared experience and platform boundaries

The same screens cover overview, accounts, transactions/transfers, budgets, goals, bills/salary, calendar, debts, projects, insights and settings. Desktop uses a sidebar; phones use bottom tabs and a More menu. Native safe areas and Android back handling are built in. Browser exports download CSV/JSON; mobile exports use the native share sheet.

Web sessions use the existing Supabase browser storage. Native sessions and PKCE verifiers use Expo SecureStore (iOS Keychain / Android Keystore), split into small UTF-8 chunks with atomic manifest replacement. Non-sensitive installation IDs, opt-in ownership and demo data use AsyncStorage. Browser demo data retains the `northline-bh-demo-v1` key. A previously installed Capacitor app has separate local storage: sign in again to recover cloud data; local demo edits are not automatically transferred.

## Supabase native callback

In [Supabase URL Configuration](https://supabase.com/dashboard/project/srwzgwodlpylezdaipce/auth/url-configuration), include this **additional Redirect URL**:

```text
com.wacns.financialadvisor://auth/callback
```

Keep the Site URL `https://financial-advisor-partner.vercel.app/`. Google's provider callback remains `https://srwzgwodlpylezdaipce.supabase.co/auth/v1/callback`.

Google opens the system auth browser and returns a PKCE code to the app. Browser and deep-link events deduplicate the same one-use code. Warm/cold links validate the exact scheme, host and callback path before exchange. Email confirmations must return to the same device that started registration. Credential-free callback tests do not establish live Google consent or device callback readiness.

## Firebase and Apple configuration

The existing backend sends FCM HTTP v1 messages. Both native platforms use **React Native Firebase FCM tokens**, not Expo Push tokens or raw APNs tokens. `expo-notifications` handles Android notification permission/channel configuration; it does not replace the FCM backend.

1. In one Firebase project, register Android package `com.wacns.financialadvisor`. Save `google-services.json` at the **repository root**.
2. Register the corresponding iOS bundle ID and save `GoogleService-Info.plist` at the **repository root**. Both files are ignored. Configure both before prebuilding both platforms together, or prebuild only the platform whose file you have supplied.
3. The Expo configuration enables Firebase's native plugins when a Firebase file is present. Clean prebuild copies the files, configures the native Firebase SDK and generates the Android `ic_stat_finance` notification icon. Auto-init and analytics collection are disabled; the app requests permission only after a signed-in user taps **Settings → Enable notifications**.
4. Enable Push Notifications for the Apple app ID, configure the signing team/provisioning, and upload your APNs authentication key, team ID and key ID to Firebase Cloud Messaging. Keep the private `.p8` key outside Git/chat. Background remote-notification mode and the push entitlement are generated by Expo. Production/preview EAS profiles use production APNs; local builds default to development. Set `APP_PUSH_ENVIRONMENT=production` when generating a local release project.
5. Enable FCM HTTP v1 and provide a server service account with Firebase Cloud Messaging API Admin privileges scoped to this project. In [Supabase Edge Function secrets](https://supabase.com/dashboard/project/srwzgwodlpylezdaipce/functions/secrets), set `FCM_SERVICE_ACCOUNT` to its JSON and `PUSH_CRON_SECRET` to an independent random secret of at least 32 characters if scheduling reminders.
6. Rebuild/install the native apps after configuration changes. Sign in, opt in and send the in-app test. Verify foreground/background/terminated delivery, notification taps, token refresh, disable and sign-out on physical iOS and Android devices.

No Firebase app files, APNs credentials or FCM service-account secret were supplied for this migration. Push delivery has not been verified. Store icons/artwork, signing, physical-device tests and store submission remain release tasks.

## Backend and device lifecycle

The migration `20261016083103_mobile_push_devices.sql` is already applied to `srwzgwodlpylezdaipce`. Do not reapply it there. The following Edge Functions are deployed:

| Function | Caller | Behavior |
| --- | --- | --- |
| `register-device` | Signed-in user JWT | Register/refresh this installation or disconnect its current owner |
| `send-push` | Signed-in user JWT | Send a generic test only to the caller's registered installation |
| `dispatch-reminders` | Scheduler with server-only `x-reminder-secret` | Send generic due/overdue payment reminders at the saved Bahrain reminder hour |

Registration derives the owner from a validated Supabase user, never a submitted `userId`. The device table's RLS permits only own-device reads/deletes; direct client inserts/updates are revoked. Registration limits each user to ten devices. A stable installation ID and rotating FCM token are retained for the current owner. Explicit disable/sign-out disconnects the registration and/or deletes the provider token; failure of both operations leaves notifications enabled and asks the user to retry. No token values appear in the UI.

Reminders include no balances, amounts, merchant names or account details. Taps navigate only to known app pages and still pass the normal authenticated route gate. Devices inactive for thirty days are skipped. Unregistered provider tokens are deleted after a delivery attempt.

The service-only delivery table and claim function prevent concurrent duplicate claims. Failed deliveries can retry, and expired claims can recover after five minutes. Successful reminders are keyed by user, installation and Bahrain date. As with external message systems, a provider acknowledgement lost during a failure can still produce a duplicate on retry. Test notifications target only the requested owned installation and are limited to one successful send per minute.

## Enable the reminder schedule after credentials work

No reminder job is scheduled yet. After a successful device test, save the same `PUSH_CRON_SECRET` in Supabase Vault under `financial_advisor_push_cron_secret`. Enable `pg_cron`, `pg_net` and Vault in the project, then run [setup-reminders.sql](../supabase/setup-reminders.sql) in the private SQL editor. The script verifies that the Vault entry exists without displaying its contents. Do not commit the secret or paste it into chat.

The job invokes the dispatcher hourly. The saved reminder hour defaults to 09:00 Bahrain time. Payment reminders include active expense/transfer schedules and outstanding debts due on or before today. Salary reminders and educational check-ins are optional. Weekly cadence sends on Sunday. Paused schedules and repaid debts are excluded. A paid occurrence advances its existing schedule and therefore stops being due. Repeated hourly invocations deduplicate successful sends for that day. Disable the job with `select cron.unschedule('financial-advisor-payment-reminders');`.

## Verification boundary

The React migration is checked with shared financial-rule/entry-command tests, native callback and consent tests, secure-storage failure recovery, browser demo workflows and a mocked Google PKCE → verified workspace → save → reload → sign-out workflow. Expo dependency compatibility, Android/iOS clean prebuild, web production build and Android/iOS Hermes exports are also checked.

A Hermes export validates native JavaScript resolution and compilation; it is not an installed binary test. This Linux session does not establish an iOS/Xcode build, real-device authentication, native push delivery or store publication. The earlier Capacitor APK belongs to the previous framework and is not a React Native release artifact.


## v1.5 native verification

`modules/financial-advisor-native` is a local Expo module discovered during autolinking. Android uses bundled ML Kit text recognition and a RemoteViews Quick Entry widget. iOS uses Apple Vision. Rebuild a development/release client after this update; Expo Go cannot provide the custom module or Firebase messaging. Web deploys do not update installed native binaries.

Test on Android and iOS: fresh launch/unlock with biometric and device passcode, no enrolled lock, cancelled authentication/retry, background privacy cover, return before/after one minute, camera/photo permissions, denied permission recovery, local receipt OCR, document/photo sharing and secure preference migration. Screenshot protection varies by OS; verify Android FLAG_SECURE/capture behavior and iOS recording/app-switcher behavior on supported devices. Do not claim universal iOS screenshot blocking.

On Android additionally: enable widget consent, pin through a supported launcher (or add from the launcher widget list), tap income/expense/template buttons with the app cold/warm, review drafts before saving, change accounts and sign out, remove a template, disable widgets and confirm names disappear. Widgets never show amounts/balances. An old-owner widget must not open a different account's template. iOS widgets are not included.

Use the SDK manager's `platforms;android-37.0` package (not the obsolete `platforms;android-37` identifier), Build Tools 37.0.0 and the NDK selected by Expo. A Mac/Xcode is required to compile and install iOS. Hermes export and prebuild are configuration/bundle checks, not a replacement for these binary/device checks. Never reuse the old ignored Capacitor APK as the current React Native build.


## Remote macOS alternative

The repository now includes MobAI ios-builder configuration and a manually triggered GitHub Actions iOS build workflow. It generates the managed Expo project on macOS and defaults to an unsigned Release IPA. See [IOS-BUILDER.md](IOS-BUILDER.md) for invocation, public app variables, optional Firebase configuration and the separate Apple signing/device release requirements.
