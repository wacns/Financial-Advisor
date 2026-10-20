# Development conventions

FinancialAdvisor uses React 19, React Native 0.88, Expo SDK 58 and React Native Web. Install dependencies and run commands at the repository root. Vite builds the website, Metro builds native apps. Both enter the same component tree in `src/application/App.tsx`.

## Source responsibilities

| Module | Responsibility |
| --- | --- |
| `src/main.tsx` | React DOM web entry |
| `native-entry.ts` | Expo entry, native URL and UUID polyfills |
| `src/application/App.tsx` | Shared responsive shell, navigation and modal state |
| `src/application/useWorkspace.ts` | Verified sign-in, workspace loading/saving and device lifecycle |
| `src/application/workspace.ts` | Shared immutable entry commands and CSV formatting |
| `src/domain/` | Normalization, validation, currency conversion, cycles, ledger reversals, projects, imports, receipt parsing and flexible reports |
| `src/application/appearance.tsx` | Arabic translation, RTL and theme context |
| `src/platform/files.web.ts` / `.native.ts` | Receipt OCR, attachments, widgets and quick-entry links |
| `src/platform/PrivacyGate.native.tsx` | Device unlock and capture/background privacy |
| `modules/financial-advisor-native/` | Expo Android OCR/widget module and iOS Vision module |
| `src/application/forms.ts` | Platform-independent form definitions and defaults |
| `src/application/*Screens.tsx` | Shared financial and planning screens |
| `src/application/Field.web.tsx` / `.native.tsx` | Accessible browser inputs and native inputs/pickers |
| `src/platform/runtime.web.ts` / `.native.ts` | Platform storage, auth browser, lifecycle, Firebase and exports |
| `src/platform/secure-storage.ts` | Chunked Keychain/Keystore-backed Supabase sessions |
| `src/auth.ts` | Google PKCE and validated callback consumption |
| `src/finance.ts`, `planning.ts`, `reports.ts`, `locale.ts` | Existing shared finance and Bahrain rules |
| `src/notifications.ts` | Opt-in, token registration and notification lifecycle |
| `app.config.ts`, `plugins/` | Reproducible Expo native configuration |
| `supabase/functions/` | Existing authenticated FCM registration and reminder backend |

Keep financial rules in pure TypeScript modules. Shared screens use React Native primitives, never HTML strings or imperative DOM mutation. Platform-specific behavior lives behind `.web` / `.native` modules; import those without the suffix so Vite/Metro choose the right implementation. Native code must not import `react-dom`, browser globals or Vite `import.meta.env`. Do not reintroduce Ionic or Capacitor.

Native projects are generated and ignored. Change `app.config.ts` or a config plugin, then regenerate; manual changes inside `android/` or `ios/` disappear on clean prebuild. Preserve the existing `northline_workspaces` schema, BHD data and browser demo key. Installed Capacitor demo/session storage is separate from React Native storage; signed-in cloud data remains available after signing in again.

## TypeScript

All source, scripts, tests and configuration are TypeScript. Node 24 runs `.ts` files directly (type stripping), Vite and Metro compile them for the app, and Deno runs the Supabase functions. Only the desktop shell is compiled ahead of time: `desktop/src/*.cts` becomes `desktop/{main,preload,policy}.cjs` through `npm run desktop:compile`, and the output is gitignored.

`npm run typecheck` (part of `npm run lint`) checks each project with its own settings:

| Config | Covers |
| --- | --- |
| `tsconfig.base.json` | Shared strict settings: `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`, `verbatimModuleSyntax`; no JavaScript allowed |
| `tsconfig.web.json` | `src/` as the website sees it: DOM types, resolves `.web` files, excludes `*.native.*` |
| `tsconfig.native.json` | `src/` and `native-entry.ts` as Metro sees them: Expo types, resolves `.native` files, excludes `*.web.*` |
| `tsconfig.node.json` | Unit tests, scripts, tool configs, Expo plugins and the Node-importable Supabase function modules |
| `tsconfig.e2e.json` | Playwright specs and configs and the desktop smoke test (Node plus DOM types) |
| `desktop/tsconfig.policy.json` | The desktop URL policy that unit tests import; `desktop/tsconfig.json` compiles the whole shell |

Deno type-checks the functions separately: `deno check supabase/functions/*/index.ts`.

Platform variants (`Name.web.tsx` / `Name.native.tsx`) export the same contract from `src/platform/contracts.ts`. Each variant checks itself with `import type * as Self from "./Name.web.tsx"` and `export type Check = Satisfies<Contract, typeof Self>`. Callers import them without the suffix. Read values whose shape is not known yet (JSON, request bodies, provider responses) as `unknown`, and narrow them with the helpers in `src/guards.ts` (`field`, `isOneOf`, `matches`, `must`). The Supabase functions use their own copy in `supabase/functions/_shared/guards.ts`. Lint rejects `any`, non-null `!`, `@ts-` comments and type assertions. Where a value really is used unchecked, add an `eslint-disable-next-line` with a `TS-ESCAPE:` reason saying why that is safe. `grep -rn TS-ESCAPE` lists every one.

Use public Supabase publishable keys in client environment variables, never service-role or Firebase service-account secrets. Dependencies and lockfile are pinned. See [MOBILE.md](MOBILE.md) for platform setup and [TESTING.md](TESTING.md) before pushing.
