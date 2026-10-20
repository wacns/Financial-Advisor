# Installers and updates

All current installers are collected in the [unified public v1.7.1 release](https://github.com/wacns/financial-advisor-releases/releases/tag/v1.7.1): Android APK/AAB, unsigned iOS IPA, Windows EXE, macOS DMG/ZIP and Linux AppImage/DEB. Every platform is built as version 1.7.1 from source commit `3fe90232c8c52006dbdcb49af9771c9956d02589` by [release run 39396412697](https://github.com/wacns/Financial-Advisor/actions/runs/39396412697). The application source remains private, while public notes include verified per-commit/PR entries and the real private-source comparison.

All build and publication jobs passed. The public release has 20 assets; all 18 entries across its desktop/mobile checksum lists match GitHub upload digests, and every installer/blockmap matches its private original. Notes contain two verified commit entries for `v1.7.0...v1.7.1`. All three desktop feed documents report 1.7.1. Anonymous download checks returned HTTP 200 for all eight installer formats. This verifies publication and metadata, with physical-device installation and update delivery still pending.

Install the new mobile binaries for 1.7.1's assistant choices. Native speech and iOS Shortcuts also require a 1.7.x binary; an Expo update cannot add their native code or permissions to 1.6.0. The public desktop feed serves 1.7.1. Windows NSIS and Linux AppImage installations already connected to the feed can detect the update; desktop 1.6.0 requires a manual installer to establish the public feed. macOS updates remain manual until signing is configured. Preview signing and physical-device verification requirements still apply.

Release display names use their version tag, such as **v1.7.1**. The same rule applies to private/public publishers and notes-only updates. Signing information and prerelease status remain explicit in the release metadata, notes and filenames.

The previous [v1.7.0 release](https://github.com/wacns/financial-advisor-releases/releases/tag/v1.7.0) was built at `cb4e94e` by [run 39390877558](https://github.com/wacns/Financial-Advisor/actions/runs/39390877558), with 20 public assets and 18 verified checksums. Its build and publication evidence is retained in [TESTING.md](TESTING.md).

The preceding [unified v1.6.1 release](https://github.com/wacns/financial-advisor-releases/releases/tag/v1.6.1) contains desktop 1.6.1 and mobile 1.6.0, with their original filenames and embedded versions. The redundant public v1.6.0 release was retired after checksum verification; its private originals remain available for recovery. Desktop [run 39219635722](https://github.com/wacns/Financial-Advisor/actions/runs/39219635722) and its checksum evidence are recorded in [TESTING.md](TESTING.md).

The [v1.6.0 preview](https://github.com/wacns/Financial-Advisor/releases/tag/v1.6.0) was published on 2026-10-19 after [all release jobs passed](https://github.com/wacns/Financial-Advisor/actions/runs/39210604546) at commit `f9c4edb`. It contains all formats below, update metadata/blockmaps and `SHA256SUMS.txt`. All 18 checksummed release files match GitHub's uploaded SHA-256 digests. These are preview builds with the signing and update-service requirements described below.

The shared React application has native Expo/React Native mobile builds and an Electron desktop application that bundles the React Native Web/Vite output. Desktop does not load the hosted website: its UI, demo data and browser OCR assets are packaged locally. Cloud sign-in and workspace sync still need the existing backend and network. Native biometric privacy, FCM push and Android widgets remain mobile features; they are not desktop integrations.

## Download formats

| Platform | Files | Architectures | Current signing |
| --- | --- | --- | --- |
| Android | APK (install), AAB (Play upload) | Universal APK, including ARM64 | Expo testing key unless release signing secrets exist |
| iOS / iPadOS | IPA | ARM64 device | Unsigned; signing required before install |
| Windows | NSIS EXE installer | x64 | No Authenticode certificate configured |
| macOS | DMG and ZIP | ARM64 / Apple Silicon and x64 / Intel | No Developer ID / notarization configured |
| Linux | AppImage and DEB | x64 | No package repository signature configured |
| Web | Existing hosted app | Modern browsers | HTTPS deployment |

Windows ARM64 and Linux ARM64 installers are not in this initial matrix. Windows x64 compatibility on ARM is determined by Windows emulation; it is not an ARM64-native build. Linux AppImage may require FUSE support and executable permission. macOS Gatekeeper and Windows SmartScreen may block or warn about unsigned preview installers. Do not claim a preview has been store approved.

## Build and publish

Before publishing, write `docs/releases/X.Y.Z.md` with a `## What's Changed` section and the concrete changes for that version. Include real build versions, upgrade instructions and known limitations. Missing release notes fail early verification. GitHub generates verified per-PR/per-commit entries from the source comparison, while authored notes supply highlights, download versions and limitations. Publishing updates the release description, public `CHANGELOG.md`, `release-notes/X.Y.Z.md` and a metadata-only `release-history/X.Y.Z.json`. **Full Changelog** opens the real private source comparison; commit/PR/code links require repository access, and **Public release history** opens the public Markdown history. Application source stays private. For a notes-only correction, edit that version's Markdown and run **Update release notes**. This workflow does not rebuild binaries or change the update feed. See [release notes authoring](RELEASE-NOTES.md).

Run **Application releases** in GitHub Actions on `main`, or push a `vX.Y.Z` tag matching the versions in `package.json`, `desktop/package.json` and `app.config.ts`. Lint/unit checks run first; Android, iOS and desktop jobs build independently. Only after every platform succeeds does the workflow create a private-repository GitHub **prerelease**, attach installers/update metadata and `SHA256SUMS.txt`, then remove its draft flag. It then publishes desktop and mobile installers to the public downloads repository using `RELEASES_TOKEN`, retaining the private originals. It refuses to overwrite an already published version; increment all versions and mobile build numbers for the next release.

The iOS job reuses our MobAI workflow and currently builds unsigned Release. AABs/APKs with `preview` in the filename use the Expo template's public testing key. Keep them separate from a production signing identity; changing the Android signing key normally requires uninstalling the previous app, which removes local-only data. Back up demo data before that transition. Existing signed-in data remains in the backend.

Secrets are optional for preview compilation. Set these directly in GitHub Actions before production distribution:

- Android: `ANDROID_KEYSTORE_BASE64`, `ANDROID_RELEASE_STORE_PASSWORD`, `ANDROID_RELEASE_KEY_ALIAS`, `ANDROID_RELEASE_KEY_PASSWORD`. Keep and back up the same release key across updates; never rotate it casually. The Expo plugin configures Gradle signing from environment variables without embedding credentials in source.
- Firebase client files: `GOOGLE_SERVICES_JSON_BASE64` and `GOOGLE_SERVICE_INFO_PLIST_BASE64`. They must match the package/bundle ID.
- Optional public client overrides: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The desktop jobs map these to Vite's corresponding public configuration. `src/public-client.json` supplies the existing project's URL and enabled publishable client key by default so missing Actions variable permissions do not produce demo-only installers. This file contains no service-role/server credential; row-level security and signed-in ownership still protect financial records.
- Apple signing still requires the separate setup in [IOS-BUILDER.md](IOS-BUILDER.md). This release matrix deliberately does not attempt to sign or submit the IPA. Paid membership is not available yet.

Public installers in [financial-advisor-releases](https://github.com/wacns/financial-advisor-releases/releases) download without signing in. The original private-repository downloads still require GitHub access. No repository token is shipped in the app. Runner minutes/storage consume the repository's Actions allowance; preview artifacts retain seven days, while successfully published Release assets persist until deleted.

## Mobile automatic updates

Use **Check update connections** in GitHub Actions to verify that `EXPO_TOKEN` can read the configured Expo project and that any configured desktop feed serves update metadata. Select the same `preview`/`production` environment as publishing. The check never prints token values or publishes an update; project-read access alone does not establish permission to publish or successful device delivery.

`expo-updates` is installed and linked in app config to [`@financial-advisor/financial-advisor`](https://expo.dev/accounts/financial-advisor/projects/financial-advisor), project UUID `f6d80f34-ee40-4075-9cca-4216d9c94d7d`. **Actions secret `EXPO_TOKEN`** must be set directly in GitHub to an Expo token with permission for that project. Optional Actions variable `EAS_PROJECT_ID` can override the configured UUID for a deliberate project migration; keep the account/slug aligned too. Configure the same public client values in Expo's `preview` and `production` environments. An account/project link alone does not publish an update or authorize CI.

The v1.6.0 binaries are already connected. A preview update was successfully published for both platforms in [run 39218236828](https://github.com/wacns/Financial-Advisor/actions/runs/39218236828); its runtime fingerprints match the released APK and IPA. Actual device delivery still requires testing Settings → App updates on an installed binary. The configuration uses Expo's `fingerprint` runtime policy, the preview channel for GitHub preview builds, and `preview`/`production` channels for matching EAS profiles. A compatible update downloads on launch and applies on the next launch. Settings can check immediately, download, and let you choose **Restart and install update** after saving your work. Failed checks leave the running app usable.

Use the separate **Publish mobile update** workflow, choose the installed build's channel and enter a change description. It runs checks and `eas update` using the matching Expo environment; it does not silently publish every commit to all users. Configure reviewers/branch protections on the `mobile-preview` / `mobile-production` GitHub environments as appropriate for your team. Check runtime fingerprints and test a preview update before promoting a production update. Changes to native modules, Expo/RN versions, permissions or platform configuration require new APK/IPA binaries; they cannot be delivered as a JavaScript update. Expo's update service does not replace App Store/Play distribution or Apple's signing requirements.

## Desktop automatic updates

Electron's `electron-updater` is connected for NSIS on Windows and AppImage on Linux; macOS automatic updates additionally require a signed application. DEB installs are updated through a package manager/manual installer. The desktop updater downloads in the background, checks every six hours, and installs only after choosing **Restart and install update** in Settings. It does not force a restart or install on quit.

Desktop v1.6.1 and later default to the public feed in [financial-advisor-releases](https://github.com/wacns/financial-advisor-releases). Source stays private. The feed URL is committed in `desktop/update-feed.json`; optional Actions variable `DESKTOP_UPDATE_URL` overrides it for a deliberate hosting change. Install v1.6.1 manually once to connect a v1.6.0 desktop installation to this feed.

Run **Desktop releases** for desktop-only changes. Its version comes from `desktop/package.json` and may advance independently of the mobile version. The reusable platform build also serves **Application releases**; a combined release still requires all app versions to match. The desktop workflow publishes desktop installers, blockmaps and update metadata, then attaches the existing mobile release matching the root package version to the same public tag. **Application releases** also publishes APK/AAB and unsigned IPA files under the same public version tag, after the desktop publication completes. Mobile files have a separate `MOBILE-SHA256SUMS.txt`, preserving desktop checksums and the desktop update feed. **Publish public mobile installers** can also mirror an existing private release by version without rebuilding it. Its separate `release_version` input chooses the public destination; when blank, it uses the current desktop package version. The source mobile version still determines filenames and checksum validation. It verifies each mobile file against the private release checksums and the public uploaded digest, and refuses to overwrite different binaries.

Save a fine-grained GitHub token as **Actions secret `RELEASES_TOKEN`** in the private source repository, scoped only to `wacns/financial-advisor-releases` with **Contents: Read and write**. The built-in workflow token cannot publish across repositories. No GitHub credential is included in installed apps. The public publishing step refuses unexpected assets and modified published versions, checks SHA-512 installer hashes, and publishes platform metadata atomically after the release assets are available. Feed metadata uses absolute URLs so preview prereleases work without GitHub's `latest` release alias.

Development runs and builds without a feed keep automatic checks disabled. The preview workflow does not inject Windows signing certificates or macOS Developer ID/notarization secrets and leaves macOS automatic updates disabled. Configure signing before production distribution; setting a feed URL does not sign an installer. Build-time `DESKTOP_MAC_SIGNED=true` is reserved for a separately configured, verified signed/notarized build, not a switch to bypass signing.

## Local desktop development

```sh
npm ci
npm ci --prefix desktop
npm run desktop:start
npm run desktop:build -- --linux --x64
```

Build Windows installers on Windows and macOS installers on macOS through the matrix. The renderer has Node disabled, context isolation and sandboxing enabled. A narrow preload exposes only validated browser sign-in and update actions. Sign-in uses the existing exact `com.wacns.financialadvisor://auth/callback` PKCE callback in the system browser; ensure this redirect is allowed in Supabase. No embedded Google login or arbitrary shell/file API is exposed. Desktop browser storage is separate from the website and mobile installations, so sign in again when installing the desktop app.

Run `npm run desktop:prepare` then `xvfb-run --auto-servernum npm run test:desktop` for a Linux smoke test. The test uses an isolated temporary user-data directory and never edits a real workspace. `--no-sandbox` is used only by that constrained test launcher; packaged app configuration retains its renderer sandbox. Production installers need actual OS install/upgrade/uninstall testing, device auth/notification/OCR tests, and update-feed delivery tests before release readiness is claimed.
