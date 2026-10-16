# Northline Bahrain

An English-language personal finance app for Bahrain, built with Vite, JavaScript, and Supabase. Northline has its own navy, ivory, and sage identity and uses BHD with three-decimal fils precision.

**Live app:** [northline-bahrain.vercel.app](https://northline-bahrain.vercel.app/)

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
├── tests/
│   ├── unit/                  # Node unit tests
│   └── e2e/                   # Playwright browser tests
├── supabase/migrations/        # Versioned database schema and ownership policies
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

Install Chromium with `npx playwright install chromium` before running browser tests. See the [testing guide](docs/TESTING.md) for Linux dependencies and system-browser options.

## Documentation

- [Features and Bahrain conventions](docs/FEATURES.md): accounts, transactions, budgets, goals, bills, salary, debts and project planning.
- [Authentication and data ownership](docs/AUTHENTICATION.md): Supabase setup, protected routes and RLS.
- [Google sign-in setup](docs/GOOGLE_AUTH_SETUP.md).
- [Development conventions](docs/DEVELOPMENT.md).
- [Deployment and existing-checkout migration](docs/DEPLOYMENT.md).
- [Release history](CHANGELOG.md).

Pushes to `main` deploy through the existing Vercel Git integration. Vercel uses the repository root and runs unit tests before building. Local environment files, dependencies, generated output, browser artifacts and Vercel metadata are ignored by Git.
