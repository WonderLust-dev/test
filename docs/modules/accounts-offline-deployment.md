# Accounts, offline use, and deployment

## Accounts

Supabase Auth provides optional account sign-in. Guest use remains available; user-owned data is associated with the effective user ID and is stored locally when cloud sync is unavailable. The authentication UI and app session wiring live in `src/components/AuthGate.tsx` and `src/App.tsx`.

## Local-first persistence

`src/services/database.ts` writes supported data to local storage for immediate use, then syncs authenticated records to Supabase. Offline note writes are queued and processed when sync is available. The app also includes PWA install, update, and offline indicators.

Local browser storage is specific to the app origin and browser profile. Clearing site data removes unsynced guest/offline data.

## Environment and deployment

The Supabase client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the build environment. Set these as local environment variables or deployment secrets; do not commit service-role keys or other private credentials.

GitHub Pages deployment is covered by the root [deployment guide](../../DEPLOYMENT.md). For Supabase schema setup, use the [database guide](../database/README.md).
