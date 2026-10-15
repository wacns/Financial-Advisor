# Northline Bahrain

Personal finance for Bahrain, built with Vite and Supabase.

**Live app:** https://northline-bahrain.vercel.app/

The application lives in [`northline/`](northline/). See its [README](northline/README.md) for setup, tests, and authentication details.

## Local development

```sh
cd northline
npm ci
cp .env.example .env.local
# Set your Supabase URL and publishable key in .env.local.
npm run dev
```

## Vercel repository settings

- Root directory: `northline`
- Framework: Vite
- Production branch: `main`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Public environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

Local environment files, build output, dependencies, browser artifacts, and Vercel local metadata are excluded from Git. Google client secrets belong in Supabase provider settings, never in this repository.
