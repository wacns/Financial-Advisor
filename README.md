# FinancialAdvisor

An English-language personal finance app for Bahrain, built with React, React Native, Expo, React Native Web, Vite, and Supabase. FinancialAdvisor has its own forest, ivory, and sage identity and uses BHD with three-decimal fils precision. Shared React Native components render as React DOM on the web and native views on iOS/Android. There is no WebView wrapper.

**Live app:** [financial-advisor-partner.vercel.app](https://financial-advisor-partner.vercel.app/)

## Quick start

The repository root is the application root. Use Node.js 24 (`nvm use` reads `.nvmrc`).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the root `.env.local` to enable sign-in. Set the corresponding `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for mobile builds. The demo works without live credentials. Never put Google client secrets or Supabase service-role keys in browser environment variables.

## Project structure

```text
.
├── src/                       # Application UI, auth, finance and planning logic
├── public/                    # Static assets served unchanged
├── src/application/           # Shared React screens, components, forms and state
├── src/platform/              # Web/native auth, storage, exports and push adapters
├── app.config.js              # Expo identity, platform configuration and plugins
├── native-entry.js            # Expo entry (iOS / Android)
├── eas.json                   # Development, preview and release build profiles
├── tests/
│   ├── unit/                  # Node unit tests
│   └── e2e/                   # Playwright browser tests
├── supabase/                  # Migrations, native push functions and scheduler setup
├── plugins/                   # Reproducible native notification configuration
├── docs/                      # Feature, authentication, testing and deployment guides
├── index.html                 # Vite web entry (src/main.jsx)
├── package.json               # Commands and pinned dependencies
├── package-lock.json          # Reproducible npm installs
├── playwright.config.js       # Demo/browser test configuration
├── playwright.auth.config.js  # Isolated mocked OAuth configuration
├── vercel.json                # Build and deployment configuration
├── .env.example               # Public client configuration template
├── .nvmrc                     # Node.js version
└── CHANGELOG.md
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run browser workflows |
| `npm run test:oauth` | Run mocked Google OAuth checks |
| `npm run build` | Create the production build in `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Check React hook dependencies and JavaScript errors |
| `npm start` | Start Expo for a development build |
| `npm run native:prebuild` | Generate native projects from Expo config |
| `npm run native:android` | Build and run Android locally |
| `npm run native:ios` | Build and run iOS on macOS |
| `npm run build:native` | Export Hermes bundles for both mobile platforms |

Install Chromium with `npx playwright install chromium` before running browser tests. See the [testing guide](docs/TESTING.md) for Linux dependencies and system-browser options.

## Documentation

- [Features and Bahrain conventions](docs/FEATURES.md): accounts, transactions, budgets, goals, bills, salary, debts, project planning, payment calendars, transfers and account-specific reports.
- [Authentication and data ownership](docs/AUTHENTICATION.md): Supabase setup, protected routes and RLS.
- [Google sign-in setup](docs/GOOGLE_AUTH_SETUP.md).
- [Development conventions](docs/DEVELOPMENT.md).
- [iOS, Android and push notifications](docs/MOBILE.md): native setup, Firebase/APNs and device testing.
- [Deployment and existing-checkout migration](docs/DEPLOYMENT.md).
- [Release history](CHANGELOG.md).

Pushes to `main` deploy through the existing Vercel Git integration. Vercel uses the repository root and runs unit tests before building. Local environment files, dependencies, generated output, browser artifacts and Vercel metadata are ignored by Git.
