# Akşama Ne Var? — Overnight build: design → working demo

You are building, unattended and overnight, a working prototype of **"Akşama Ne Var?"**, a multiplayer household meal planner for Turkish homes (couples / housemates). The owner will start you, go to sleep, and expects a running, tested demo on waking. Nobody will answer questions. Decide, log the decision, keep going.

---

## 0. FIRST THING EVERY SESSION (resume protocol)

This job will likely span several sessions (usage limits, context resets). Before doing anything else:

1. If `PROGRESS.md` exists at the repo root, read it, plus `DECISIONS.md`, and continue from the first unchecked item. Do not restart or re-scaffold.
2. If it does not exist, this is the first session: create `PROGRESS.md` (the full phase checklist from section 5), `DECISIONS.md`, and a `CLAUDE.md` containing exactly this instruction at the top: *"Before any work, read PROGRESS.md and DECISIONS.md and continue from the first unchecked item. The full spec is in PROMPT.md."* The git repo already exists (cloned from GitHub); work on `main`.
3. Work in small, finished increments. After each one: run the relevant tests, tick the item in `PROGRESS.md`, add a one-line note under it if anything is non-obvious, and `git commit`. Never leave the tree in a broken state for more than one commit. If a session dies mid-task, the next one must be able to pick up from git + `PROGRESS.md` alone.
4. Never ask the user a question. When something is ambiguous, pick the option most faithful to the design and the product intent below, write it in `DECISIONS.md` (one line: decision + reason), and move on.

---

## 0.1 DEPLOYMENT (GitHub → Vercel)

- This repo already exists on GitHub and is already imported into Vercel with Git integration: **every push to `main` triggers a production deploy**. You do not need the Vercel CLI or a Vercel token; do not try to log in to Vercel.
- `PROMPT.md` and `design/` are already committed. Scaffold the Next.js app **at the repo root** (not in a subfolder) so Vercel's Next.js preset works without configuration. Do not delete `PROMPT.md` or `design/`.
- Pin Node in `package.json` `engines` (and `.nvmrc`) to the current LTS. Commit the lockfile.
- **Push rule**: commit after every finished increment; `git push origin main` after every finished phase, and only when `npm run lint && npm run typecheck && npm test && npm run build` pass locally (the build must succeed exactly as Vercel runs it). A red build on `main` means a broken live demo. Push the scaffold at the end of phase 1 so the first deploy happens early.
- Do not run Playwright or any dev-only step in the build script. Keep e2e as a separate `test:e2e` script.
- The app is fully client-side with localStorage, so it must work on Vercel with no environment variables. Make sure nothing reads `window`/`localStorage` during server rendering (guard client-only code; avoid hydration mismatches, including the theme).
- If `gh` is authenticated, after the final push check the commit status (`gh api repos/{owner}/{repo}/commits/main/status`) to see whether the Vercel deployment succeeded, and note the deployment URL in `PROGRESS.md`. If you cannot see it, write the expected URL pattern and say it was not verified.
- If a push is rejected (auth or network), do not stop: keep working and committing locally, note it at the top of `PROGRESS.md`, and retry the push at the next phase boundary.

---

## P — PURPOSE

The product is **not** a recipe app. It is household coordination: two people deciding "what's for dinner" together with zero friction, a shared shopping list, and reminders at the right moment (e.g. "Akşama köfte var, kıymayı buzluktan çıkarmayı unutma"). Tone: warm, calm, home-like, never judgmental. **No calories, macros, streaks, badges, or guilt.** A dinner is a **menu** (çorba + ana yemek + yanında + salata/meze), not a single recipe.

Deliverable: a Next.js app that runs with `npm install && npm run dev`, where a person can sign up, onboard, invite a partner (simulated in the same browser), match on dishes, plan the week, get a generated shopping list, follow prep reminders, open recipes, and mark days as eaten out — all persisted in localStorage, all covered by tests, all visually faithful to the design.

