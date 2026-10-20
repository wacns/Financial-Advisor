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
