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

Keep financial rules in pure JavaScript modules. Shared screens use React Native primitives, never HTML strings or imperative DOM mutation. Platform-specific behavior lives behind `.web` / `.native` modules; import those without the suffix so Vite/Metro choose the right implementation. Native code must not import `react-dom`, browser globals or Vite `import.meta.env`. Do not reintroduce Ionic or Capacitor.

Native projects are generated and ignored. Change `app.config.ts` or a config plugin, then regenerate; manual changes inside `android/` or `ios/` disappear on clean prebuild. Preserve the existing `northline_workspaces` schema, BHD data and browser demo key. Installed Capacitor demo/session storage is separate from React Native storage; signed-in cloud data remains available after signing in again.

Use public Supabase publishable keys in client environment variables, never service-role or Firebase service-account secrets. Dependencies and lockfile are pinned. See [MOBILE.md](MOBILE.md) for platform setup and [TESTING.md](TESTING.md) before pushing.
