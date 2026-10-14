# PROGRESS — Akşama Ne Var?

Resume: continue from the first unchecked item. Spec: PROMPT.md. Decisions: DECISIONS.md.

Deploy: https://aksama-ne-var.vercel.app (Vercel production alias; verified 200 after commit 8b92179). Check status with `gh api repos/Xinacris/aksama-ne-var/commits/main/status`.

## Phases
- [x] 1. Scaffold Next.js + TS + lint/format + Vitest + Playwright at the repo root; tokens, fonts, theme switch; first push to `main` (first Vercel deploy).
  - Theme toggle lives in `src/hooks/useTheme.ts`; UI for it lands in Settings (phase 13).
- [x] 2. Data layer: models, repo interfaces, LocalStorageAdapter, migrations, cross-tab sync bus + tests.
- [x] 3. 100-recipe seed + validation tests.
- [x] 4. Domain logic (list, prep tasks, matching, rotation, leftovers) + unit tests.
- [x] 5. Auth + households + invite/join + protected routes + tests.
- [x] 6. Shared component library ported from `Componentler.dc.html` + component tests.
  - `src/components/ui/*` (Button, Field, Avatar, Chip, Misc: SyncIndicator/ActivityLine/EmptyState/PhotoPlaceholder/Notice), `MenuCard`, `ReminderBanner`, `AppShell` (bottom + top nav).
- [x] 7. Onboarding 1 & 2.
- [x] 8. Bugün.
- [x] 9. Eşleş + match moment.
- [x] 10. Hafta (desktop board + mobile list, drag-and-drop).
- [x] 11. Liste (pazar/market, aisles, live sync, finish).
- [x] 12. Tarif detayı + recipe browser + add/edit recipe.
- [x] 13. Settings, activity feed, demo seed matching the design's sample data, export/reset.
- [x] 14. E2E journeys + axe, both viewports.
- [x] 15. Visual review passes with screenshots; fix drift.
  - Two passes over Bugün, Eşleş (+ match moment), Liste, Tarif, Hafta, Onboarding at 390/1440 × light/dark. Fixes: reminder banner keeps the done state, Yarın line capped at 3 dishes, menu time = longest + 5 min, plan-change button padding, form overflow at 390, AA contrast for sand text.
- [x] 16. Supabase draft schema + migration doc.
- [x] 17. Final: all scripts green, `npm run build` passes, README, `DEMO.md`, final commit and push, deployment status checked.
  - All green at commit 7785d64: lint 0 issues, typecheck 0 errors, 197 unit/component tests, 21 e2e (journey ×2, board DnD, axe light/dark ×2), build OK. Vercel status `success`; live smoke test (demo login → Bugün → Liste) passed on production.

DONE — live: https://aksama-ne-var.vercel.app · local: npm install && npm run dev
Demo accounts: ali@demo.ev / zeynep@demo.ev · password demo1234 (or "Örnek evle dene · Ali ve Zeynep" on the login page)

## Round 2

Spec: PROMPT-v2.md. Continue from the first unchecked R-item.

- [x] R1. Read the codebase; plan data-model changes in DECISIONS.md; storage migration scaffold + tests.
- [x] R2. Import domain: URL detection, adapters (TikTok, YouTube, Instagram, schema.org web), rule-based parser + fixtures.
- [x] R3. Import server route: Claude Haiku path with validation/retry, graceful no-key mode, rate limit, tests.
- [x] R4. Import UI: "Linkten ekle", paste fallback, draft review in existing form, source credit, share target manifest; e2e.
- [x] R5. Leftover model: recipe defaults (data for the 100 recipes), household lunch setting, migration, rule tests.
- [x] R6. Leftover UI: Bugün card overrides, "dolapta" items, drag into Hafta, shopping list skip; e2e.
- [x] R7. Cooking mode core: route, prep checklist, steps, dish tabs, resume; tests.
- [x] R8. Cooking mode extras: multiple timers with persistence, wake lock, sync/activity, finish screen → leftover question; e2e.
- [x] R9. Final: Supabase schema + migration doc updated, docs/IMPORT.md, BACKLOG.md, DEMO.md, screenshots checked, all scripts green, push, check Vercel status.
  - Schema parsed with libpg-query (86 statements OK); migrations v3–v5 tested old shape → new shape, plus v1 → current read-back through the adapter.
  - Green before the final push: lint 0, typecheck 0, 381 unit/component tests (35 files), 32 e2e passed (4 desktop-only skipped on mobile): journey ×2, board DnD, import ×2, leftovers, cooking with fake-clock timers + reload, axe light/dark incl. import and cooking screens; build OK.
  - Production checks (no env vars set): `/api/import` paste → rules draft; YouTube oEmbed title-only → paste note; TikTok oEmbed live (author read); Instagram → paste path; private host refused. Browser: leftover choice + undo, Dolapta, cooking mode tabs/steps, timer survives reload, Wake Lock API present, Instagram paste → draft → save → credit.

