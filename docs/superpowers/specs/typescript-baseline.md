# TypeScript conversion — baseline

This records the results at v1.7.1 (commit `59406c1`, before any conversion),
on Windows 11 with Node v26.12.0 (`.nvmrc` asks for 24; CI uses 24) after a
clean `npm ci` and `npm ci --prefix desktop`.

| Command | Result |
|---|---|
| `npm run lint` | pass (exit 0) |
| `npm test` | 97/98 pass, 1 fail (pre-existing, see below) |
| `npm run test:e2e` | 32/32 pass (after `npx playwright install chromium`) |
| `npm run build` | pass, with a warning that a chunk is larger than 500 kB |
| `npm run build:native` | pass, exported `dist-native` |
| `npm run desktop:prepare` | pass |
| `npm run test:desktop` | pass. The first run timed out while Electron downloaded its binary on first launch; the retry passed |

## Pre-existing failures

- `tests/unit/ios-inputs.test.js` › "Xcode source paths use group paths rather
  than their display names". On Windows the paths it builds use `\`, but the
  test expects `/`. This is a platform issue in the test or script, unrelated to
  the conversion, and it passes on Linux CI. It must not get worse.

## Output snapshots (in `.baseline/`, gitignored)

- `dist/`, `dist-native/`: web and native build outputs
- `expo-config.json`: `npx expo config --type prebuild --json`
- `desktop-files.txt`: sorted file list of the packaged `app.asar` from
  `electron-builder --dir`. Hashed web asset names are expected to differ
  afterwards.
