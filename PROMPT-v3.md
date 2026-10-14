# Akşama Ne Var? — Round 3: monorepo, mobile app (Expo), Turkish + English

Rounds 1–2.2 built a Next.js web app with local storage behind repository interfaces (`src/data/repos.ts`, `LocalStorageAdapter`). This round turns the repo into a monorepo, builds the **iOS + Android app with Expo** on the same local-first data (no Supabase yet), and makes web and mobile **bilingual (Turkish + English)**, including recipe translation. 95 % of users will be on phones; the web app must keep working.

The owner is asleep and will not answer questions. Work through the night as far as you get, in priority order (section 4). Supabase integration is the next round — do not connect it now.

## 0. First: check where the last session stopped

1. Run `git status`, `git stash list`, `git log --oneline -10`, `git log origin/main..HEAD --oneline`. Read `CLAUDE.md`, `PROGRESS.md` (any `## In progress` section, any unchecked item), the end of `DECISIONS.md`, `docs/SUPABASE_MIGRATION.md`.
2. Check the latest production deploy: `gh api repos/{owner}/{repo}/commits/main/status`.
3. If anything is unfinished on `main`, finish it there under the existing push rule (lint + typecheck + test + build green) before starting this round, and record it in `PROGRESS.md`.
4. Write a short **"Where I found it"** note at the top of the Round 3 section in `PROGRESS.md`.

## 0.1 Operating rules

1. **Branch, not `main`.** Every push to `main` deploys production, and moving the web app into `apps/web` needs a Vercel setting the owner must change by hand (Root Directory). Do all Round 3 work on a branch `round-3`, push it often (Vercel preview deploys may fail until the setting changes — that is expected; note it, do not try to fix it by moving the web app back). **Never push Round 3 to `main` and never merge.** The owner merges after review.
2. Save this file as `PROMPT-v3.md` at the repo root. Append `## Round 3` to `PROGRESS.md` with the checklist in section 4 (V0…V9). Add one line to the top of `CLAUDE.md`: *"Round 3 spec is in PROMPT-v3.md; work on branch round-3; continue from the first unchecked V-item in PROGRESS.md."*
3. Never ask a question; log judgement calls in `DECISIONS.md` (decision + reason).
4. **Safe points:** after each finished V-item: all checks that exist for the touched packages green → commit → tick the item → push `round-3`. If you must stop mid-item, commit what is done and add a `## In progress` section at the end of `PROGRESS.md` (task, done, left as a checklist, findings). Never leave the branch in a state where `apps/web` does not build.
5. Do not run anything that needs an account or a login (EAS, Expo account, app stores, Vercel CLI writes, Supabase). No paid services. No new environment variables required for anything to work.
6. Keep the existing quality bar: TypeScript strict, tests for logic, axe checks on web, light + dark themes.

## 1. Monorepo

1. **npm workspaces** (keep npm and one root `package-lock.json`; add Turborepo only if it clearly helps running tasks — log the choice). Node 24.
   - `apps/web` — the current Next.js app, moved with `git mv` so history is kept. All its scripts, Playwright and Vitest configs keep working from inside `apps/web`.
   - `apps/mobile` — new Expo app.
   - `packages/core` — shared, **framework-free** TypeScript: `src/domain/**`, data models, repository interfaces, migrations, the LocalStorage adapter (rename to a key-value adapter that takes any `KeyValueStore`), seed recipes, zod schemas, the import parser, i18n message catalogs and design tokens (colours, spacing, radii, type scale as plain values). **No React, React DOM or React Native imports in core** (React versions differ between Next and Expo; core must not care). Server-only code (`src/server/**`, the import route) stays in `apps/web`.
   - Unit tests for moved code move with it (`packages/core`, Vitest). Root scripts run lint/typecheck/test across workspaces.
2. Root scripts: `npm run lint`, `typecheck`, `test`, `build` (web), `test:e2e` (web), `mobile` (starts Expo).
3. `vercel.json` / build: document in `docs/MONOREPO.md` exactly what the owner must set in Vercel (Root Directory `apps/web`, install command if needed) and verify locally that `cd apps/web && npm run build` works from a clean install.
4. Update `README.md`, `CLAUDE.md` notes for agents and `docs/SUPABASE_MIGRATION.md` paths.

