# TypeScript Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every JavaScript file in the repository to strict TypeScript without changing how the app behaves on web, mobile or desktop.

**Architecture:**
- Files are converted in dependency order: shared types and the domain first,
  then application logic, platform, UI, Supabase functions, desktop, scripts,
  tests, and a final lockdown.
- During the migration, `.js` and `.ts` coexist (`allowJs`). Each task renames a
  group with `git mv`, types it, and updates every importer's specifier.
- Four tsconfig projects check the code:
  - web, which resolves `.web` variants
  - native, which resolves `.native` variants
  - node, for tests, scripts, configs and Supabase modules that Node imports
  - desktop, which emits the CommonJS that Electron loads

**Tech Stack:**
- TypeScript (latest stable, at least 5.8, for `erasableSyntaxOnly`) and
  typescript-eslint
- Node 24 type stripping for tests and scripts
- Vite 8, Expo 58 / Metro, Electron 44 + electron-builder, Deno for Supabase
  functions, Playwright

**Spec:** `docs/superpowers/specs/2026-10-20-typescript-conversion-design.md`

## Global Constraints

- `strict: true` and `noUncheckedIndexedAccess: true` everywhere, along with `erasableSyntaxOnly: true` and `verbatimModuleSyntax: true`.
- Node runs `.ts` directly, so:
  - no `enum`, `namespace` or parameter properties
  - type-only imports use `import type`
  - no `.tsx` may be imported by anything Node runs
- Relative imports name the real file, with a `.ts` or `.tsx` extension. The one exception is platform-variant imports (`./Field`, `../platform/runtime`, `files`, `PrivacyGate`, `safe-area`, `speech`, `updates`), which stay extensionless.
- No `any`, `as` casts (except `as const`), `!` non-null assertions, `@ts-ignore` or `@ts-expect-error`. The only exception is a line carrying `// eslint-disable-next-line <rule> -- TS-ESCAPE: <reason>`.
- Missing-value guards follow this rule:
  - Where today's code would crash on the missing value, call `must(value, what)`, which throws `Error`.
  - Where today's code tolerates it, keep exactly that outcome (for example with `?.` or `?? default`).
  - Never change the result on a path that works today.