ROUND 2 DONE — live: https://aksama-ne-var.vercel.app
ANTHROPIC_API_KEY — required only for smart import (Claude Haiku turns captions into clean drafts); without it the rule-based Turkish parser pre-fills the draft. The app works fully without it.
YOUTUBE_API_KEY — optional: full YouTube descriptions; without it only the video title arrives and the paste box opens. The app works fully without it.

## Round 2.1

Spec: PROMPT-v2.1.md. Continue from the first unchecked P-item.

- [x] P1. Provider interface; move the Claude implementation behind it; shared prompt + validator; existing tests green.
  - `src/server/llm/{types,prompt,validate,claude,index}.ts`; `src/server/import/llm.ts` removed. Response gains `provider`; `importLog.path` → `provider` (migration v6 + test, schema.sql + SUPABASE_MIGRATION.md).
- [x] P2. Gemini implementation with structured output; selection order and fall-through; unit + privacy tests.
  - `src/server/llm/gemini.ts` (REST `generateContent`, `responseSchema` from the shared JSON Schema). `tests/unit/import/providers.test.ts`: selection ×4, Gemini request shape + model override, shared prompt/validator, fall-through on 429 / RESOURCE_EXHAUSTED / invalid JSON (one retry) / timeout / 503, overall deadline, no caption in logs, privacy body check. 404 tests green.
- [x] P3. Ayarlar usage line with provider split; docs/IMPORT.md and .env.example updated.
  - "Bu ay N tarif içe aktarıldı (x Gemini, y Claude, z kural)." (`src/domain/import/usage.ts`, component test). IMPORT.md: provider order, fall-through, env vars, AI Studio key, free-tier data note, adding a provider. `.env.example` (un-ignored), README env table, DEMO note.
- [x] P4. Final: all scripts and e2e green, push, check Vercel status.
  - Green before the final push: lint 0, typecheck 0, 404 unit/component tests (36 files), 32 e2e passed (4 desktop-only skipped on mobile), build OK. Vercel status `success` at eff73bc.
  - Production checks (no env vars set): `/api/import` paste → `provider: "rules"`, `llmAvailable: false`; Instagram → paste path. Browser: an old v5 `importLog` row with `path: "llm"` migrates to v6 and Ayarlar reads "Bu ay 2 tarif içe aktarıldı (1 Claude, 1 kural)." after a new paste import.

ROUND 2.1 DONE — live: https://aksama-ne-var.vercel.app
Add GEMINI_API_KEY in Vercel to make import free; ANTHROPIC_API_KEY is now an optional fallback.

## Follow-ups after Round 2.1 (2026-10-13)

- [x] Cooking mode: "Başlamadan önce · N eksik" only when something is missing (prep-ahead not done, ingredients neither bought nor evde var), Evde var / Listeye ekle, "Yine de başla"; otherwise straight to step 1. "Malzemeler" sheet in the step view. Timing label "Pişirmeden 1 sa önce" everywhere. Button reads "Başla" once nothing is missing (screen stays).
- [x] Leftovers never guessed: new, imported and the 100 built-in recipes default to "Artmaz / hepsi biter" (built-ins keep their shelf life as `KEEP_DAYS`), migration v7; Afiyet olsun starts on "Hiç kalmadı"; "Artarsa ne olur?" is a chip radio group, "Kaç gün içinde" only for Saklanır.
- [x] Dark mode selects: token colours on select/option (chosen option olive-soft), `color-scheme` per theme; `e2e/selects.spec.ts` checks every select in four theme modes; `tarif-yeni-select` screenshot; axe on the form's Saklanır state.
- [x] Import draft quality: Kaynak always filled ("YouTube · Yemek.com") on every path incl. paste fallback, thumbnail stored; vocabulary tags (LLM fields + rule keywords, unknown values dropped); Pişirme = heat only, new Bekleme (`waitMinutes`, migration v8), gentle "Süre uzun görünüyor, kontrol et" hint; fixtures 13–15.
  - Green before push: lint 0, typecheck 0, 429 unit/component tests, 44 e2e passed (4 desktop-only skipped on mobile), build OK.