## 2. Mobile app (Expo)

1. Latest stable Expo SDK, Expo Router, TypeScript. **Must run in Expo Go** (the owner tests on his phone with Expo Go tomorrow): use only Expo SDK modules that work in Expo Go — no custom native modules, no dev-client-only libraries tonight.
2. **App identity:** display name "Akşama ne var?" (Turkish) / a neutral English name chosen by you (log it). Bundle ID / package name must be **neutral and not Turkish-specific** — use a clear placeholder `com.PLACEHOLDER.mealplanner` and mark it in `docs/MOBILE.md` as a decision for the owner (it cannot change after the first store release).
3. **Data:** same models and repositories as web via `packages/core`. Storage: `@react-native-async-storage/async-storage`, wrapped as a `KeyValueStore` that hydrates into memory at startup and writes through (the adapter contract is synchronous). Same migrations. Password hashing: `src/lib/crypto.ts` uses Web Crypto — use `expo-crypto` on mobile behind a small interface in core. Local accounts and the demo household ("Örnek evle dene · Ali ve Zeynep") work on the phone. Two people on two phones will **not** sync yet — say so calmly in Ayarlar ("Eşitleme yakında") instead of showing a fake sync state.
4. **Design:** follow `design/*.dc.html` and the web app's look: same tokens from core, serif headings, warm palette, light + dark following the system with the same override as web. Native feel: bottom tabs (Bugün, Eşleş, Liste, Tarifler, Hafta — same order as web's bottom nav), native stack headers with back gestures, bottom sheets for quick add, safe areas, 44 pt touch targets, haptics on match and checklist ticks (`expo-haptics`), VoiceOver/TalkBack labels.
5. **Screens, in priority order** (stop at the end of the night wherever you are; each finished screen is useful on its own):
   1. Auth + onboarding (demo household, local sign-up/login, create/join household by code locally).
   2. Bugün (reminder, tonight's menu, leftovers, tomorrow).
   3. Tarifler: list with search and filter chips, recipe detail, quick add (link → import, name → one-tap save), full form with "Ayrıntılar" and Toplu yapıştır, favourites.
   4. Liste: shopping list grouped by aisle, check/uncheck, "evde var".
   5. Hafta: day list (no drag-and-drop on mobile; use "move to day" actions instead).
   6. Eşleş: swipe deck with match moment (`react-native-gesture-handler` + `react-native-reanimated`, both in Expo Go).
   7. Pişirme modu: steps, prep checklist, timers (keep screen awake with `expo-keep-awake`).
   8. Ayarlar: household, language, theme, leftovers setting, import usage line.
6. **Import on mobile:** call the web app's `/api/import` over HTTPS. Base URL from `EXPO_PUBLIC_API_URL`, defaulting to the production Vercel URL. Same draft review flow as web. Share-sheet import (receiving links from Instagram/TikTok) needs a development build — **out of scope tonight**; describe the plan in `docs/MOBILE.md`.
7. **Checks for mobile** (no emulator or device is assumed): `npx tsc --noEmit`, `npx expo-doctor`, `npx expo export --platform ios` and `--platform android` must succeed (catches bundling errors); component tests with `jest-expo` + `@testing-library/react-native` for each finished screen's main states. If an Android emulator happens to be available, smoke-test with it; otherwise do not try to install one.
8. `docs/MOBILE.md`: how to run on a phone with Expo Go (install, `npm run mobile`, scan QR; same Wi-Fi or `--tunnel`), what works, what does not yet (sync, share sheet, push notifications, store builds), and the store-release checklist for later (EAS, bundle ID, icons, privacy labels).

## 3. Turkish + English

1. **UI strings:** extract every user-facing string on web and mobile into message catalogs in `packages/core/i18n/{tr,en}.json` (nested keys by screen). Use **i18next** with `react-i18next` in both apps (one setup each, same catalogs). Plurals and interpolation via i18next, not string concatenation. Turkish stays the source of truth; write natural English, not literal translation (product tone: calm, warm, short).
2. **Locale choice:** device/browser language on first run (`tr` → Turkish, anything else → English), overridable in Ayarlar ("Dil / Language"), stored per user locally. Web keeps its current Turkish URL paths (no locale prefix tonight — log it). `<html lang>` follows the locale. Dates, weekday names and week start via `date-fns` locales (`tr`: Monday; `en`: Monday too, log it).
3. **Recipes in two languages:**
   - Data: a recipe keeps its language-neutral fields (times, servings, tags, image, leftovers) and gains `lang` (source language) plus `translations: { [locale]: { name, ingredients' display names, steps, notes, prep labels } }`. Add a migration (next version number) that sets `lang: "tr"` on existing recipes. Mirror the shape in `supabase/schema.sql` as a separate `recipe_translations` table (still an unwired draft) and update `docs/SUPABASE_MIGRATION.md`.
   - **The 100 built-in recipes get English translations now**, written by you into the seed data (natural dish names: keep well-known Turkish names with a short English hint where it helps, e.g. "Karnıyarık (stuffed aubergine)").
   - Ingredients: shopping-list merging and aisle grouping must keep working across languages — match on the existing catalog (`catalogMatch`) ids, not on display text. Aisle names are UI strings.
   - Units: Turkish kitchen units keep their meaning; in English show them as "1 cup (200 ml)" style where the Turkish unit has a fixed metric equivalent (su bardağı 200 ml, çay bardağı 100 ml, yemek kaşığı 15 ml, tatlı kaşığı 10 ml, çay kaşığı 5 ml — log the table), otherwise a translated unit name.
   - Showing recipes: if the recipe has a translation for the current locale, show it; otherwise show the original with a small "Çevir / Translate" action.
   - **Translate action:** new web route `/api/translate` using the same provider order as import (Gemini → Claude; send only recipe text and target language, never user or household data; same rate limiting). The result is saved into `translations[locale]` and editable. With no API key the action is hidden (not broken). Unit tests with mocked providers; privacy test like import's.
   - **Import from other languages:** the import prompt accepts captions in any language and returns the draft in the **user's current locale**, keeping `lang` = detected source language and the original caption text in the draft's source data. The rule-based parser stays Turkish-only: for non-Turkish text without an LLM, show the paste draft with a calm "Bu metni otomatik ayrıştıramadık, lütfen kontrol et" (and its English version).
4. Tests: a test that every key exists in both catalogs; no hard-coded user-facing Turkish left in components (a lint rule or a test that scans `apps/*/` for Turkish characters in JSX text, with an allowlist); web e2e runs the main journey once in English; mobile component tests render at least Bugün and Tarifler in both languages.

## 4. Phases (append to PROGRESS.md as V0…V9) — priority order

- V0. Where I found it; branch `round-3` created.
- V1. Monorepo: `apps/web` moved, `packages/core` extracted (framework-free), all existing web checks green from the new layout (lint, typecheck, unit, e2e, build); `docs/MONOREPO.md` with the Vercel setting.
- V2. Mobile skeleton: Expo app runs in Expo Go config, tabs + stacks, theme tokens, AsyncStorage key-value adapter, crypto interface, demo household loads; `expo export` for iOS and Android green.
- V3. i18n foundation: catalogs in core, i18next in web and mobile, language switch in Ayarlar, web strings extracted; key-parity test.
- V4. Mobile screens: auth/onboarding, Bugün, Tarifler (list, detail, quick add, form) — in both languages.
- V5. Recipe translations: data shape + migration, 100 built-in English translations, units display, schema/doc update.
- V6. `/api/translate` + Translate action (web and mobile); multi-language import; tests.
- V7. Mobile screens: Liste, Hafta, Eşleş.
- V8. Mobile screens: Pişirme modu, Ayarlar; `docs/MOBILE.md`.
- V9. Final: all checks green (web incl. e2e and axe, core, mobile tsc/expo-doctor/export/jest), screenshots for web in both languages, push `round-3`, and write the morning note.

## 5. Out of scope

Supabase connection, real-time sync between devices, push notifications, share-sheet import, EAS/store builds, admin panel and community recipes, CDN for images, monetization, merging to `main`.

## 6. Morning note

When you stop — finished or not — the last section of `PROGRESS.md` must be `## Sabah notu` written **in Turkish** for the owner, short:
1. What was finished (V-items) and what was left.
2. How to try the app on his phone right now (exact commands).
3. What he must do by hand: the Vercel Root Directory setting, choosing the bundle ID, reviewing and merging `round-3`.
4. Anything that surprised you or that he should decide.
