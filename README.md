# Akşama Ne Var?

A household meal planner for two people in Turkish homes: decide "what's for dinner" together by
swiping, plan the week as menus (çorba + ana yemek + yanında + salata), get a shared shopping list
generated from the plan, and get prep reminders at the right moment
("Akşama İzmir köfte var, kıymayı buzluktan çıkarmayı unutma."). No calories, streaks or guilt.

Round 2 added: **recipe import from a link** (Instagram Reels, YouTube Shorts, TikTok, recipe sites
— with a paste fallback), **leftovers as a choice** (per recipe, per household lunch habit, per
evening) and a real **cooking mode** (one step per screen, several timers at once, screen stays on).

Round 3 turned the repo into a monorepo with an **iOS + Android app (Expo)** on the same local-first
data, and made both apps **Turkish + English**.

**Live:** https://aksama-ne-var.vercel.app · **Morning demo script:** [DEMO.md](DEMO.md)

## Layout (npm workspaces)

| Path | What |
|---|---|
| `apps/web` | Next.js app (pages, components, server routes `/api/import`, `/api/translate`) |
| `apps/mobile` | Expo app (Expo Router, runs in Expo Go) — see [docs/MOBILE.md](docs/MOBILE.md) |
| `packages/core` | Framework-free TypeScript shared by both: models, repositories, migrations, key-value adapter, domain rules, import parser, seed recipes, store (zustand/vanilla), i18n catalogs, design tokens |

Vercel needs Root Directory `apps/web`: see [docs/MONOREPO.md](docs/MONOREPO.md).

## Run

```bash
npm install
npm run dev        # web, http://localhost:3000
npm run mobile     # Expo dev server; scan the QR code with Expo Go
```

Node 24 LTS (`.nvmrc`). No backend: everything is stored in the browser. **No environment variables
are required.** Optional server-side keys improve recipe import (details in [docs/IMPORT.md](docs/IMPORT.md),
template in [apps/web/.env.example](apps/web/.env.example)):

| Variable | Optional? | Effect |
|---|---|---|
| `GEMINI_API_KEY` | optional (recommended) | Gemini (free tier, `gemini-3.1-flash-lite`) turns a caption into a clean recipe draft; tried first |
| `GEMINI_MODEL` | optional | overrides the Gemini model |
| `ANTHROPIC_API_KEY` | optional | Claude (Haiku) as the fallback when Gemini is unset, over quota or fails |
| `YOUTUBE_API_KEY` | optional | reads full YouTube descriptions; without it only the title arrives and the paste box opens |

Without any LLM key a rule-based Turkish parser pre-fills the form.

Root scripts run across the workspaces (`npm run <script> -w @anv/web` etc. for one):

| Script | What it does |
|---|---|
| `npm run dev` / `build` | Next.js (web) |
| `npm run lint` / `typecheck` | ESLint and TypeScript in every workspace |
| `npm test` | Vitest in core (domain, data layer, store, seed, import parser) and web (routes, components); Jest (jest-expo) in mobile |
| `npm run test:e2e` | Playwright at 390×844 and 1440×900: two-member journey, board drag-and-drop, import, leftovers, cooking mode with timers, axe on every screen (builds and starts the app on port 3100) |
| `npm run screenshots` | Every screen at 390/1440 × light/dark into `apps/web/screenshots/` (`SHOTS=bugun,liste` to limit) |

## Phone app: what needs a native build

Expo Go (`npm run mobile`) runs everything except the parts below. They need a **development
build** (`eas build --profile development`, or `npx expo run:ios` / `run:android` on a machine with
Xcode / Android Studio) or the local APK (`npm run apk`). Details: [docs/MOBILE.md](docs/MOBILE.md).

| Feature | Expo Go | Native build |
|---|---|---|
| Timer tone in notifications (`timer_alarm.wav`) | default sound (expo-notifications logs "Custom sound … not found") | the app's tone |
| Android "Telefonun saatinde kur" (Clock app timer) | works | works |
| iOS 26+ "Telefonun saati" (AlarmKit) | — | only with `EXPO_PUBLIC_ENABLE_ALARMKIT=1` (below) |

