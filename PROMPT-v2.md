# Akşama Ne Var? — Round 2: recipe import, leftover control, cooking mode

You are continuing work on an existing, deployed Next.js app in this repo ("Akşama Ne Var?", Turkish household dinner planner, localStorage prototype, live on Vercel, every push to `main` deploys). The owner is asleep and will not answer questions. Work unattended until everything below is done.

## 0. Operating rules (same as round 1)

1. Before any work, read `CLAUDE.md`, `PROGRESS.md`, `DECISIONS.md`, `PROMPT.md` and `docs/SUPABASE_MIGRATION.md`. Learn the existing domain model, repository layer, design tokens, copy voice and test setup before writing code. Reuse existing components; do not invent a second style.
2. Save this file as `PROMPT-v2.md` at the repo root if it is not already there. Append a new section `## Round 2` to `PROGRESS.md` with the phase checklist from section 5 (R1…R9). Add one line to the top of `CLAUDE.md`: *"Round 2 spec is in PROMPT-v2.md; continue from the first unchecked R-item in PROGRESS.md."* This makes the work resumable after a session reset or token limit.
3. Never ask a question. When something is ambiguous, choose what best fits the design and the product intent (calm, non-judgmental, household coordination; no calories, streaks or badges), log it in `DECISIONS.md` (one line: decision + reason) and move on.
4. Push rule unchanged: commit after each increment; push to `main` after each finished phase only when `npm run lint && npm run typecheck && npm test && npm run build` all pass. Run `npm run test:e2e` before the final push.
5. All UI copy is Turkish, in the existing voice. Use the English word "component" in code and docs, never "bileşen".
6. Every data-model change must keep old localStorage data working: add a versioned migration in the repository layer with a unit test (old shape in → new shape out). Mirror every new field/table in `supabase/schema.sql` (with RLS) and note it in `docs/SUPABASE_MIGRATION.md`, because the Supabase move is next.
7. Keep the app working on Vercel with **no** environment variables. New server features must degrade gracefully when their env vars are missing (see R2).

## 1. Feature A — Import a recipe from a link (Instagram Reels, YouTube Shorts, TikTok)

Goal: the user pastes (or shares) a link to a recipe video and gets a pre-filled recipe draft they review and save. Nothing is saved without the user confirming the draft.

### Pipeline (build it as source adapters so new sources plug in later)

`src/domain/import/` (pure, tested) + a server route `app/api/import/route.ts` (Node runtime).

1. **Detect platform** from the URL: `instagram` (reel/p/), `youtube` (shorts/, watch, youtu.be), `tiktok` (tiktok.com, vm.tiktok.com), else `web`. Normalize the URL (strip tracking params). Unit-test many real-looking URL shapes.
2. **Get text, server side, using official/public endpoints only. Do not scrape HTML of Instagram/TikTok, do not download video or audio, do not use unofficial APIs** (terms-of-service risk; log this in DECISIONS.md).
   - TikTok: public oEmbed `https://www.tiktok.com/oembed?url=…` → `title` is the caption; also `author_name`, `thumbnail_url`.
   - YouTube: if `YOUTUBE_API_KEY` is set, YouTube Data API v3 `videos.list?part=snippet` → title + full description (recipes are often in the description). Otherwise public oEmbed (title + thumbnail only).
   - Instagram: Meta's oEmbed no longer returns caption or thumbnail, so there is no clean way to get the text. Show the link card and go straight to step 3's "paste the caption" path, explaining it briefly and kindly in Turkish.
   - `web` (any other URL): fetch the page and read `schema.org/Recipe` JSON-LD if present (many recipe sites have it). This is the seed for future recipe-site partnerships; keep it as its own adapter.
