# TypeScript conversion — device checklist

The `typescript-conversion` branch passes every automated check. Those checks
can't show how the app behaves on a real phone or an installed desktop app, so
the branch merges only after the owner works through this list and signs it off.
Behavior should match v1.7.1 exactly. Anything different is a conversion bug,
except the lock cover noted under Android.

## Automated results on the branch

| Check | Result |
|---|---|
| `npm run lint` (typecheck of all five tsconfigs, then ESLint) | pass, 0 tsc errors |
| `npm test` | 117/118. The 1 failure is the pre-existing Windows-only Xcode path test |
| `npm run test:e2e` | 32/32 |
| `npm run test:oauth` | 1/2, the same pre-existing mock gap as before the conversion |
| `npm run build`, `npm run build:native` | pass. Outputs match `.baseline/` within 0.5% |
| `npm run desktop:prepare && npm run test:desktop` | pass |
| `deno check` on the four Supabase functions | pass |

The iOS native project could not be generated on Windows, so the config plugin's
iOS changes have only been type-checked. Check the iOS build closely.

## Automated emulator run

The **Device checks** workflow (`.github/workflows/device-checks.yml`) runs on pull requests
to `main`, Dependabot's included, and on pushes to `main`, when they change app, native or
test files. Each checklist flow runs in its own parallel job (`tests/device/flows`, Maestro),
in demo mode:

- **Android emulator (API 34), every run:** builds a release APK and runs every flow. Any
  flow that fails is then run on the released v1.7.1 APK too, which tells a regression
  (fails only on the branch) from a problem with the flow (fails on both).
- **iOS simulator, opt-in (an `ios` label or `[ios]` in a pull request's title, or `[ios]`
  in a pushed commit message):** builds the release app
  and runs the flows that don't need the Android PIN. This also covers the iOS project
  generation that Windows can't do, and the Xcode path test that fails only on Windows. A
  macOS minute is billed as 10 Linux minutes, so iOS is opt-in.
- **Results:** a pass/fail table per platform in the run summary. Logs and screen hierarchies
  upload as `device-results-*` artifacts only when something fails, and are kept 3 days.
  The app blocks screen capture, so screenshots are black and are not uploaded; the flows
  check on-screen text instead.

An emulator can't check these, so they still need a real phone, or the owner's decision
that the emulator results are enough:

- Google sign-in with a real account (the run uses demo mode).
- Push notifications. The test notification needs a signed-in account and a real device token.
- Real biometric unlock. The Android run unlocks with an emulator PIN, and the iOS run with a simulated Face ID match.

## Mobile updates after merge

Over-the-air mobile updates need new binaries after this branch. The app uses Expo's
`fingerprint` runtime policy, and the conversion changes the fingerprint inputs: the
config plugin file (`.cjs` → `.ts`), the resolved Expo config, the `package.json`
scripts and `.gitignore`. Comparing `npx fingerprint fingerprint:generate` before and
after gives a different hash on Android and iOS. An update published from the merged
code reaches only binaries built from it. Installed v1.7.1 apps keep running but stop
receiving updates until users install the new APK/IPA. Plan the first release after
the merge as a full binary release, not a `Publish mobile update` run.

## Builds

Check out the branch first: `git checkout typescript-conversion`, then `npm ci` and
`npm ci --prefix desktop`.

- **Android:** `npm run native:android` (local build to a connected device), or
  `eas build --profile development --platform android`, then `npm start`.
- **iOS (on a Mac):** `npm run native:ios`, or
  `eas build --profile development --platform ios`, then `npm start`. Releases
  are paused for the conversion, and the GitHub iOS build runs only as part of a
  release workflow, so build on a Mac or through EAS.
- **Desktop installer:** `npm run desktop:build` writes the installer to
  `release-desktop/`. Install it over an existing v1.7.1 installation.

## Steps on each device

Do these on Android, on iOS and on the desktop app, and tick each one.

| Step | Android | iOS | Desktop |
|---|---|---|---|
| App opens to the welcome or login screen with no error | [ ] | [ ] | [ ] |
| Sign in with Google; the browser returns to the app and the workspace loads | [ ] | [ ] | [ ] |
| The existing workspace shows the same accounts, balances and transactions as on v1.7.1 | [ ] | [ ] | [ ] |
| Add an expense; the balance changes by the exact amount, and it is still there after restarting the app | [ ] | [ ] | [ ] |
| Edit that expense, then delete it; the balance returns to where it was | [ ] | [ ] | [ ] |
| Scan a receipt (or choose an image); a review draft opens and nothing saves until you confirm | [ ] | [ ] | [ ] |
| Close and reopen the app; you stay signed in (phones keep the session in Keychain or Keystore) | [ ] | [ ] | [ ] |
| Sign out; the login screen returns | [ ] | [ ] | [ ] |
| Phones only: turn on payment reminders and allow notifications, then **Send test notification**; it arrives, and tapping it opens the app | [ ] | [ ] | n/a |
| Phones only: with device lock on, background the app and return; the lock appears and unlocking works | [ ] | [ ] | n/a |
| Desktop only: Settings → App updates → **Check for updates** shows the version and no error | n/a | n/a | [ ] |

For the lock step: the lock cover doesn't fill the whole screen. This was already
true on v1.7.1 and is listed in `typescript-findings.md`. App content is still
hidden. Only report it if it looks different from v1.7.1.

## Sign-off

- [ ] All steps above match v1.7.1 on every device tested.

Devices and OS versions tested: ______________________

Signed off by the owner: ______________________  Date: __________
