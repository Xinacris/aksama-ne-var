# Akşama Ne Var?

A household meal planner for two people in Turkish homes: decide "what's for dinner" together by
swiping, plan the week as menus (çorba + ana yemek + yanında + salata), get a shared shopping list
generated from the plan, and get prep reminders at the right moment
("Akşama İzmir köfte var, kıymayı buzluktan çıkarmayı unutma."). No calories, streaks or guilt.

**Live:** https://aksama-ne-var.vercel.app · **Morning demo script:** [DEMO.md](DEMO.md)

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Node 24 LTS (`.nvmrc`). No environment variables, no backend: everything is stored in the browser.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint, `next typegen && tsc` |
| `npm test` | Vitest: domain, data layer, store, seed, component tests (~200) |
| `npm run test:e2e` | Playwright at 390×844 and 1440×900: two-member journey, board drag-and-drop, axe on every screen (builds and starts the app on port 3100) |
| `npm run screenshots` | Every screen at 390/1440 × light/dark into `screenshots/` (`SHOTS=bugun,liste` to limit) |

## Try it with two people in one browser

1. Open the app → **Hesap oluştur** → pick a few dishes → **Devam et** → copy the invite link →
   **Şimdilik tek başıma başla**.
2. Open the invite link in a **second tab**. It is logged in as you (tabs share the last login), so
   press **Farklı bir hesapla katıl** and sign up as the second person. Each tab keeps its own user.
3. Both open **Eşleş**: swipe (drag, buttons or ←/→). Like the same card in both tabs → match moment
   appears in both → **"<Gün> akşamına koy"**.
4. **Liste**: check an item in one tab; the other tab shows it instantly ("Ali aldı · az önce"),
   with "… de markette" while the partner is on the list.

Or press **Örnek evle dene · Ali ve Zeynep** on the login page (also in Ayarlar) for the design's
sample week. Demo accounts: `ali@demo.ev` / `zeynep@demo.ev`, password `demo1234`.

## How it's built

- **Next.js 16 (App Router) + React 19 + TypeScript strict**, CSS Modules over the design tokens
  in `src/app/globals.css` (light/dark/system, no flash), Young Serif + Figtree via `next/font`.
- **Data layer** (`src/data`): zod models shaped like Postgres tables, repository interfaces
  (`repos.ts`), one implementation `LocalStorageAdapter` (one JSON array per table, schema
  version + migrations, corrupt-data quarantine, quota errors), a per-tab session, and a
  `SyncBus` (BroadcastChannel + `storage` events) for live updates and presence.
- **Domain** (`src/domain`): pure, unit-tested rules — list aggregation with unit conversion and
  pack rounding, "evde var" subtraction, prep scheduling, deck building and matching, rotation
  memory, leftovers, plan transitions (ate out, plan changed, swaps), summaries, Turkish copy.
- **Store** (`src/store/app.ts`): Zustand over the repositories; components never touch storage.
- **Seed** (`src/data/seed`): 100 Turkish home recipes over a canonical ingredient catalog.
- **Supabase path**: `supabase/schema.sql` (draft, with RLS) and `docs/SUPABASE_MIGRATION.md`.
- Decisions and reasons: [DECISIONS.md](DECISIONS.md). Build log: [PROGRESS.md](PROGRESS.md).

## Known limitations

- **Not real security.** Accounts live in this browser's localStorage. Passwords are hashed with
  PBKDF2 + per-user salt only so they aren't stored in plain text; anyone with the device can read
  or change the data.
- "Multiplayer" works between tabs/windows of the **same browser profile**; different devices
  don't sync until a backend adapter exists.
- No photos by design (striped placeholders); recipe import from Instagram/links is a free-text
  source field, nothing is fetched.
- Reminders show inside the app; there are no push notifications.
- Households are capped at two people (the product's copy is built around "ikiniz").
- Clearing site data, private windows, or a full storage quota lose or block data; the app says so
  calmly, and Ayarlar › JSON olarak dışa aktar gives a backup.