### iOS: "Telefonun saati" / AlarmKit (off by default)

The local module `apps/mobile/modules/anv-alarmkit` is **not linked** unless the build is made with
`EXPO_PUBLIC_ENABLE_ALARMKIT=1`, so a default build never compiles its Swift. It has not been
compiled yet (it was written on Linux). For the first test build:

1. Xcode 26 or newer (the iOS 26 SDK), and an iPhone on iOS 26+ (the simulator has limited AlarmKit support).
2. Build with the flag, e.g. `EXPO_PUBLIC_ENABLE_ALARMKIT=1 npx expo run:ios --device` on a Mac, or
   on EAS set `"env": { "EXPO_PUBLIC_ENABLE_ALARMKIT": "1" }` in the development profile of `eas.json`
   (the variable must be present at prebuild time *and* in the JS bundle).
3. In the app: start a timer in cooking mode → iOS asks "allow alarms" → lock the phone with the
   silent switch on → it should ring with the app's tone. Ayarlar › Zamanlayıcı türü switches back
   to the app notification.
4. If the iOS build fails in `AnvAlarmKitModule.swift`, build without the flag (everything else works)
   and send the Xcode error.

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
  in `apps/web/src/app/globals.css` (light/dark/system, no flash), Young Serif + Figtree via `next/font`.
- **Data layer** (`packages/core/src/data`): zod models shaped like Postgres tables, repository interfaces
  (`repos.ts`), one implementation `KeyValueAdapter` over any synchronous `KeyValueStore`
  (localStorage on the web, an AsyncStorage-backed mirror on phones; one JSON array per table, schema
  version + migrations, corrupt-data quarantine, quota errors), a per-tab session, and a
  `SyncBus` (web: BroadcastChannel + `storage` events, `apps/web/src/data/browserBus.ts`) for live updates and presence.
- **Domain** (`packages/core/src/domain`): pure, unit-tested rules — list aggregation with unit conversion and
  pack rounding, "evde var" subtraction, prep scheduling, deck building and matching, rotation
  memory, leftovers, plan transitions (ate out, plan changed, swaps), summaries, Turkish copy.
- **Store** (`packages/core/src/store/app.ts`): a vanilla Zustand store over the repositories; each app binds it to React (`apps/web/src/store/app.ts`, `apps/mobile/src/store.ts`); components never touch storage.
- **Seed** (`packages/core/src/data/seed`): 100 Turkish home recipes over a canonical ingredient catalog.
- **Import** (`packages/core/src/domain/import`, `apps/web/src/server/import`, `/api/import`): source adapters over public
  endpoints only, schema.org reader, rule parser, optional Claude structuring with validation.
- **Cooking mode** (`/pisir/<date|recipe>`, `apps/web/src/components/cooking`): shared resumable session,
  timers stored as end timestamps, Screen Wake Lock.
- **Supabase path**: `supabase/schema.sql` (draft, with RLS) and `docs/SUPABASE_MIGRATION.md`.
- Decisions and reasons: [DECISIONS.md](DECISIONS.md). Build log: [PROGRESS.md](PROGRESS.md).

## Known limitations

- **Not real security.** Accounts live in this browser's localStorage. Passwords are hashed with
  PBKDF2 + per-user salt only so they aren't stored in plain text; anyone with the device can read
  or change the data.
- "Multiplayer" works between tabs/windows of the **same browser profile**; different devices
  don't sync until a backend adapter exists.
- No photos by design (striped placeholders); the import card shows the platform's own thumbnail only.
- Instagram does not share captions with third parties, so Instagram imports always use the paste
  box. iOS Safari has no Web Share Target: on iPhone, paste the link.
- The daily limit on smart imports (30 per household) lives in server memory until the Supabase move.
- Reminders show inside the app; there are no push notifications.
- Households are capped at two people (the product's copy is built around "ikiniz").
- Clearing site data, private windows, or a full storage quota lose or block data; the app says so
  calmly, and Ayarlar › JSON olarak dışa aktar gives a backup.