## R — RULES

**Design fidelity (high priority)**
- The design source is in `./design/` as `.dc.html` files (a component-page format: markup inside `<x-dc>`, `{{holes}}`, `<sc-for>`, `<sc-if>`, and a `class Component extends DCLogic` script with sample data and interactions). They do not run outside their editor. Treat them as the **exact visual and behavioral spec**: read every file fully before writing UI. Port markup, spacing, radii, font sizes, colors, copy, and the interactions in each `renderVals()` / handler into real React components.
- Screens: `Main.dc.html` (Mobile · Bugün), `Bugun-Koyu.dc.html` (same, dark), `Eslesme.dc.html` + `Eslesme-Eslesti.dc.html` (Match + match moment), `Alisveris.dc.html` (Shopping, market mode), `Tarif.dc.html` (Menu / recipe detail), `Haftalik-Plan.dc.html` (Web · Weekly plan board), `Onboarding-1.dc.html` / `Onboarding-2.dc.html` (Web onboarding), `Componentler.dc.html` (shared component language, light + dark). `canvas.json` lists sizes and titles.
- Design tokens (copy exactly, as CSS custom properties, light + dark):
  - Light: `--bg #F4ECDF; --surface #FFFAF2; --surface2 #EDE2CF; --ink #2A2119; --ink2 #685846; --line #E0D1BA; --tomato #B33A25; --on-tomato #FFFFFF; --tomato-soft #F5DCD2; --olive #55612A; --olive-soft #E2E5CB; --sand #8A6630; --sand-soft #F0E1C2`
  - Dark: `--bg #1B1612; --surface #261F19; --surface2 #30281F; --ink #F2E8D9; --ink2 #B8A68E; --line #3A3027; --tomato #E5735B; --on-tomato #1B1612; --tomato-soft #3B241D; --olive #B3BF78; --olive-soft #2B2F1E; --sand #D8B57C; --sand-soft #362C1E`
  - Avatar colors: Ali/first member `#55612A`, Zeynep/second member `#9A5512` (assign per member in join order).
  - Fonts: **Young Serif** (headings, 400) and **Figtree** (400–700, body) via `next/font/google`.
  - Image placeholder: the `.ph` diagonal-stripe pattern on `--sand-soft` with a "Fotoğraf · <dish>" pill. Do **not** fetch or hotlink food photos from the web.
  - Icons: inline stroke SVGs as in the design (copy the paths). No emoji, no icon library that changes the look.
- Screens not designed (login/sign-up, settings, recipe browser, add-recipe form, desktop versions of mobile screens, mobile version of the weekly board): derive them strictly from the existing component language (cards, chips, banners, buttons, empty state in `Componentler.dc.html`). They must look like they belong.
- Responsive: mobile-first at 390px with the 4-tab bottom nav (Bugün / Eşleş / Liste / Hafta) exactly as designed; at ≥1024px use a desktop layout (top or side nav, max-width containers), with the weekly board as designed at 1440px. Theme: light / dark / system, toggle in settings, no flash on load.
- UI language: Turkish everywhere. Use `toLocaleLowerCase('tr')` / `localeCompare(…, 'tr')` for search and sort. Dates via `Intl` with `tr-TR`. In code and comments use the English term "component".
- Accessibility as in the design: real `<button>`/`<a>`/`<label>`, `aria-pressed`, `aria-current`, `role="status"`, touch targets ≥ 44px, `prefers-reduced-motion` respected, swipe also doable with buttons and keyboard (←/→).

