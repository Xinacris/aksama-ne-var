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
