# TypeScript conversion — design

Date: 2026-10-20
Status: draft, awaiting approval

## Intent and why

The owner wants the project written with typed data. In practice that means two things:

1. **Fewer runtime bugs.** Wrong argument shapes, misspelled fields and missing
   values should be caught by the compiler instead of by users.
2. **Easier navigation.** In WebStorm, every function, prop and data structure
   should show what it accepts and returns, and go-to-definition, find-usages and
   rename should be reliable.

Success means the whole codebase is TypeScript under strict mode, the editor knows
the shape of every piece of data, and the app behaves exactly as it does at
v1.7.1 (commit `88e8a9f`).

## Goals

- Convert **every** JavaScript file in the repository to TypeScript. That is roughly
  120 files and about 18,700 lines:
  - `src/**` — `.js` becomes `.ts`, `.jsx` becomes `.tsx`, including the
    `.web` and `.native` platform variants.
  - `tests/unit/**` and `tests/e2e/**`.
  - `scripts/*.mjs`.
  - `desktop/*.cjs` (Electron main, preload and policy).
  - `supabase/functions/**/*.js` (`_shared/push.js`, `financial-assistant/handler.js`,
    `financial-assistant/funding.js`).
  - Root configs: `vite.config`, `eslint.config`, `playwright.config`,
    `playwright.auth.config`, `app.config`, `native-entry`,
    `electron-builder.config`, and `plugins/with-financial-advisor.cjs`.
- Turn on `strict: true` from day one, along with `noUncheckedIndexedAccess`.
- Give the core data real, named types: the workspace and all its collections
  (accounts, transactions, budgets, goals, recurring, debts, projects, warranties,
  cycleBudgets, templates, payees, tags, subscriptions, installments), entries, forms,
  reports, and assistant and push payloads. Define them once and reuse them
  everywhere.
- Make `normalizeWorkspace` (in `src/domain/model`) the single boundary where
  untyped data (Supabase rows, imported files, local storage) becomes a typed
  `Workspace`. Its runtime behavior stays the same; only its signature and
  internals gain types.
- Make type-checking part of the normal gate. CI's `npm run lint && npm test` (and
  the local equivalent) must include a full `tsc` check that fails on any error.

## Non-goals

- New features, UI changes, refactors for taste, or renamed public functions
  beyond what the conversion requires.
- Upgrading dependencies, except to add type-only packages.
- Changing the database schema or the stored workspace format.
- Rewriting tests. Tests are converted, not redesigned.

## Anti-goals (a failure even if it builds)

- **Any change in behavior** on web, iOS/Android or desktop. This includes timing,
  rounding (fils math), stored data, URLs, auth flows and update feeds.
- **Fake strictness.** `any`, `as any`, `@ts-ignore`, `@ts-expect-error`,
  non-null `!` and unchecked casts used to silence errors are not acceptable.
  - A small number of escape hatches is allowed only where no honest type is
    possible, for example a library with wrong types. Each one needs a
    `// TS-ESCAPE: <reason>` comment so they can be counted and reviewed.
  - `unknown` plus narrowing is the preferred tool at untyped boundaries.
  - **Missing-value guards (owner's decision).** About 165 places index arrays or
    maps, or use `find()`, and assume the result exists. With
    `noUncheckedIndexedAccess`, each one gets a runtime guard.
    - Where today's code would already crash on the missing value, the guard
      throws a clear `Error` instead. This is the one accepted change to failure
      behavior.
    - Where today's code tolerates a missing value (it carries `undefined`
      forward or falls back to a default), the guard keeps exactly that outcome.
    - Guards never change the result on any path that works today.
- **Quiet bug fixes.** If typing reveals a real bug, the conversion keeps the
  current behavior and logs the bug in `docs/superpowers/specs/typescript-findings.md`
  with its file, line and what goes wrong. The owner decides on fixes separately.
- **Weakened tests.** No test may be skipped, loosened or deleted to make the
  conversion pass.

## Constraints

- **Release freeze.** No releases or other feature work land until the conversion
  is complete. The work happens on its own branch and merges to `main` once.
- **Node 24** (`.nvmrc`) runs `.ts` files directly through built-in type stripping.
  Unit tests and scripts should run with plain `node`, with no extra loader. This
  rules out syntax that type stripping cannot erase: `enum`, `namespace`, parameter
  properties and similar. Use `erasableSyntaxOnly` to enforce it, and write
  relative imports with the `.ts` extension (`allowImportingTsExtensions` and
  `rewriteRelativeImportExtensions`, as needed).
- **Vite** (web and desktop renderer) needs `resolve.extensions` updated to include
  `.web.ts`, `.web.tsx`, `.ts` and `.tsx` in the same priority order as today.
- **Expo / Metro** resolves `.native` and `.web` variants itself. TypeScript must
  check each platform against the right variant. The likely approach is two
  tsconfig projects (web and native) using `moduleSuffixes`; the builder confirms
  what actually works.
- **Electron cannot run TypeScript in the main or preload process.**
  - `desktop/main`, `preload` and `policy` need a compile step, run from
    `scripts/prepare-desktop` (`desktop:prepare`), that emits the CommonJS files
    Electron loads.
  - The sandboxed preload and its `contextIsolation` setup must stay exactly as
    they are.
  - `electron-builder.config`'s `files` list must still match what ships.