- Behavior must not change. If a real bug turns up, keep the current behavior and add an entry to `docs/superpowers/specs/typescript-findings.md` (file, line, what goes wrong).
- No test may be skipped, loosened or deleted.
- The only new dependencies allowed: `typescript`, `typescript-eslint`, `@types/react`, `@types/react-dom`, `@types/react-native-web`, `@types/node` (and `jiti` only if ESLint can't load a `.ts` config without it). Pin exact versions, as `package.json` already does.
- Do not deploy Supabase functions, and do not publish any release.
- Commit only the paths each task names. Never stage `.idea/`. Every commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01J4nv77CkEmh1dqVs95X431
  ```
- All work happens on branch `typescript-conversion`.

**The gate** (run at the end of every task from Task 2 on; it must match the baseline):
- `npm run lint`, which runs typecheck + eslint after Task 2
- `npm test`
- `npm run build`

Tasks that touch UI, platform or config also run `npm run test:e2e`.

## Review Focus

1. **Old or partial workspace blobs.** These come from Supabase, local storage or
   backups: missing collections, a missing `settings`, `cycleBudgets` without
   `children`/`day`, projects without `contracts`. They must normalize exactly as
   today, and a non-BHD workspace must throw the same message. Pinned in Task 3.
2. **Money rounding (fils).** `toFils`/`amount`/`convert` must give the same
   results for awkward inputs: `"0.0005"`, `"1e3"`, `" 2.5 "`, `""`, `null`,
   `true`, negative numbers and very large values. Pinned in Task 3.
3. **Lookups of things that don't exist.** For example, an entry pointing at a
   deleted account or a transfer to a missing account. Today's outcome must be
   preserved, except that a `TypeError` crash becomes a clear `Error`. Pinned in
   Task 4.
4. **Malformed import files** (bad CSV rows, a JSON backup with missing fields).
   The same error messages must appear and nothing may be partially applied.
   Pinned in Task 4.
5. **The wrong platform variant ending up in a bundle.** Native-only code (for
   example `expo-secure-store` or `expo-local-authentication`) must not reach the
   web `dist/`, and the web variants must still be the ones used. Pinned in
   Task 7.

---

### Task 1: Baseline

**Files:**
- Create: `docs/superpowers/specs/typescript-baseline.md`
- Create: `docs/superpowers/specs/typescript-findings.md`
- Modify: `.gitignore` (add `/.baseline/`)

- [ ] **Step 1: Install dependencies.** Run `npm ci` and `npm ci --prefix desktop`. Expected: both exit 0.
- [ ] **Step 2: Run every gate on untouched v1.7.1 code.** Record each command's exit code and pass/fail counts in `typescript-baseline.md`:
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`
  - `npm run build:native`
  - `npm run desktop:prepare && npm run test:desktop`

  Any failures that already exist are listed as "pre-existing" and must not get worse.
- [ ] **Step 3: Snapshot the outputs into `.baseline/`** (gitignored):
  - `dist/` copied to `.baseline/dist/`
  - `dist-native/` copied to `.baseline/dist-native/`
  - `npx expo config --type prebuild --json > .baseline/expo-config.json`
  - `npx electron-builder --config electron-builder.config.cjs --dir --publish never`, with the sorted file list of the unpacked app saved to `.baseline/desktop-files.txt`
- [ ] **Step 4: Create `typescript-findings.md`** with a heading and an empty table: `| File:line | What goes wrong | Found in task |`.
- [ ] **Step 5: Commit** the two docs and `.gitignore`: `git commit -m "Record TypeScript conversion baseline"`.

### Task 2: Toolchain, tsconfigs and lint

**Files:**
- Create: `tsconfig.base.json`, `tsconfig.web.json`, `tsconfig.native.json`, `tsconfig.node.json`, `tsconfig.json`
- Create: `src/guards.ts`
- Modify: `package.json`, `package-lock.json`, `vite.config.js`, `eslint.config.js`
- Test: `tests/unit/guards.test.ts`

**Interfaces:**
- Produces: `must<T>(value: T | null | undefined, what: string): T` in `src/guards.ts`. It throws `Error(\`Missing ${what}.\`)` when the value is `null` or `undefined`, and otherwise returns the value.
- Produces: `npm run typecheck`. `npm run lint` becomes `npm run typecheck && eslint .`.

- [ ] **Step 1: Install the allowed dev dependencies** at exact versions.
- [ ] **Step 2: Write the tsconfigs.**
  - **`tsconfig.base.json`:**
    - the Global Constraints flags
    - `allowJs: true`, `checkJs: false` (temporary; removed in Task 14)
    - `noEmit`, `allowImportingTsExtensions`, `resolveJsonModule`
    - `moduleResolution: "bundler"`, `module: "esnext"`, `target: "es2022"`
    - `jsx: "react-jsx"`, `skipLibCheck: true`
  - **`tsconfig.web.json`:** includes `src`; `moduleSuffixes: [".web", ""]`; `lib: ["es2023", "dom", "dom.iterable"]`; `types: []`; `vite.config.*` alias `react-native` → `react-native-web` mirrored with `paths`.
  - **`tsconfig.native.json`:** includes `src`; `moduleSuffixes: [".native", ""]`; React Native's own types.
  - **`tsconfig.node.json`:** includes `tests`, `scripts`, root `*.config.*`, `native-entry.*`, `plugins`, and `supabase/functions/_shared/push.*` plus `supabase/functions/financial-assistant/{handler,funding}.*`; `module`/`moduleResolution: "nodenext"`; `types: ["node"]`.
  - **`tsconfig.json`:** extends the web config, so WebStorm has a default.
  - **`typecheck` script:** `tsc -p tsconfig.web.json && tsc -p tsconfig.native.json && tsc -p tsconfig.node.json`. The desktop project is added in Task 11.
- [ ] **Step 3: Update `vite.config.js`'s `resolve.extensions`** to `[".web.ts", ".web.tsx", ".web.js", ".web.jsx", ".ts", ".tsx", ".js", ".jsx", ".json"]`.
- [ ] **Step 4: Update `eslint.config.js`:**
  - Use the typescript-eslint parser for `**/*.{ts,tsx,cts,mts}` and keep the existing JS block.
  - Widen `files` to the whole repo. Ignore `dist`, `dist-native`, `desktop/web`, `release-desktop`, `.baseline` and generated `desktop/*.cjs`.
  - Keep today's rules. For TS files, replace `no-undef` with what typescript-eslint recommends, since tsc covers it.
  - Add, as errors on TS files: `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-non-null-assertion`, `@typescript-eslint/ban-ts-comment`, and `@typescript-eslint/consistent-type-assertions` with `{ assertionStyle: "never" }`.
- [ ] **Step 5: Change `test`** to `node --test "tests/unit/**/*.test.{js,ts}"`.
- [ ] **Step 6: Write the failing test** `tests/unit/guards.test.ts`:
  ```ts
  test("must returns present values, including falsy ones", () => {
    assert.equal(must(0, "count"), 0);
    assert.equal(must("", "name"), "");
    assert.equal(must(false, "flag"), false);
  });
  test("must throws a clear Error for null and undefined", () => {
    assert.throws(() => must(undefined, "account"), { message: "Missing account." });
    assert.throws(() => must(null, "goal"), { message: "Missing goal." });
  });
  ```
  Run `node --test tests/unit/guards.test.ts`. Expected: FAIL, because the module isn't found.
- [ ] **Step 7: Implement `must` in `src/guards.ts`** and run the test again. Expected: PASS.
- [ ] **Step 8: Run the gate.**
  - Expected: `npm run lint` exits 0, though it may log lint hits in files that are newly covered.
  - Fix those hits only where the fix doesn't change behavior. Otherwise log them in findings and add a narrowly scoped `eslint-disable` that cites the findings entry.
  - `npm test` and `npm run build` should match the baseline.
- [ ] **Step 9: Commit:** `git commit -m "Add TypeScript toolchain, tsconfigs and must guard"`.

### Task 3: Shared types, locale and model

**Files:**
- Create: `src/domain/types.ts`
- Rename and convert: `src/locale.js` → `.ts`, `src/domain/enhancement-validation.js` → `.ts`, `src/domain/model.js` → `.ts`
- Modify: every importer of these three modules (update the specifiers)
- Test: `tests/unit/model-boundary.test.ts`, `tests/unit/money-rounding.test.ts`

**Interfaces:**
- **Produces, in `types.ts`** (one exported type per collection item, plus the
  aggregates). Fields are derived from `normalizeWorkspace`, `validateWorkspace`,
  `blankState`/`demoState` (`src/finance.js`) and `enhancement-validation`:
  - `CurrencyCode`, the union of the `currencyCodes` values
  - `Account`, `Transaction`, `Budget`, `Goal`, `Recurring`, `Debt`, `Project`,
    `Warranty`, `CycleBudget`, `Template`, `Payee`, `Tag`, `Subscription`,
    `Installment`
  - `Settings`
  - `Workspace`
- **Produces:** `normalizeWorkspace(input: unknown): Workspace`, with the same
  runtime steps and messages. The input is narrowed from `unknown`, and fields
  that are optional on stored data are optional in the type.
- **Produces:** `validateWorkspace(s: unknown)`, which narrows to `Workspace`
  (an assertion function: `asserts s is Workspace`, or the same return as today).
- **Produces:** `clone<T>(value: T): T`, `convert(s: Workspace, amount: number | string, from?: CurrencyCode, to?: CurrencyCode): number`, and `toFils(value: unknown): number`.

- [ ] **Step 1: Write the characterization tests** against the current JS, using its `.js` specifiers.
  - In `model-boundary.test.ts`, test that `normalizeWorkspace`:
    - fills all 14 collections with `[]`
    - sets `schemaVersion` to `2`
    - merges `settings` over the defaults and forces `rates.BHD = 1`
    - defaults `account.currency`/`goal.currency` to `"BHD"`
    - fills `cycleBudgets[].children`, `day` (from `from.slice(8)`), `include`, `exclude` and `categoryMode`
    - fills the project defaults
    - throws on `{ currency: "USD" }` with the exact current message
    - leaves its input unmutated

    Also test that `validateWorkspace(null)` throws "Invalid backup. Nothing was changed."
  - In `money-rounding.test.ts`, assert `toFils`, `amount` and `convert` outputs for each input in Review Focus 2. Write today's actual outputs into the assertions.
- [ ] **Step 2: Run the new tests.** Expected: PASS against the JS. This pins the current behavior.
- [ ] **Step 3: Write `src/domain/types.ts`.** Then `git mv` the three files to `.ts`, add types, and use `must` or tolerant handling per the guard rule. Update every importer in `src` and `tests` to use the `.ts` specifiers.
- [ ] **Step 4: Run the new tests plus the gate.** Expected: the same results as Step 2 and the baseline, and `tsc` reports 0 errors for these files.
- [ ] **Step 5: Commit:** `git commit -m "Convert locale and workspace model to TypeScript"`.

### Task 4: Domain modules

**Files:**
- Rename and convert in `src/domain/`: `ledger`, `accounts`, `organizing`, `commitments`, `cycles`, `projects`, `receipt`, `currency-tools`, `capture`, `reports`, `imports`, `assistant`, `commands`
- Modify: their importers
- Test: `tests/unit/domain-edges.test.ts`

**Interfaces:**
- Consumes: the Task 3 types and `must`.
- Produces: typed exports with unchanged names. Each module's own record types
  (command payloads, report rows, import rows, capture drafts) are exported from
  the module that owns them, not added to `types.ts`.

- [ ] **Step 1: Write characterization tests** in `domain-edges.test.ts`, against the JS.
  - **Missing references** (Review Focus 3): run the main commands in `commands` against an `accountId` or `toAccountId` that doesn't exist, plus a transaction referencing a deleted project. Record what each does today.
  - **Malformed imports** (Review Focus 4): call the `imports` entry points with a CSV that has a missing amount column, a bad date or an empty file, and with a backup JSON that lacks `transactions`. Assert the exact messages and that the input workspace is unchanged.
- [ ] **Step 2: Run the tests.** Expected: PASS against the JS.
- [ ] **Step 3: Convert the 13 modules in import order:** ledger → accounts → organizing → commitments → cycles → projects → receipt → currency-tools → capture → reports → imports → assistant → commands. Commit after each group of 3–4 if helpful.
- [ ] **Step 4: Update the Step 1 tests for crash cases.** Wherever Step 1 recorded a `TypeError`, change the assertion to the new `Error` message from `must`. That is the only edit allowed to those tests, and each one is listed in the commit message.
- [ ] **Step 5: Run the gate.** Expected: matches the baseline, and the domain has 0 tsc errors.
- [ ] **Step 6: Commit:** `git commit -m "Convert domain modules to TypeScript"`.

### Task 5: Top-level logic

**Files:**
- Rename and convert: `src/finance.js`, `src/planning.js`, `src/reports.js`, `src/notifications.js`, `src/auth.js` → `.ts`
- Modify: their importers

**Interfaces:**
- Produces: `blankState(): Workspace`, `demoState(): Workspace`, and the auth/notification exports typed with unchanged names. Supabase session values are typed from `@supabase/supabase-js`.

- [ ] **Step 1: Convert** the five files in order: finance, planning, reports, notifications, auth.
- [ ] **Step 2: Run the gate.** Expected: matches the baseline. The existing finance, planning, reports, notifications, auth and locale unit tests pass unchanged, apart from their specifiers.
- [ ] **Step 3: Commit:** `git commit -m "Convert finance, planning, reports, notifications and auth to TypeScript"`.

### Task 6: Application logic (non-UI)

**Files:**
- Rename and convert in `src/application/`: `client`, `assistantClient`, `sharedAccounts`, `enhancementForms`, `featureForms`, `forms`, `workspace` → `.ts`, and `useWorkspace` → `.ts`
- Modify: their importers

**Interfaces:**
- Produces: `applyEntry(state: Workspace, kind: EntryKind, data: EntryInput, editing: Transaction | null, id: () => string): Workspace`, with `EntryKind`/`EntryInput` exported from `forms.ts`. The parameter names stay as they are today, and so do the other export names.
- Produces: `useWorkspace()`'s return type, exported as `WorkspaceController` for the screens.

- [ ] **Step 1: Convert** the files in order: client → assistantClient → sharedAccounts → enhancementForms → featureForms → forms → workspace → useWorkspace.
- [ ] **Step 2: Run the gate.** Expected: matches the baseline, with `react-workspace`, `feature-parity` and `walletry-features` passing.
- [ ] **Step 3: Commit:** `git commit -m "Convert application state and forms to TypeScript"`.

### Task 7: Platform layer

**Files:**
- Rename and convert in `src/platform/`:
  - `files.{web,native}`, `runtime.{web,native}`, `speech.{web,native}`, `updates.{web,native}`, `safe-area.native`, `polyfills.native`, `http`, `secure-storage` → `.ts`
  - `PrivacyGate.{web,native}` and `safe-area.web` → `.tsx`
- Modify: `native-entry.js` (the polyfills specifier), plus importers of `http` and `secure-storage`
- Test: `tests/unit/platform-bundle.test.ts`

**Interfaces:**
- Produces: each `.web`/`.native` pair exports identical names and signatures. Both the web and native tsconfig runs must pass, which proves the pairs agree with every importer.

- [ ] **Step 1: Write `platform-bundle.test.ts`** (Review Focus 5).
  - It reads every `dist/assets/*.js` file and asserts that none contains a marker unique to native variants: the module ids `expo-secure-store` and `expo-local-authentication`, and one string literal unique to `runtime.native`.
  - It also asserts that one string literal unique to `runtime.web` is present.
  - Skip with a clear message only if `dist/` is missing. The gate always builds first.
- [ ] **Step 2: Run** `npm run build && node --test tests/unit/platform-bundle.test.ts`. Expected: PASS against the JS.
- [ ] **Step 3: Convert the files.** Variant imports stay extensionless.
- [ ] **Step 4: Run the gate, `npm run test:e2e` and `npm run build:native`.** Expected: matches the baseline, with 0 tsc errors in both the web and native runs.
- [ ] **Step 5: Commit:** `git commit -m "Convert platform layer to TypeScript"`.

### Task 8: Shared UI components

**Files:**
- Rename and convert in `src/application/`: `appearance`, `ui`, `Field.web`, `Field.native`, `FileField`, `AccountChoices`, `TrendChart`, `AppUpdates`, `AssistantFunding`, `EntryModal`, `Login` → `.tsx`
- Rename and convert: `src/main.jsx` → `src/main.tsx`
- Modify: `index.html` (entry `/src/main.tsx`)

**Interfaces:**
- Produces: each component's props as an exported `<Component>Props` type. Theme or appearance values get a named exported type in `appearance.tsx`.

- [ ] **Step 1: Convert** the files in order: appearance → ui → Field.web/Field.native → FileField → AccountChoices → TrendChart → AppUpdates → AssistantFunding → EntryModal → Login → main.
- [ ] **Step 2: Run the gate and `npm run test:e2e`.** Expected: matches the baseline.
- [ ] **Step 3: Commit:** `git commit -m "Convert shared UI components to TypeScript"`.

### Task 9: Screens

**Files:**
- Rename and convert in `src/application/`: `FinancialScreens`, `OrganizingScreens`, `PlanningScreens`, `ProjectDetails`, `CurrencyTools`, `ManagementScreens`, `ReportsSettings`, `MoneyTools`, `SharedAccounts`, `App` → `.tsx`
- Modify: `native-entry.js` (the App specifier)

- [ ] **Step 1: Convert** the files in this order (it respects their cross-imports): Financial → Organizing → Planning/ProjectDetails → CurrencyTools → Management → ReportsSettings → MoneyTools → SharedAccounts → App. Commit after each pair if helpful.
- [ ] **Step 2: Run the gate, `npm run test:e2e` and `npm run build:native`.** Expected: matches the baseline.
- [ ] **Step 3: Commit:** `git commit -m "Convert screens to TypeScript"`.

### Task 10: Supabase functions

**Files:**
- Rename and convert: `supabase/functions/_shared/push.js`, `financial-assistant/handler.js`, `financial-assistant/funding.js` → `.ts`
- Modify: the `index.ts` files that import them; `tests/unit/push-server.test.js`, `ai-funding.test.js` and `capture-assistant.test.js` (specifiers only)

**Interfaces:**
- Produces: `deliver(admin: SupabaseClient, send: FcmSend, device: PushDevice, deliveryKey: string, test?: boolean)`, with `PushDevice`/`FcmSend` exported from `push.ts`. Rows read from Supabase are `unknown` until a guard narrows them.
- Constraint: these three files may not use `Deno` globals or `npm:` specifiers, because Node imports them.

- [ ] **Step 1: Convert** the three files and update their imports.
- [ ] **Step 2: Install Deno 2.x if `deno --version` fails.** Then run `deno check supabase/functions/*/index.ts`. Expected: 0 errors.
- [ ] **Step 3: Run the gate.** Expected: matches the baseline.
- [ ] **Step 4: Commit:** `git commit -m "Convert Supabase function modules to TypeScript"`.

### Task 11: Desktop

**Files:**
- Rename and convert: `desktop/main.cjs` → `desktop/main.cts`, `desktop/preload.cjs` → `desktop/preload.cts`, `desktop/policy.cjs` → `desktop/policy.cts`
- Create: `desktop/tsconfig.json`
- Modify:
  - `.gitignore` (add `/desktop/*.cjs`)
  - `package.json`: add `desktop:compile`, include it in `typecheck`, and add `pretest: npm run desktop:compile`
  - `scripts/prepare-desktop.mjs` (run `desktop:compile`)

**Interfaces:**
- Produces: `desktop/tsconfig.json`, which extends the base config with:
  - `noEmit: false`, `allowImportingTsExtensions: false`
  - `verbatimModuleSyntax: false` and `erasableSyntaxOnly: false`, because these
    files are compiled rather than stripped. They use ordinary `import`
    statements, which compile to `require` in `.cts`
  - `module`/`moduleResolution: "nodenext"`, `rootDir`/`outDir: "desktop"`
  - `types: ["node"]` and Electron's types

  It emits `main.cjs`, `preload.cjs` and `policy.cjs` beside their sources, so `desktop/package.json` `main`, the `preload` path in `main` and electron-builder's `files` list stay the same.
- Produces: `parseRuntimeConfig(value: unknown): RuntimeConfig` in `main.cts`. The config is still loaded by `require("./runtime-config.json")` at the same moment as today. The parser only narrows it, and throws on a malformed file.
- Constraint: `preload.cts` compiles to a single file with no local `require`, so the sandbox keeps working. `contextIsolation`, `sandbox` and `nodeIntegration` stay unchanged.

- [ ] **Step 1: Convert** the files. `tests/unit/desktop-policy.test.js` keeps importing `../../desktop/policy.cjs`, which is now the compiled output.
- [ ] **Step 2: Compile and compare.** Run `npm run desktop:compile`. Expected: three `.cjs` files appear, and `git status` doesn't show them.
- [ ] **Step 3: Run the gate and `npm run desktop:prepare && npm run test:desktop`.** Expected: matches the baseline, with the bridge present, `window.require` undefined and the origin `financialadvisor://app`.
- [ ] **Step 4: Commit:** `git commit -m "Convert desktop shell to TypeScript with a CommonJS build step"`.

### Task 12: Configs and entry files

**Files:**
- Rename and convert:
  - `vite.config.js`, `eslint.config.js`, `playwright.config.js`, `playwright.auth.config.js`, `app.config.js`, `native-entry.js` → `.ts`
  - `electron-builder.config.cjs` → `electron-builder.config.ts`
  - `plugins/with-financial-advisor.cjs` → `plugins/with-financial-advisor.ts`
- Modify: `package.json` (`main`, and the `--config` flags in scripts), `.github/workflows/build-desktop.yml` (`--config` flag), and the plugin path in `app.config.ts`

- [ ] **Step 1: Convert** each file. Make the Playwright configs point `testIgnore` at `oauth.spec.*`.
- [ ] **Step 2: Verify the Expo config.** Run `npx expo config --type prebuild --json > .baseline/expo-config.after.json` and diff it against `.baseline/expo-config.json`. Expected: identical apart from the plugin path string.
  - If Expo can't load the `.ts` plugin, keep `plugins/with-financial-advisor.cjs` as a one-line shim that requires the `.ts` file (Node 24 strips types on `require`).
  - Record the shim in the findings doc under "Shims".
- [ ] **Step 3: Verify electron-builder.** Run `npx electron-builder --config electron-builder.config.ts --dir --publish never` and diff the unpacked file list against `.baseline/desktop-files.txt`. Expected: identical.
  - The fallback is the same kind of `.cjs` shim, recorded under "Shims".
- [ ] **Step 4: Verify the ESLint config.** `npx eslint --print-config src/main.tsx` should load `eslint.config.ts`. If it doesn't, add `jiti`.
- [ ] **Step 5: Run the gate, `npm run test:e2e`, `npm run build:native` and `npm run desktop:build`.** Expected: matches the baseline.
- [ ] **Step 6: Commit:** `git commit -m "Convert build and app configs to TypeScript"`.

### Task 13: Scripts and tests

**Files:**
- Rename and convert: `scripts/*.mjs` → `scripts/*.ts`, `tests/unit/*.test.js` → `.test.ts`, `tests/e2e/*.spec.js` → `.spec.ts`
- Modify:
  - `package.json` scripts: `predev`, `prebuild`, `desktop:prepare`, `test:desktop`, and `test`, which becomes `node --test "tests/unit/**/*.test.ts"`
  - `.github/workflows/*.yml`: every `node scripts/*.mjs` and every inline `from './scripts/release-notes.mjs'`
  - `docs/*.md` and `README.md` wherever they name renamed files

- [ ] **Step 1: Convert the scripts.** Then run `grep -rn "\.mjs" package.json .github docs README.md`. Expected: no matches that refer to repo scripts.
- [ ] **Step 2: Check the scripts still run.** Run `node scripts/release-notes.ts --help`, or the script's equivalent dry invocation, and `node scripts/prepare-ocr.ts`. Expected: the same output as the `.mjs` versions.
- [ ] **Step 3: Convert the tests.** Only syntax and types may change: every assertion, test name and test count stays the same. Compare the counts with the baseline.
- [ ] **Step 4: Run the gate, `npm run test:e2e` and `npm run test:desktop`.** Expected: the same test counts and results as the baseline.
- [ ] **Step 5: Commit:** `git commit -m "Convert scripts and tests to TypeScript"`.

### Task 14: Lockdown and hand-over

**Files:**
- Modify: `tsconfig.base.json` (remove `allowJs`/`checkJs`), `eslint.config.ts` (drop the JS block), `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/superpowers/specs/typescript-findings.md`
- Create: `docs/superpowers/specs/typescript-device-checklist.md`

- [ ] **Step 1: Remove `allowJs`.** Then run `git ls-files | grep -E '\.(js|jsx|mjs|cjs)$'`. Expected: only shims from Task 12, each listed under "Shims" in the findings doc.
- [ ] **Step 2: Count the escape hatches.** Run `grep -rn "TS-ESCAPE" --include=*.ts --include=*.tsx --include=*.cts .` and copy every hit, with its reason, into the findings doc under "Escape hatches".
- [ ] **Step 3: Run the full finish line:**
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`
  - `npm run build:native`
  - `npm run desktop:prepare && npm run test:desktop`
  - `deno check supabase/functions/*/index.ts`

  Expected: every result matches or beats the baseline, with 0 tsc errors.
- [ ] **Step 4: Compare outputs.** Diff the file lists and sizes of `dist/` and `dist-native/` against `.baseline/`. Explain every added or removed module, and every size change over 5%, under "Output comparison" in the findings doc.
- [ ] **Step 5: Write the device checklist.** List the build commands for an Android/iOS dev build and the desktop installer, then the steps: sign in, open the workspace, add an entry, check for updates. Include a sign-off line for the owner.
- [ ] **Step 6: Update the docs.** Document `npm run typecheck` and the tsconfig layout in `DEVELOPMENT.md` and `TESTING.md`.
- [ ] **Step 7: Commit:** `git commit -m "Finish TypeScript conversion: lock down JS, record findings and checklist"`. Do not merge: merging waits for the owner's device sign-off.
