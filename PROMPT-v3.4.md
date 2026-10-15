# Round 3.4 — Curated recipe catalog v1 (1,000 recipes, local, Supabase-ready)

Pasted by the owner on 2026-10-15 ("PRISM KERNEL"). The owner's answers at the end override the spec where they differ. Runs on the branch `round-3.4-catalog` (it swaps the app's recipe source); merge into `main` only when every check is green.

## Purpose
Replace the current seed recipes with 1,000 curated recipes stored locally, structured so they can be bulk-seeded into Supabase in the next round without reshaping.

## Rules
- Branching: if any change could break the web, iOS or Android build (native modules, config plugins, app.json/app.config, dependency changes, or swapping the app's data source), do it on a new branch (e.g. round-3.3-catalog), run all checks there, and merge into main only when everything is green. Otherwise work on main. This round swaps the app's recipe source, so it runs on a branch.
- Exact counts per cuisine × category (table below), enforced by a validation script.
- Original wording only; do not copy text from recipe sites or books.
- Every recipe has TR and EN text (title, description, ingredients, steps). TR is primary.
- Realistic home-cook recipes, practical quantities, metric units (g, ml, adet, yemek kaşığı, çay kaşığı).
- No duplicate dishes (normalize names; e.g. "Mercimek çorbası" appears once).
- No pork in any recipe (skip the dish, or use a beef/chicken/turkey version only if it stays true to the dish).
- Alcohol (wine, beer, brandy, rum, etc.): keep the original alcoholic ingredient as the primary ingredient, and attach an alcohol-free substitute to it. UI shows it as a note under the ingredient:
  TR: "Şarap kullanmak istemezseniz: 150 ml tavuk suyu + 1 yemek kaşığı üzüm sirkesi kullanın."
  EN: "If you prefer not to use wine: use 150 ml chicken stock + 1 tbsp grape vinegar."
  Substitutes must be practical and suit the dish (stock + vinegar/lemon for savory, grape/apple juice for sweet, etc.). Recipes containing alcohol get the tag "containsAlcohol".

## Interface
Categories: main | soup | salad | side (ara sıcak / yan yemek) | dessert
Cuisines: turkish | italian | spanish | indian | american | french | indonesian | british

| cuisine    | total | main | soup | salad | side | dessert |
|------------|-------|------|------|-------|------|---------|
| turkish    | 700   | 318  | 174  | 84    | 58   | 66      |
| italian    | 80    | 48   | 7    | 6     | 10   | 9       |
| spanish    | 45    | 20   | 4    | 3     | 14   | 4       |
| indian     | 45    | 28   | 3    | 0     | 10   | 4       |
| american   | 45    | 28   | 2    | 4     | 5    | 6       |
| french     | 40    | 22   | 7    | 2     | 1    | 8       |
| indonesian | 25    | 21   | 3    | 1     | 0    | 0       |
| british    | 20    | 15   | 0    | 0     | 2    | 3       |
| TOTAL      | 1000  | 500  | 200  | 100   | 100  | 100     |

Selection principle for non-Turkish cuisines: pick dishes closest to the Turkish palate and cookable with ingredients from a regular Turkish supermarket (e.g. Spanish tapas ≈ meze/ara sıcak, Indian samosa/pakora ≈ börek, gulab jamun/kheer ≈ lokma/sütlaç, Indonesian satay ≈ şiş, Italian pasta/risotto, French soups and desserts, American burgers/cheesecake/brownies). Avoid dishes needing hard-to-find ingredients or very unfamiliar flavor profiles.

Turkish should span regions (Ege, Karadeniz, Güneydoğu, İç Anadolu, Marmara, Akdeniz) and include zeytinyağlılar, etli/sebzeli yemekler, bakliyat, hamur işleri, kebap/köfte, pilavlar. Turkish soups (174) should cover everyday, regional and seasonal soups without near-duplicates.

Recipe shape (TypeScript type, mirrors future Supabase tables):
{ id: uuid (stable, pre-generated), slug, cuisine, category, region?,
  title: {tr, en}, description: {tr, en},
  servings, prepMinutes, cookMinutes, difficulty: 1|2|3,
  ingredients: [{
    name: {tr, en}, amount?, unit?, note?: {tr, en}, pantryKey,
    substitute?: { name: {tr, en}, amount?, unit?, pantryKey, reason: 'alcoholFree' }
  }],
  steps: [{ text: {tr, en}, timerSeconds? }],
  tags: string[] (vegetarian, vegan, glutenFree, quick, budget, onePot, containsAlcohol…),
  mealSlots: ('lunch'|'dinner'|'breakfast')[],
  leftover: { likelihood: 'low'|'medium'|'high', keepsDays, reheatable: boolean },
  source: 'curated-v1', version: 1 }

Steps that use the alcoholic ingredient must read correctly with either option (e.g. "Şarabı (ya da yerine kullandığınız karışımı) ekleyip 2 dakika kaynatın").

Shopping list / pantry: if the household chooses the substitute, add the substitute's pantryKey instead of the alcohol. Default = original ingredient; add a per-household setting "Alkollü malzemelerde alternatifi kullan / Use alcohol-free substitutes" (off by default).

Leftover defaults: soup, dessert and side → likelihood high (rarely cooked daily, most likely to carry over to the next day); main → medium unless clearly single-serving; salad → low, keepsDays 1. The planner uses this to suggest next-day leftovers.

## Structure
- data/recipes/{cuisine}/{category}.json (chunked, ≤100 recipes per file).
- packages/shared/recipes/schema.ts (zod schema + types).
- scripts/validate-recipes.ts: schema check, exact count matrix, duplicate titles/slugs/ids, every timerSeconds > 0, ingredients non-empty, TR+EN present, no pork ingredients, every alcoholic ingredient has a substitute and the recipe has the containsAlcohol tag.
- scripts/export-supabase-seed.ts: generates SQL/CSV for recipes, recipe_ingredients (incl. substitute columns), recipe_steps, recipe_tags. Do not run against Supabase yet.
- pantryKey: normalized ingredient key (e.g. "egg", "onion", "red-lentil", "red-wine") so shopping list / pantry can merge items.

## Motion
1. Create the branch (e.g. round-3.3-catalog) from main.
2. Schema + validator first.
3. Generate in batches of ~50 per cuisine/category; run the validator after each batch; commit per cuisine.
4. Switch the app's recipe source to the new catalog; keep user-added/imported recipes separate.
5. Add cuisine + category filters to recipe browsing; render substitute notes under ingredients.
6. Run all checks (lint, typecheck, unit, browser suite, expo-doctor, iOS/Android bundle export). Merge into main only when everything is green; report final validator counts in the merge commit message.

## KERNEL CHECK
- Key output: 1,000 valid recipes, exact matrix, validator green, merged to main with all checks passing.
- Edge cases: dishes fitting two categories (e.g. mercimek köftesi → side), regional name variants, vegetarian version of the same dish (counts as one unless clearly different), alcohol used only for flambé or deglazing (substitute still required).
- Reusable: schema + seed exporter reused for the Supabase round and for admin-added recipes.
- Nested logic avoided: flat data, no computed fields stored.
- Error states: validator exits non-zero with a readable diff of expected vs actual counts and a list of failing recipe slugs.
- Least surprise: existing planned meals referencing old seed IDs are migrated or shown as "recipe removed"; the substitute setting never silently hides the original ingredient from the recipe view.

## Owner's answers (2026-10-15)

1. **Don't author the recipes in this session** (weekly limit). Instead:
   1. Write the schema, the validator, the style guide and the full dish list yourself: 1,000 unique dish names with cuisine/category/region, the exact matrix, no duplicates. Commit it as `data/recipes/dish-list.json`.
   2. Write `scripts/generate-recipes.ts`, which generates recipes from the dish list via an LLM API, not via this session:
      - Providers: `GEN_PROVIDER=gemini` (default, free tier, the owner's existing `GEMINI_API_KEY`) or `anthropic` (claude-haiku-5-5 via the Message Batches API).
      - Gemini: 5 recipes per request, throttled, exponential backoff on 429, resumable (skips slugs already written), safe to stop and rerun across days.
      - Anthropic: one batch job for all remaining dishes; poll, then write the results.
      - Every generated recipe goes through the zod schema and the validator. Failures are retried up to 2 times, then listed in `data/recipes/failed.json`.
      - The style guide (TR primary, original wording, no pork, alcohol first with a substitute, leftover defaults, metric units) is embedded in the generation prompt.
   3. Generate a small sample yourself to tune the prompt: run the script for ~10 dishes (a mix of cuisines and categories), show the owner 2 of them, then stop. The owner runs the full generation.
   4. Do the app-side work (catalog loader, filters, substitute notes, migration of old seed ids) against whatever recipes exist so far. It must work with a partial catalog.
   5. README: how to run the generator, resume it and switch provider, and the expected cost (Gemini $0; Haiku batch ≈ $0.50 total).
2. **The current 100 built-ins stay inside the 1,000**, without being rewritten by hand in this session. Reserve them in `dish-list.json` (counted in the matrix, marked `"existing": true`). `scripts/convert-seed.ts` maps the old shape to the new schema in code: it keeps names, ingredients, steps, timers and the existing EN text, derives `pantryKey` from the ingredient catalog, and sets leftover defaults by category. Only fields that can't be derived (missing EN text, alcohol substitutes) go through `generate-recipes.ts`, with the same provider settings. The generator skips dishes marked `existing`.
3. **Keep aisle and prep:**
   - Aisle (the pazar/market split) is stored per ingredient in the ingredient catalog, keyed by `pantryKey`, not per recipe. Every `pantryKey` used must have an aisle; the validator fails on unknown pantryKeys. Generated recipes emit only `pantryKey`, and the aisle is looked up. Seed the catalog from the current recipes' split.
   - Prep stays an optional recipe field with the same semantics as today: `convert-seed.ts` carries it over, and `generate-recipes.ts` fills it where the dish needs real prep (soaking, marinating, defrosting).
   - Both go into the schema, the validator and the Supabase seed export.