**Engineering**
- Stack: Next.js (App Router, latest stable) + TypeScript strict + React. Styling: CSS Modules or Tailwind configured to the tokens above — your choice, log it. State: a small store (e.g. Zustand) over the repository layer. Validation: zod. Dates: date-fns with `tr` locale.
- **Persistence must be swappable.** All reads/writes go through repository interfaces in `src/data/` (e.g. `AuthRepo`, `HouseholdRepo`, `RecipeRepo`, `PlanRepo`, `ShoppingRepo`, `PrepTaskRepo`, `SwipeRepo`, `ActivityRepo`). Implement one adapter: `LocalStorageAdapter`. UI and store code must never touch `localStorage` directly. Model entities like future Postgres tables (uuid ids, `household_id`, `created_at`/`updated_at`, `created_by`). Version the storage schema and add a migration runner. Also write `supabase/schema.sql` (tables, FKs, RLS policy sketches) as an unwired draft that mirrors the models, plus `docs/SUPABASE_MIGRATION.md` explaining how to add a `SupabaseAdapter`.
- Auth (local, demo-grade): email + password sign-up / log-in / log-out, session persisted, protected routes redirect to login. Hash passwords with Web Crypto (PBKDF2 or SHA-256 + per-user salt). Clearly mark in README that this is not real security.
- **Multiplayer simulation**: households have an invite code/link (`/ev/<code>`). A second account in the same browser can join via that link. Open two tabs logged in as different members (support a per-tab session, e.g. sessionStorage holds the active user id while data lives in localStorage) and changes must appear live in the other tab via `BroadcastChannel` + `storage` events. This is what powers "Zeynep de markette", the "az önce" highlight, partner activity lines and the "Canlı / Eşitleniyor" sync indicator.
- No backend, no external APIs, no network calls at runtime besides Google Fonts via next/font.
- Keep `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build` all green at the end.

## I — INTERFACE (features that must work end-to-end)

