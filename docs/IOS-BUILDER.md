# Remote iOS builds with MobAI ios-builder

[MobAI-App/ios-builder](https://github.com/MobAI-App/ios-builder) supports our managed Expo/React Native app. It builds on a remote macOS/Xcode runner; it does not compile Apple's SDK on Linux. Our local Swift OCR module, Expo privacy modules and Firebase native packages are included through normal Expo prebuild/CocoaPods autolinking.

## Prepared configuration

- `builder.json`: FinancialAdvisor, scheme `FinancialAdvisor`, bundle ID `com.wacns.financialadvisor`, generated native path `ios/`.
- Default profile `unsigned`: **Release** configuration, with embedded JavaScript and no signing credentials. Debug builds expect Metro.
- `development` and `store`: signing profile definitions for later setup. Store builds select production APNs entitlements through `APP_PUSH_ENVIRONMENT=production`.
- `.github/workflows/ios-build.yml`: upstream v0.11.0 template (commit `b5ffa961d3577acc790dbe5bbf5651bcf25c0df5`) with pinned action revisions, this app's defaults, read-only build access, credential-free dependency installation, separate tag cleanup permissions and optional Firebase client configuration restoration. Upstream MIT license is retained in `licenses/IOS-BUILDER-MIT.txt`.

The workflow runs manually or through Builder's `ios-build/*` tags. It does not run a macOS build for every web push. GitHub macOS runner usage consumes the private repository's Actions allowance/billing; check the account's current allowance. No simulator-sharing service, MobAI API key or Apple credentials are needed for the unsigned build.

## Run without installing Builder

In [GitHub Actions](https://github.com/wacns/Financial-Advisor/actions/workflows/ios-build.yml), choose **Run workflow** on `main`. Supply a unique build ID, keep `ios_path=ios`, choose `FinancialAdvisor` (or allow detection), `configuration=Release`, and `use_signing=false`. After success, download artifact **ipa** and extract the IPA. An unsigned IPA is a device-target build artifact; it cannot be installed directly on a stock iPhone or uploaded to TestFlight until correctly signed.

CLI equivalent using an already authorized GitHub CLI:

```sh
gh workflow run ios-build.yml --repo wacns/Financial-Advisor --ref main \
  -f build_id=ios-check-001 -f ios_path=ios -f scheme=FinancialAdvisor \
  -f configuration=Release -F use_signing=false
```

## Run with Builder

Install [Builder v0.11.0](https://github.com/MobAI-App/ios-builder/releases/tag/v0.11.0) using its release instructions; authenticate on your own machine:

```sh
builder auth github
builder ios build --profile unsigned --unsigned
```

Builder snapshots the current working tree, including uncommitted/untracked files but excluding gitignored files, pushes a temporary ref, dispatches this workflow and downloads the IPA to `dist/`. Review the working tree first. `builder init` is unnecessary for this repository and would overwrite the workflow adaptations; review changes before updating the upstream template.

Generated `ios/`, local `.env` files, signing keys and `GoogleService-Info.plist` are ignored and are not included in a snapshot. The macOS runner regenerates `ios/` from `app.config.js` before installing CocoaPods.

## App configuration on GitHub

For cloud sign-in in the installed app, set these **Actions repository variables** to the existing Supabase project's public client values:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

These are public client settings embedded in the app, not service-role credentials. Without them, an unsigned build can still compile and run demo mode, but live cloud sign-in is unavailable. Never add a service-role key or Apple/Firebase server credential to `builder.json` profile `env`, repository variables or app source.

For Firebase iOS push integration, configure Actions secret `GOOGLE_SERVICE_INFO_PLIST_BASE64` with your Firebase **iOS app configuration plist**, base64 encoded. The workflow validates and restores it on the ephemeral runner before Expo prebuild. This does not set up APNs, the Firebase server service account, notification permission or signing entitlements; follow [MOBILE.md](MOBILE.md).

## Signing and TestFlight

The unsigned compile is the first verification step. Before adding signing secrets, protect the branch and configure a reviewed/approved signing workflow/environment. GitHub Actions access and workflow-writing permission are distinct from ordinary repository read/write access. Add signing credentials directly in GitHub/your signing provider; never paste private keys or passwords into chat.

For a correctly authorized Apple Developer account, Builder can provision development or Store signing sets. For example, on your machine after `builder auth apple`:

```sh
builder signing setup --distribution store
builder ios build --profile store
```

This creates Apple account resources and uploads signing material into the configured provider; run it only when you intend those changes. Store signing uses the matching certificate/password/profile secrets `IOS_CERTIFICATE_STORE`, `IOS_CERTIFICATE_PASSWORD_STORE` and `IOS_PROVISIONING_PROFILE_STORE`. A development/ad-hoc build must include the target device in its provisioning profile. Free-account re-signing can have entitlement restrictions and does not establish production push readiness.

A signed IPA and a successful compile do not complete App Store release. App Store Connect metadata, TestFlight/App Review, Firebase/APNs configuration, real-device auth/notification taps and iOS OCR/privacy checks remain separate release tasks. We do not automatically upload, submit, invite testers or publish builds.

## Validation

The workflow passes actionlint v1.7.12 and its Builder defaults match the Expo bundle ID and generated scheme. Earlier Hermes exports and native prebuild do not establish that the iOS Swift/CocoaPods/Xcode build succeeds; the first remote run supplies that evidence. See the GitHub run result before calling the IPA built.