- **Deno** runs the Supabase functions. The converted `push`, `handler` and
  `funding` modules must work under Deno's strict mode and must also be
  importable by the Node unit tests.
  - Keep `npm:` specifiers out of modules that Node imports, as is already the
    case today.
- **Uncertain TypeScript support for two configs.** Expo config plugins and
  electron-builder may not load a `.ts` file.
  - The builder verifies each one early.
  - If a tool cannot load TypeScript natively, compile that file or keep a thin
    `.cjs` loader that runs the TypeScript version. The real logic must live in
    TypeScript.
- **Things that point at old file names must all be updated.** That includes:
  - `package.json` scripts, including `main: native-entry.js`
  - `.github/workflows/*.yml`, which call `node scripts/*.mjs` and contain inline
    `import ... from './scripts/release-notes.mjs'`
  - Playwright's `testIgnore`
  - the ESLint `files` globs
  - `index.html`'s entry script
  - the docs in `docs/*.md` that name files
- **ESLint** moves to `typescript-eslint`, keeping today's rules: `no-undef` (or
  its TypeScript equivalent), `no-unreachable`, `no-dupe-keys` and the react-hooks
  rules. Its coverage widens from `src/` to the whole repository.
- `node_modules` is not currently installed in this checkout, so run `npm ci`
  first. The only new dependencies should be type packages and tooling:
  `typescript`, `typescript-eslint`, `@types/react`, `@types/react-dom`,
  `@types/react-native-web` and `@types/node`, plus `@types/js-yaml` in
  `desktop/` if needed.

## How "same behavior" is proven

1. **Baseline first.** Before any conversion, on a clean `npm ci`, record the
   results of:
   - `npm run lint`
   - `npm test`
   - `npm run test:e2e`
   - `npm run build`
   - `npm run build:native`
   - `npm run desktop:prepare` with `npm run test:desktop`

   Note anything that already fails. Those failures are not the conversion's job
   to fix, but they must not get worse.
2. **Finish line.** All of the above produce the same results as the baseline,
   and in addition:
   - `tsc` passes for every tsconfig project with zero errors.
   - The ESLint rules above pass.
   - No `.js`, `.jsx`, `.mjs` or `.cjs` source files remain. The only exceptions
     are generated output, and any thin loader shims the constraints section
     allows, each listed in the final report.
   - The `TS-ESCAPE` count is reported, with every reason.
   - `typescript-findings.md` lists every real bug that typing surfaced.
3. **Output check.** Compare the production web bundle and the native export
   before and after. They are not expected to be byte-identical, but any
   meaningful difference, such as missing modules or changed constants, must be
   explained.
4. **Device smoke test (owner).** Before merging, the owner runs a manual check
   when devices are available, on a phone build and on the installed desktop app:
   sign in, open the workspace, add an entry, and check for updates. The builder
   provides the builds and a short checklist. Merging waits for this sign-off.

## Settled after the builder check (Claude's calls)

- **Platform imports.** Imports that rely on Metro and Vite to pick a `.web` or
  `.native` variant (`../platform/runtime`, `files`, `PrivacyGate`, `safe-area`,
  `speech`, `updates`) stay extensionless.
  - The `.ts` extension rule applies only to modules that plain Node runs: unit
    tests, scripts, and whatever those import.
  - Platform modules that the unit tests import must resolve under Node as well.
- **Supabase functions.** Merging to `main` does not deploy them. No workflow runs
  `supabase functions deploy`.
  - The finish line adds `deno check` on every function entry point.
  - Redeploying the converted functions is a separate, manual step for the owner,
    taken at the next release. Nothing is deployed as part of this work.
- **Desktop policy tests.** The unit tests check the **compiled** CommonJS output
  that ships in `desktop/`, not the `.ts` source.
  - The desktop sources should use `.cts`, or emit CommonJS, so their module
    format matches `desktop/package.json`, which has no `"type"` and is therefore
    CommonJS.
- **Lint scope.** ESLint covers the whole repository with today's rule set only.
  - New hits in newly covered files get fixed when the fix doesn't change
    behavior.
  - Otherwise they are logged in `typescript-findings.md`. No rule is disabled to
    get a pass.

## Left to the builder

- The order of conversion. A sensible order is domain and pure logic first, then
  application state, then UI, then platform files, then tests, scripts and config.
- The exact tsconfig layout: number of projects, `references` and `paths`.
- Where the shared types live, for example `src/domain/types.ts`.
- How to type Supabase responses: hand-written types or types generated from the
  migrations. Either way, rows are treated as `unknown` until they pass through
  the typed boundary.
- How the Electron files are compiled (`tsc` or esbuild) and where the output goes.
- Commit granularity on the branch.

## Calls made without the owner (review these)

- `noUncheckedIndexedAccess` is on, in addition to `strict`. The owner then chose
  runtime guards over escape hatches for the access sites it flags.
- Escape hatches are allowed only with a `TS-ESCAPE` comment.
- Real bugs found during the conversion are logged, not fixed.
- The work is one branch merged once, with tests and scripts running as `.ts`
  directly on Node 24.