- [x] Import quality (Yemek.com video with junk steps): cause was Gemini timing out (default thinking, 7 s budget) → rules parser took the description's link list as steps. Now: provider failures logged/returned with status codes; Gemini thinking minimal, 503 retried, 25 s deadline; "yazılı tarif" links followed (schema.org → provider `web`, `writtenRecipeUrl`, migration v9); nested JSON-LD ingredient lists read; boilerplate stripped before structuring and never a step; no-steps hint. 452 unit/component tests, 48 e2e, build OK.
- [x] Import quality wrap-up (handoff note from 759469d folded in here): nothing functional was pending. Open, owner's call: Gemini latency (5–10 s, 503s on Google's side) — try another `GEMINI_MODEL` or set `ANTHROPIC_API_KEY` as fallback. Two component tests (cooking-extras timer, "Başlamadan önce") flaked once each under full-suite load; harden if they flake again.

## Round 2.2

Spec: PROMPT-v2.2.md. Continue from the first unchecked M-item.

**Where I found it (2026-10-14):** working tree clean, no stash. `main` was one commit ahead of `origin/main` (759469d, a docs-only `## In progress` handoff for the import quality task). That note listed everything done and pushed through 73714d7; what was "left" was only the chat report and two optional owner decisions, so nothing was reverted or re-done — the note is folded into "Follow-ups after Round 2.1" above and the section removed. Production deploy of 73714d7: Vercel `success`.

- [x] M0. Checked where the last session stopped; unfinished work finished or reverted; "Where I found it" note written.
- [x] M1. Tarifler tab in the bottom nav; active states; 360/390 px checks; component test.
  - Fifth tab between Liste and Hafta (`IconBook`), lit for `/tarifler/*` and `/tarif/*`. `tests/component/nav.test.tsx` (16 tests at 360/390); `e2e/recipes-mobile.spec.ts` measures the tabs at 360/390 in a real browser.
- [x] M2. Quick-add sheet (URL → import, name → one-tap save → detail with "Ayrıntıları ekle"); search empty state uses it; tests.
  - `src/domain/quickAdd.ts` + `src/components/QuickAdd.tsx` (`useQuickAdd`, `QuickAddSheet` on the existing `Dialog`). Tests: `tests/unit/domain/quickAdd.test.ts`, `tests/component/quickadd.test.tsx`, 3 mobile e2e in `e2e/recipes-mobile.spec.ts`.
- [x] M3. Collapsible "Ayrıntılar" in the full form (new + edit); existing form tests green.
  - `filledSections` / `initialOpen` / summaries in `src/services/recipeForm.ts`; `RecipeForm` `openFilled` (false only for a blank new recipe). Unit + component tests; a11y/leftovers/selects/journey/import e2e green (31 passed).
- [x] M4. Toplu yapıştır for ingredients and steps; multi-line paste offer; unit + component tests.
  - `src/services/bulkPaste.ts` (`ingredientsFromLines`, `stepsFromLines`), `ingredientRow` shared with import. `tests/unit/bulkPaste.test.ts`, 5 component tests in `tests/component/tarif.test.tsx`, mobile e2e "Toplu yapıştır fills 5 ingredients".
- [x] M5. Final: e2e (mobile + desktop), axe light/dark, screenshots checked, all scripts green, push, check Vercel status.
  - Green before the final push: lint 0, typecheck 0, 510 unit/component tests (43 files), build OK, e2e 55 passed / 11 skipped (4 desktop-only on mobile, 7 phone-only on desktop). Axe (light + dark, both projects) adds the quick-add sheet, a name-only recipe and the bulk-paste/split-offer state. `npm run screenshots` adds `tarifler-hizli-ekle`, `tarifler-hizli-ekle-link` (viewport shots of the sheet), `tarifler-hizli-kaydedildi`, `tarif-yeni-toplu`; every phone shot shows the five-tab nav. Checked by eye at 390 light/dark and 1440 light/dark.