1. **Auth & onboarding**: sign up → Onboarding 1 ("Evde en sık yaptığınız yemekler hangileri?", searchable grouped chips from the recipe DB, "“x” olarak ekle" for unknown names creating a stub recipe) → Onboarding 2 (invite link with Kopyala/Kopyalandı, "WhatsApp ile gönder" opening a `wa.me` share URL with the message from the design, "Şimdilik tek başıma başla"). Log in / log out. Joining via invite link skips household creation and shows the inviter's favorites.
2. **Bugün (Today)**: date header, member avatars, sync indicator; today's top reminder banner from prep tasks (Bekliyor ↔ "<name> tamamladı · HH:MM", undo); partner's latest activity line; tonight's menu card with per-dish times and approval state ("Zeynep'in onayı bekleniyor" / "İkiniz de onayladınız", with an approve action); leftover card when yesterday's dish was marked as having leftovers; "Bugün dışarıda yedik" and "Plan değişti" (move menu to tomorrow / back to matches; ingredients stay on the list; neutral copy from the design); tomorrow preview; empty state when nothing is planned.
3. **Eşleş (Match)**: per-household deck of candidate dishes for a chosen day/slot, built from favorites + rotation (dishes not made recently first). Each member swipes independently (drag/swipe gesture + buttons + keyboard); partner's progress shown but their choices hidden. When both like the same dish → match moment screen ("İkiniz de <dish> dediniz!") → "<Gün> akşamına koy" adds it to the plan and its missing ingredients to the list; "Kaydırmaya devam". Matches list is reusable in the weekly board.
4. **Hafta (Weekly plan)**: 7-day board, each day with slots Çorba / Ana yemek / Yanında / Salata; drag-and-drop from the right panel ("Eşleşmelerden", "Sık yaptıklarınız") and between days (use dnd-kit or similar, keyboard accessible); remove/replace; leftover extension shown as a visual link into the next day; "dışarıda yedik" day rendered neutrally; summary bar (planned days, list item count, this week's freezer items); week navigation. On mobile, an equivalent stacked day list.
5. **Liste (Shopping)**: auto-generated from the week's planned dishes, aggregating quantities across recipes and minus items marked "evde var"; Pazar vs Market tabs with counts (`x/y`); Market grouped by aisle (Kasap, Süt ve kahvaltılık, Bakliyat ve kuru gıda, …), Pazar by Sebze/Meyve/Yeşillik; each row shows the "for which dish" tag; tapping checks it with the member's avatar; the other tab shows it highlighted "<name> aldı · az önce"; manual add (+); "Alışverişi bitir" (bought items move to pantry/"evde var", unbought remain).
6. **Tarif / Menü detayı**: menu components; ingredients with status (evde var / listede / eksik → add to list); "Ön hazırlık" timeline (e.g. "Sabah: kıymayı çöz", "1 saat önce: patlıcanları tuzla") which generates the prep-task reminders for the planned day; numbered steps; servings scaler; source field ("Instagram'dan içe aktarıldı" style, free text); "en son X önce yaptınız".
7. **Recipes**: browse/search/filter by course (çorba, ana yemek, yanında, salata/meze, kahvaltı, tatlı) and tags; add/edit a custom recipe (name, course, time, servings, ingredients with qty/unit/aisle/pazar-market, prep items with offset, steps, source).
8. **Settings**: profile (name, avatar initial), household (members, invite link, leave), theme, "Demo verisini yükle" (seeds a sample household with Ali & Zeynep and a populated week, exactly matching the design's sample data), export JSON, reset all data.
9. **Activity feed**: every meaningful action logs an activity ("Ali Perşembe'ye tavuk sote ekledi · dün") used on Today and in a small feed view.
10. **Rotation memory**: cooking history per dish drives "en son 3 hafta önce yaptınız" and deck ordering.

## S — STRUCTURE

**Recipe database — 100 recipes**, in `src/data/seed/recipes.ts` (or JSON), typed and zod-validated at load:
- The 100 best-known, most commonly cooked **Turkish home dishes**, weighted to how people actually eat dinner: ~15 çorba, ~40 ana yemek (etli, tavuklu, zeytinyağlı, bakliyat, fırın), ~15 yanında (pilavlar, makarna, börek), ~15 salata/meze, ~10 kahvaltı/tek tabak (menemen, sucuklu yumurta…), ~5 tatlı. Must include every dish named in the design (mercimek çorbası, ezogelin, tarhana, yayla, karnıyarık, izmir köfte, kuru fasulye, etli nohut, taze fasulye, imam bayıldı, mantı, fırın makarna, tavuk sote, patates oturtma, türlü, menemen, pirinç/bulgur/şehriyeli pilav, cacık, çoban salata, piyaz, gavurdağı, haydari…).
- Each recipe: id, name, course, prep+cook minutes, servings, tags (e.g. "Fırında", "Akşamdan ıslat", "Ertesi güne artar", "Zeytinyağlı"), ingredients (name, quantity, unit, `side: 'pazar'|'market'`, aisle), prep items (label + offset like `morning` / `-60min` / `night-before`), 4–10 steps, `leftoverFriendly`, `freezerItem` (for the "buzluktan çıkacaklar" summary), optional source.
- Write the steps **in your own words** from general culinary knowledge; do not copy text from any website or book. Quantities must be realistic for a 2–4 person household.
- Normalize ingredient names so the shopping list aggregates correctly (one canonical "Kıyma", "Domates", "Sivri biber"…).

Suggested layout (adjust and log if you find better):
```
src/app/           routes: (auth)/giris, (auth)/kayit, onboarding/[1|2], ev/[code], bugun, eslesme, liste, hafta, tarif/[id], tarifler, ayarlar
src/components/    ui primitives + feature components (MenuCard, DishChip, Avatar, ActivityLine, SyncIndicator, ReminderBanner, EmptyState, BottomNav, SwipeDeck…)
src/data/          models.ts, repos (interfaces), adapters/localStorage, migrations, seed/
src/domain/        pure logic: list generation & aggregation, prep-task scheduling, deck building & matching, rotation, leftovers
src/store/         client store wired to repos + cross-tab sync
tests/unit, tests/component, e2e/
```

## M — MOTION (build order, tests at every layer)

Test every layer, not just the happy path:
- **Unit (Vitest)**: all of `src/domain` (aggregation incl. unit merging, "evde var" subtraction, prep schedule times, matching rules, deck ordering, leftover carry-over, ate-out/plan-changed transitions), repositories + LocalStorageAdapter (CRUD, migrations, corrupt/missing storage, quota error), auth (hashing, wrong password, duplicate email), seed validation (exactly 100 recipes, all valid, unique ids, every design dish present).
- **Component (Vitest + Testing Library)**: each feature component's states (empty, loading, partner-done, matched, dark theme renders tokens).
- **E2E (Playwright, mobile 390×844 and desktop 1440×900 projects)**: full journeys — sign up → onboarding → invite → second user joins in a second page of the same context → both swipe → match → put on plan → list generated → user A checks item, user B's page shows it live → finish shopping → Today shows reminder → complete/undo → ate out → plan changed → recipe detail → add custom recipe → log out/in persists data → reset data. Run axe accessibility checks on every main screen.
- **Visual self-review**: write a Playwright script that screenshots every screen at 390 and 1440 in light and dark into `screenshots/`. Look at them (read the PNGs) side by side with the corresponding `.dc.html` source and fix spacing/typography/color drift. Do at least two review passes on Bugün, Eşleş, Liste, Tarif, Hafta, Onboarding.

---

## 5. PHASES (copy into PROGRESS.md as a checklist)

1. Scaffold Next.js + TS + lint/format + Vitest + Playwright at the repo root; tokens, fonts, theme switch; first push to `main` (first Vercel deploy).
2. Data layer: models, repo interfaces, LocalStorageAdapter, migrations, cross-tab sync bus + tests.
3. 100-recipe seed + validation tests.
4. Domain logic (list, prep tasks, matching, rotation, leftovers) + unit tests.
5. Auth + households + invite/join + protected routes + tests.
6. Shared component library ported from `Componentler.dc.html` + component tests.
7. Onboarding 1 & 2.
8. Bugün.
9. Eşleş + match moment.
10. Hafta (desktop board + mobile list, drag-and-drop).
11. Liste (pazar/market, aisles, live sync, finish).
12. Tarif detayı + recipe browser + add/edit recipe.
13. Settings, activity feed, demo seed matching the design's sample data, export/reset.
14. E2E journeys + axe, both viewports.
15. Visual review passes with screenshots; fix drift.
16. Supabase draft schema + migration doc.
17. Final: all scripts green, `npm run build` passes, README (run, demo walkthrough with two tabs, known limitations), `DEMO.md` (a 5-minute script the owner can follow in the morning, on the Vercel URL), final commit and push, deployment status checked.

If you finish early, use the remaining time on polish in this order: design fidelity → edge cases → micro-interactions (swipe physics, check highlight fade, match moment) → performance.

---

## KERNEL CHECK (self-audit before ticking each phase)

- **K — Key output**: Does this phase move toward "owner wakes up, runs one command, uses the whole app with two tabs"? Is it actually reachable from the UI?
- **E — Edge cases**: empty household, solo user, no plan today, all items checked, duplicate ingredients with different units, recipe deleted while planned, invite link for a full/nonexistent household, storage cleared mid-session, two tabs editing the same item.
- **R — Reusable**: Is persistence only behind repos so Supabase is a one-adapter change? Are components shared between mobile and desktop?
- **N — Nested logic avoided**: Business rules live in pure `src/domain` functions with tests, not inside components.
- **E — Error states**: Every async/storage action has a calm, Turkish, non-blaming error and empty state in the design's voice.
- **L — Least surprise**: Copy, colors and layout match the design; nothing punishes the user; no calories/streaks/badges crept in.

When everything is done, the last line of `PROGRESS.md` must read: `DONE — live: <Vercel URL> · local: npm install && npm run dev` followed by the demo accounts (if seeded).
