# Development conventions

FinancialAdvisor uses React 19, React Native 0.88, Expo SDK 58 and React Native Web. Install dependencies and run commands at the repository root. Vite builds the website, Metro builds native apps. Both enter the same component tree in `src/application/App.jsx`.

## Source responsibilities

| Module | Responsibility |
| --- | --- |
| `src/main.jsx` | React DOM web entry |
| `native-entry.js` | Expo entry, native URL and UUID polyfills |
| `src/application/App.jsx` | Shared responsive shell, navigation and modal state |
| `src/application/useWorkspace.js` | Verified sign-in, workspace loading/saving and device lifecycle |
| `src/application/workspace.js` | Shared immutable entry commands and CSV formatting |
| `src/domain/` | Normalization, validation, currency conversion, cycles, ledger reversals, projects, imports, receipt parsing and flexible reports |
| `src/application/appearance.jsx` | Arabic translation, RTL and theme context |
| `src/platform/files.web.js` / `.native.js` | Receipt OCR, attachments, widgets and quick-entry links |
| `src/platform/PrivacyGate.native.jsx` | Device unlock and capture/background privacy |
| `modules/financial-advisor-native/` | Expo Android OCR/widget module and iOS Vision module |
| `src/application/forms.js` | Platform-independent form definitions and defaults |
| `src/application/*Screens.jsx` | Shared financial and planning screens |
| `src/application/Field.web.jsx` / `.native.jsx` | Accessible browser inputs and native inputs/pickers |
| `src/platform/runtime.web.js` / `.native.js` | Platform storage, auth browser, lifecycle, Firebase and exports |
| `src/platform/secure-storage.js` | Chunked Keychain/Keystore-backed Supabase sessions |
| `src/auth.js` | Google PKCE and validated callback consumption |
| `src/finance.js`, `planning.js`, `reports.js`, `locale.js` | Existing shared finance and Bahrain rules |
| `src/notifications.js` | Opt-in, token registration and notification lifecycle |
| `app.config.js`, `plugins/` | Reproducible Expo native configuration |
| `supabase/functions/` | Existing authenticated FCM registration and reminder backend |

Keep financial rules in pure JavaScript modules. Shared screens use React Native primitives, never HTML strings or imperative DOM mutation. Platform-specific behavior lives behind `.web` / `.native` modules; import those without the suffix so Vite/Metro choose the right implementation. Native code must not import `react-dom`, browser globals or Vite `import.meta.env`. Do not reintroduce Ionic or Capacitor.

Native projects are generated and ignored. Change `app.config.js` or a config plugin, then regenerate; manual changes inside `android/` or `ios/` disappear on clean prebuild. Preserve the existing `northline_workspaces` schema, BHD data and browser demo key. Installed Capacitor demo/session storage is separate from React Native storage; signed-in cloud data remains available after signing in again.

Use public Supabase publishable keys in client environment variables, never service-role or Firebase service-account secrets. Dependencies and lockfile are pinned. See [MOBILE.md](MOBILE.md) for platform setup and [TESTING.md](TESTING.md) before pushing.