Vercel status `success` at d7712e7 (and at every M-phase push: ccb31bb, a2e5cbe, a48bbf0, c2bdb8f).

ROUND 2.2 DONE — live: https://aksama-ne-var.vercel.app

## Round 3

Spec: PROMPT-v3.md. Work on branch `round-3` (never `main`). Continue from the first unchecked V-item.

**Where I found it (2026-10-14):** `main` clean and in sync with `origin/main` (62282f9, "PROGRESS: Round 2.2 done"), no stash, no `## In progress` section, no unchecked items. Production deploy of 62282f9: Vercel `success`. Nothing to finish on `main`; branch `round-3` created from 62282f9.

- [x] V0. Where I found it; branch `round-3` created.
- [x] V1. Monorepo: `apps/web` moved, `packages/core` extracted (framework-free), all existing web checks green from the new layout (lint, typecheck, unit, e2e, build); `docs/MONOREPO.md` with the Vercel setting.
  - Green: lint 0 (core + web), typecheck 0, core 326 + web 184 = 510 tests (same as before the move), build OK, e2e 55 passed / 11 skipped. Clean-copy `cd apps/web && npm ci && npm run build` OK.
- [x] V2. Mobile skeleton: Expo app runs in Expo Go config, tabs + stacks, theme tokens, AsyncStorage key-value adapter, crypto interface, demo household loads; `expo export` for iOS and Android green.
  - `apps/mobile` (Expo SDK 57, RN 0.86.3). `expo export` iOS + Android OK, `expo-doctor` 21/21, `tsc` 0, `expo lint` 0, jest 4 (AsyncStorage hydrate/write-through/restart, PBKDF2 parity with Web Crypto, demo household boots and survives a restart). Tokens + icons in core (token/CSS parity test). Whole repo on React 19.2.3; web unit/build/e2e smoke green.
- [x] V3. i18n foundation: catalogs in core, i18next in web and mobile, language switch in Ayarlar, web strings extracted; key-parity test.
  - 882 keys per language. Core 338 tests (catalog parity, runtime switch, detection, hard-coded-Turkish scan), web 184, mobile 4; lint 0; build OK; e2e 55 + 2 passed (new `e2e/english.spec.ts`: English browser → English UI, quick add, Settings › Türkçe and back, remembered on reload).
- [x] V4. Mobile screens: auth/onboarding, Bugün, Tarifler (list, detail, quick add, form) — in both languages.
  - Giriş/Kayıt, onboarding (set up or join by code → dishes → invite code), Bugün, Tarifler (search, course/tag chips, favourites, quick-add sheet), recipe page (statuses, prep timeline, steps, put on an evening, edit/copy/delete), full form (Ayrıntılar, Toplu yapıştır, paste offer), import via `/api/import`, Ayarlar. Mobile jest 15 (Bugün and Tarifler in tr + en), tsc 0, expo lint 0, export iOS/Android OK, expo-doctor 21/21; core 338, web 184.
- [x] V5. Recipe translations: data shape + migration, 100 built-in English translations, units display, schema/doc update.
  - `lang` + `translations` (migration v10), 100 built-ins in English (466 steps, 27 prep labels, 20 notes), 109 catalog ingredients + tags in English, localized store copies (`recipes`/`rawRecipes`, translated prep-task labels, list-row labels), edit-in-language rules (`draftForEdit`/`mergeEdit`), English units ("1 cup (200 ml)"). Supabase `recipe_translations` + `profiles.locale` + doc §7. Core 352, web 184, mobile 15; e2e English/journey/import green.
- [ ] V6. `/api/translate` + Translate action (web and mobile); multi-language import; tests.
- [ ] V7. Mobile screens: Liste, Hafta, Eşleş.
- [ ] V8. Mobile screens: Pişirme modu, Ayarlar; `docs/MOBILE.md`.
- [ ] V9. Final: all checks green (web incl. e2e and axe, core, mobile tsc/expo-doctor/export/jest), screenshots for web in both languages, push `round-3`, and write the morning note.
