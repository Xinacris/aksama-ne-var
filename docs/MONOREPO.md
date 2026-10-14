# Monorepo

npm workspaces, one root `package-lock.json`, Node 24 (`.nvmrc`; `>=24` works).

```
apps/web        Next.js app            package @anv/web
apps/mobile     Expo app (Expo Router) package @anv/mobile
packages/core   framework-free TS      package @anv/core
design/  docs/  supabase/              shared, unchanged
```

## How code is shared

- `packages/core` ships **TypeScript source, no build step**. `package.json` `exports` maps
  `@anv/core/<path>` to `src/<path>.ts` (plus `@anv/core/i18n/*` for the JSON catalogs).
  Next compiles it through `transpilePackages: ["@anv/core"]`; Metro (Expo) compiles it like app
  code; Vitest and TypeScript resolve it through the workspace symlink in `node_modules/@anv/core`.
- **No React, React DOM, React Native, Next or Expo imports in core.** `packages/core/eslint.config.mjs`
  fails the lint on any of them. The store is a `zustand/vanilla` store (`createStore`);
  `apps/web/src/store/app.ts` and `apps/mobile/src/store.ts` bind it to React with `useStore`, and
  pass platform hooks with `configureApp()` (data context, "page is going away", network state).
- Imports: in web, `@/…` is `apps/web/src`, shared modules are `@anv/core/…`. Inside `packages/core/src`
  imports are relative (so the code resolves the same from Next, Metro and Vitest). Core's own tests
  may use `@/…` for `packages/core/src` (Vitest alias + tsconfig paths, tests only).
- Platform-specific pieces stay in the apps: browser storage and the cross-tab bus
  (`apps/web/src/data/browserStorage.ts`, `browserBus.ts`), the theme boot script, server code
  (`apps/web/src/server/**`, `/api/import`, `/api/translate`); AsyncStorage, `expo-crypto` on mobile.

## Scripts

From the root (each runs in every workspace that has it):

| Script | |
|---|---|
| `npm run lint` | ESLint in core, web, mobile |
| `npm run typecheck` | `tsc --noEmit` everywhere (web: `next typegen` first) |
| `npm test` | Vitest (core, web), Jest via jest-expo (mobile) |
| `npm run build` | web production build |
| `npm run test:e2e` | web Playwright (builds and starts the app on port 3100) |
| `npm run mobile` | Expo dev server (Expo Go) |

One workspace: `npm run test -w @anv/core`, or `cd apps/web && npm test` (configs work from inside
each folder too).

No Turborepo: four scripts across three packages run fine with `npm run --workspaces`, and caching
would not save much because tests dominate and change with every edit. Revisit if CI gets slow.

## Vercel settings

Set by the owner when Round 3 was merged (2026-10-14). Without them a deploy fails: Vercel would
build the repo root, where there is no Next.js app.

Project → **Settings → Build and Deployment**:

| Setting | Value |
|---|---|
| **Root Directory** | `apps/web` |
| Include files outside the root directory in the Build Step | **Enabled** (needed: the app imports `packages/core`) |
| Framework Preset | Next.js (auto) |
| Install Command | leave default — `apps/web/vercel.json` sets `npm ci`; npm finds the workspace root and installs everything from the root lockfile |
| Build Command | leave default — `npm run build` from `apps/web/vercel.json` |
| Node.js Version | 24.x |

Environment variables are unchanged (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`, all optional).

A failed build never replaces the live site, which keeps serving the last good deployment. After
each push, check `gh api repos/{owner}/{repo}/commits/main/status` → `success`.

Verified locally (2026-10-14): a copy of the repo without `node_modules`, then
`cd apps/web && npm ci && npm run build` → install at the workspace root, build OK.