3. **Paste fallback, always available:** a textarea "Açıklamayı buraya yapıştır" next to the link. If the fetched text has no ingredient-like lines, open this automatically.
4. **Structure the text into a recipe draft:**
   - If `ANTHROPIC_API_KEY` is set: call the Claude API from the server route with model `claude-haiku-5-5`, a short system prompt, and tool-use / JSON output matching the app's existing recipe type (name, servings, ingredient lines with amount + unit + item + pazar/market category, ordered steps with optional durations in minutes, suggested menu role: çorba/ana/yan/salata, prep-ahead notes like "kıymayı dondurucudan çıkar"). Turkish output, normalize units (yk, tk, su bardağı, gr, adet). `max_tokens` ~1500. Validate the JSON with the existing schema lib (or zod); on invalid output retry once, then fall back to the rule-based parser.
   - Always available, no key: a rule-based Turkish parser in `src/domain/import/parseText.ts` (detect ingredient lines by quantities/units/bullets/"Malzemeler" headings, steps by numbering/"Yapılışı"). Good enough to pre-fill; heavily unit-tested with 10+ realistic Turkish caption samples saved as fixtures (write them yourself; do not copy real creators' text).
   - The response says which path was used (`llm` | `rules`) and the source.
5. **Review screen**: the draft opens in the existing add/edit recipe form, with a small source card (platform, author, link, thumbnail if any) and a note "Kontrol edip kaydet". Save the source URL and author on the recipe and show "Kaynak: @author · Instagram" on the recipe page with the link (credit the creator).
6. **Entry points**: a "Linkten ekle" button in Tarifler; also register a Web Share Target in the PWA manifest (`share_target`, GET to `/tarifler/ice-aktar?url=…&text=…`) so on Android the user can share a Reel straight into the app. If there is no manifest yet, add a minimal one. Note in DECISIONS.md that iOS Safari does not support share targets, so iOS users paste the link.
7. **Guardrails**: per-household rate limit for LLM calls (default 30/day, in memory on the server is fine for now, note it moves to the DB later), request timeout 15 s, max input text 8k chars, never log full captions. Count LLM imports per household in localStorage settings so the owner can see usage ("Bu ay 12 tarif içe aktarıldı") in Ayarlar.
8. **Tests**: domain unit tests; route tests with `fetch` and the Anthropic client mocked (key present, key missing, invalid JSON then retry, platform endpoint failing); one e2e: paste a TikTok-style URL with mocked route → draft → save → appears in Tarifler.
9. **Docs**: `docs/IMPORT.md` — how it works, which env vars enable what (`ANTHROPIC_API_KEY`, optional `YOUTUBE_API_KEY`), and how to add a new source adapter. Add `BACKLOG.md` (create if missing) with: *"Recipe-site partnerships: per-site adapters / official feeds (start from the schema.org/Recipe adapter)"* and *"Optional transcription path for videos whose recipe is only spoken — needs licensing/ToS review first"*.

## 2. Feature B — Leftovers are configurable ("her yemek ertesi gün öğlen yenmez")

Find how the app currently creates the leftover ("kalan") and the next-day lunch item, and make it a user choice instead of an assumption.

1. **Per recipe default** (recipe form + recipe page): "Artarsa ne olur?" with options: `Artmaz / hepsi biter` · `Ertesi gün öğlen yenir` · `Saklanır, X gün içinde` (X = 1–4, default 2). Sensible defaults for the built-in 100 recipes (e.g. kuru fasulye, etli yemekler, çorbalar → saklanır 2–3 gün; salatalar, cacık, menemen, kızartmalar → artmaz). Write the defaults as data, not code.
2. **Household setting** (Ayarlar): "Öğlenleri evde yiyen var mı?" — Evet / Hayır / Bazı günler (pick weekdays). When no one eats lunch at home, leftovers are never turned into a lunch plan; they become "dolapta" items with a use-by day instead.
3. **Per meal override, at the moment it matters**: on the Bugün leftover card and on tonight's menu after cooking, quick choices: "Hiç kalmadı" · "Yarın öğlen" · "Dolaba kaldır" · "Kimse yemeyecek". One tap, undo available, synced to the other tab like everything else, recorded in the activity feed in the existing neutral tone (no guilt wording about waste).
4. Leftovers stored "dolapta" show on Bugün with a gentle "şu güne kadar" hint and can be dropped onto a day in Hafta as a planned meal (then the shopping list skips its ingredients).
5. Migration for old data + unit tests for the leftover rules (recipe default × household lunch setting × override). E2E: set "artmaz" on a recipe → cooking it creates no lunch item.

## 3. Feature C — "Pişirmeye başla" becomes a real cooking mode

Today the button does nothing visible. Make it open a cooking mode that is worth using with flour on your hands.

1. **Route** `/pisir/[menuOrRecipeId]` (or a full-screen sheet if that fits the existing navigation better; log the choice). Works for a single recipe and for tonight's multi-dish menu.
2. **Before starting**: one checklist screen "Hazırlık" — all ingredients of the menu merged, with amounts, tap to check; the prep-ahead reminders that are not done are shown at the top.
3. **Steps**: one step per screen, very large text, big Önceki/Sonraki buttons, swipe left/right, keyboard arrows on desktop. For a menu, show dish tabs (Çorba · Ana · Salata) and let the user jump between dishes; each dish keeps its own step position.
4. **Timers**: any step with a duration (from the recipe data, or parsed from text like "20 dakika", "yarım saat", "10-15 dk" → use the upper bound) gets a "Zamanlayıcı başlat" button. Multiple timers can run at once (lentils simmering while the köfte rests), listed in a sticky bar with dish name + remaining time, still running when you change step or dish. On finish: sound + vibration (where supported) + a visible banner. Timers survive a page reload (store end timestamps, not counters).
5. **Screen stays on**: Screen Wake Lock API while cooking mode is open, re-acquired on visibility change, silently skipped where unsupported.
6. **Household sync**: entering cooking mode broadcasts "Ali pişirmeye başladı" to the other tab and the activity feed; the menu card on Bugün shows "Pişiyor" with a small progress (step 3/7) for the other person. Leaving and coming back resumes where you were.
7. **Finish screen** "Afiyet olsun": marks tonight's meal as cooked in the plan, and asks the leftover question from Feature B (pre-selected from the recipe default) — this is the bridge between C and B. Also offers "Eksik çıkan bir şey oldu mu?" → quick add to the shopping list.
8. Accessibility: focus management per step, `aria-live` for timer finish, respects reduced motion, AA contrast in light/dark like the rest.
9. Tests: unit tests for duration parsing (many Turkish phrasings) and timer state (end-timestamp math, reload); component tests for step navigation; e2e: Bugün → Pişirmeye başla → go through steps → start a timer (fake clock) → finish → leftover choice applied.

## 4. Quality bar

- Match existing design tokens and components exactly; add screenshots of the new screens (390 and 1440, light and dark) to the `npm run screenshots` set and look at them yourself before calling a phase done.
- No regressions: all previous unit/component/e2e tests stay green.
- Update `DEMO.md` with a short "Round 2" walkthrough (import with paste fallback, leftover choice, cooking mode with two timers).

## 5. Phases (append to PROGRESS.md as R1…R9)

- R1. Read the codebase; plan data-model changes in DECISIONS.md; storage migration scaffold + tests.
- R2. Import domain: URL detection, adapters (TikTok, YouTube, Instagram, schema.org web), rule-based parser + fixtures.
- R3. Import server route: Claude Haiku path with validation/retry, graceful no-key mode, rate limit, tests.
- R4. Import UI: "Linkten ekle", paste fallback, draft review in existing form, source credit, share target manifest; e2e.
- R5. Leftover model: recipe defaults (data for the 100 recipes), household lunch setting, migration, rule tests.
- R6. Leftover UI: Bugün card overrides, "dolapta" items, drag into Hafta, shopping list skip; e2e.
- R7. Cooking mode core: route, prep checklist, steps, dish tabs, resume; tests.
- R8. Cooking mode extras: multiple timers with persistence, wake lock, sync/activity, finish screen → leftover question; e2e.
- R9. Final: Supabase schema + migration doc updated, docs/IMPORT.md, BACKLOG.md, DEMO.md, screenshots checked, all scripts green, push, check Vercel status (`gh api repos/{owner}/{repo}/commits/main/status`).

When done, the last line of `PROGRESS.md` must read: `ROUND 2 DONE — live: <Vercel URL>` and then one line per env var the owner must add in Vercel to unlock full import (`ANTHROPIC_API_KEY` required for smart import, `YOUTUBE_API_KEY` optional), stating clearly that the app works without them.
