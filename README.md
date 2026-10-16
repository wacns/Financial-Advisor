# FinancialAdvisor

An English-language personal finance app for Bahrain, built with Ionic Core, Capacitor, Vite, JavaScript, and Supabase. FinancialAdvisor has its own navy, ivory, and sage identity and uses BHD with three-decimal fils precision. The same app supports the web and native iOS/Android projects.

**Live app:** [financial-advisor-partner.vercel.app](https://financial-advisor-partner.vercel.app/)

## Quick start

The repository root is the application root. Use Node.js 24 (`nvm use` reads `.nvmrc`).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the root `.env.local` to enable sign-in. The demo works without live credentials. Never put Google client secrets or Supabase service-role keys in browser environment variables.

## Project structure

```text
.
├── src/                       # Application UI, auth, finance and planning logic
├── public/                    # Static assets served unchanged
├── android/                   # Capacitor Android app
├── ios/                       # Capacitor iOS app (Swift Package Manager)
├── tests/
│   ├── unit/                  # Node unit tests
│   └── e2e/                   # Playwright browser tests
├── supabase/                  # Migrations, native push functions and scheduler setup
├── scripts/                   # Native build configuration checks
├── docs/                      # Feature, authentication, testing and deployment guides
├── index.html                 # Vite application entry
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
| `npm run native:sync` | Build native assets and sync iOS/Android projects |
| `npm run native:android` | Sync and open Android Studio |
| `npm run native:ios` | Sync and open Xcode on macOS |

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
