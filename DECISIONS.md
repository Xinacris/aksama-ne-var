# DECISIONS

One line each: decision — reason.

- Read all `design/*.dc.html` before any UI work; design date "Pazartesi, 12 Ekim" coincides with the build date (2026-10-12), so demo seed is relative to "today" — keeps the demo looking like the design on any day.
- Next.js 16.4 (create-next-app) with `cacheComponents`/`partialPrefetching` turned off — app is fully client-side over localStorage; server only renders shells, so the cache-components constraints add risk without benefit.
- Styling: CSS Modules + global token CSS (`src/app/globals.css`) — design is hand-written CSS; modules port it 1:1 without a Tailwind translation layer.
- Theme: `data-theme` on `<html>` set by an inline boot script before paint (no flash); `prefers-color-scheme` CSS fallback when JS is off. The boot script and `src/data/preferences.ts` are the only places reading the theme key — the boot script must run before React.
- Node pinned to 24.x (current LTS on 2026-10-12; Node 26 is not LTS yet). Local dev machine runs 26, which only produces an engine warning.
- `@types/node@24` instead of the scaffold's `^20` — vitest 5 peer requires >=22.
- `typecheck` runs `next typegen` first so route-aware types (`LayoutProps`, `PageProps`) exist without a build.
- E2E server = `next build && next start` on port 3100 (production parity, the build is what Vercel runs).
- Storage layout: one JSON array per table under `anv:t:<table>`, schema version in `anv:meta`; rows are zod-validated on read, invalid rows dropped, unparseable tables quarantined to `anv:corrupt:<table>:<ts>` — the app keeps working with a calm notice instead of crashing.
- Built-in recipes live in code (`src/data/seed`), not in storage; only household custom recipes are stored — keeps storage small and lets the seed improve without migrations.
- Session: sessionStorage holds the per-tab user, localStorage remembers the last login so new tabs and restarts stay logged in; logout only clears the shared fallback if it points at the same user.
- Emails and invite codes compared with plain `toLowerCase()` (Turkish casing turns `I` into `ı`, which breaks ASCII emails); Turkish casing is used for user-facing search/sort.
- Sync: writes publish a coalesced `change` message per tick over BroadcastChannel; `storage` events are a fallback. Presence heartbeats use the same channel.
