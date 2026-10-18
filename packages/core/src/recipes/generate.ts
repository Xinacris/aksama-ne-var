import { z } from "zod";
import { UNITS } from "../data/models";
import { INGREDIENT_CATALOG } from "../data/seed/ingredients";
import {
  APP_TAGS,
  FLAG_TAGS,
  MEAL_SLOTS,
  bilingual,
  catalogRecipeSchema,
  defaultLeftover,
  type CatalogRecipe,
  type Dish,
} from "./schema";
import { qualityProblems } from "./quality";
import { recipeProblems } from "./validate";

/**
 * The generator's pure parts (scripts/generate-recipes.ts does the I/O): the style guide, the
 * prompts, the shape the model writes (a draft: content only — id, slug, cuisine, category,
 * region, source and version come from the dish list, so the model can't get them wrong), and
 * turning a draft into a checked catalog recipe.
 */

/** What the model writes for one dish. */
export const draftSchema = catalogRecipeSchema.omit({ id: true, slug: true, cuisine: true, category: true, region: true, source: true, version: true }).extend({
  /** Echoed back so a batch answer can be matched to its dish. */
  slug: z.string(),
  description: bilingual,
});
export type RecipeDraft = z.infer<typeof draftSchema>;

/** Converted built-ins only miss a description (owner's answer 2). */
export const fillSchema = z.object({ slug: z.string(), description: bilingual }).strict();

const pantryLines = () =>
  INGREDIENT_CATALOG.map((c) => `${c.key}=${c.name}${c.alcohol ? " [ALCOHOL]" : ""}${c.staple ? " [staple]" : ""}`).join("\n");

/** The style guide (the spec's rules), sent as the system prompt with every request. */
export function systemPrompt(): string {
  return `You write original recipes for "Akşama ne var?", a Turkish family meal-planning app. Every recipe is a realistic home-cook recipe in Turkish (primary) with a faithful English version.

RULES
1. Original wording only. Never copy text from recipe sites, books or other sources. Write as an experienced home cook explaining to a family member.
2. Turkish is primary: natural, everyday Turkish kitchen language. English is natural cookbook English, as a good English cookbook would write it — not a word-for-word translation ("Brown the beef in batches", not "Seal the meat in parts").
3. Ingredients: 6 to 14. Always list salt and the cooking fat (oil, butter, olive oil) when the dish uses them, and garnishes or toppings the dish is served with. Use the dish's authentic core ingredient where the Turkish kitchen has a near-equivalent (espresso or instant coffee for tiramisu, never Türk kahvesi; parmesan for Italian dishes).
4. Steps: 5 to 9, each one clear action or a few connected actions, in the informal singular imperative in Turkish ("Soğanı ince doğra.", "20 dakika kısık ateşte pişir."). Batters, marinades, sauces, doughs and toppings get their own steps (e.g. the butter–chilli topping of işkembe çorbası, the yoghurt marinade of tikka). Never squeeze a whole dish into three steps.
5. Timers: a step that waits or cooks for a set time states that time in its own text and sets timerSeconds to exactly that time ("20 dakika pişir" → 1200, "4 saat buzdolabında beklet" → 14400). A step whose text states no time has timerSeconds null — no timer for "until golden" or "leave to chill".
6. Units — one system per recipe: solids in g (or kg), liquids in ml (or l), small amounts in yemek kaşığı / tatlı kaşığı / çay kaşığı, countable things in adet, garlic in diş, herbs in demet, plus paket/kutu/kavanoz/dilim/tutam where that is how it is bought or used. Never su bardağı or çay bardağı. Allowed units: ${UNITS.filter((u) => u !== "su bardağı" && u !== "çay bardağı").join(", ")}. Quantities practical for home cooking, usually 4 servings (2–6). Salt, pepper and similar staples may have no amount (amount and unit null).
7. Ingredients use a pantryKey from the PANTRY list below, exactly as written. Never invent a key; if an exact ingredient isn't listed, use the closest listed one and say the detail in name/note (e.g. "Dana kıyma (az yağlı)" with pantryKey minced-beef). name is how the recipe calls it (TR and EN); note is preparation detail ("ince doğranmış" / "finely chopped").
8. NO PORK, ever: no pork, bacon, ham, lard, prosciutto, pancetta, guanciale, chorizo, pork sausage or gelatine from pork. Where a dish traditionally uses pork, use the beef, chicken or turkey version (beef-bacon, smoked-turkey, beef-sausage) only if the dish stays true to itself.
9. ALCOHOL: when the classic version of the dish uses alcohol (Marsala or coffee liqueur in tiramisu, red wine in bolognese, beer in a beer batter), include it — do not invent alcohol where the classic version has none. Keep the alcoholic ingredient (a PANTRY key marked [ALCOHOL]) as the primary ingredient and add a "substitute" to that ingredient: { name, amount, unit, pantryKey (never an [ALCOHOL] key), reason: "alcoholFree", note }. The note follows this exact pattern, TR: "Şarap kullanmak istemezseniz: 150 ml tavuk suyu + 1 yemek kaşığı üzüm sirkesi kullanın." EN: "If you prefer not to use wine: use 150 ml chicken stock + 1 tbsp grape vinegar." The substitute must suit the dish: stock + vinegar or lemon for savoury, grape or apple juice (or more coffee) for sweet; its pantryKey is the main substitute ingredient. Steps that use the alcohol read correctly with either option, e.g. "Şarabı (ya da yerine kullandığın karışımı) ekleyip 2 dakika kaynat." A recipe with alcohol has the tag "containsAlcohol". Alcohol used only for flambé or deglazing still needs the substitute.
10. tags: only values from TAGS. Use the flag tags where true (vegetarian = no meat, poultry or fish; vegan = also no egg, dairy or honey; glutenFree; quick = ready in 30 minutes or less; budget; onePot; spicy; makeAhead; freezable; guest; kidFriendly; dairyFree) and the Turkish app tags for method and main ingredient (e.g. "Tencere", "Fırında", "Etli", "Tavuklu", "Vejetaryen", "Bakliyat", "Zeytinyağlı", "Hamur işi"). "Kolay" only with difficulty 1. Dishes made ahead (chilled for hours or overnight, marinated, made the day before) get "makeAhead". Do not invent tags.
11. mealSlots: when it is eaten (breakfast, lunch, dinner); breakfast dishes get "breakfast".
12. leftover: soup, dessert and side → likelihood "high"; main → "medium" unless clearly single-serving (then "low"); salad → "low" with keepsDays 1. keepsDays 1–4 (how long it keeps in the fridge); reheatable true for dishes eaten warm that reheat well.
13. prepAhead whenever the dish benefits from advance prep: soaking or chilling overnight, cooking rice the day before (nasi goreng, fried rice) → "night-before"; marinating or defrosting in the morning → "morning"; a step a set time before cooking → "-60min" (any "-Nmin"). Taking something out of the freezer: freezer true, and freezerItem is that ingredient's pantryKey. timeNote only when the time depends on a choice ("düdüklüde 40 dk" / "40 min in a pressure cooker"). Otherwise omit them.
14. Times: prepMinutes (hands-on), cookMinutes (on heat or in the oven), waitMinutes (marinating, resting, rising, chilling; null if none). Realistic, not optimistic. difficulty 1 easy, 2 medium, 3 needs skill or long work.
15. description: one or two sentences (TR and EN) on what the dish is and what makes it good. No clichés like "nefis", "enfes", "mükemmel", no exclamation marks.
16. title: the dish name as given (TR and EN). shortTitle only if the name is long (≤ 20 characters), otherwise null.
17. Cuisine and region: stay true to the dish; for non-Turkish dishes, keep the original character but use ingredients found in a regular Turkish supermarket.

TAGS
${[...FLAG_TAGS, ...APP_TAGS].join(", ")}

MEAL SLOTS
${MEAL_SLOTS.join(", ")}

PANTRY (pantryKey=Turkish name)
${pantryLines()}`;
}

const dishLine = (d: Dish) =>
  JSON.stringify({ slug: d.slug, cuisine: d.cuisine, category: d.category, region: d.region ?? null, title: d.title, ...(d.hint ? { hint: d.hint } : {}) });

/** One request: a few dishes, answered as { "recipes": [...] } in the dishes' order. */
export function userPrompt(dishes: Dish[], feedback?: Map<string, string[]>): string {
  const fixes = feedback?.size
    ? `\n\nThe previous answer for some of these failed validation. Fix exactly these problems:\n${[...feedback].map(([slug, p]) => `- ${slug}: ${p.join("; ")}`).join("\n")}`
    : "";
  return `Write one recipe for each dish below. Answer with JSON only: {"recipes": [ ... ]}, one object per dish, in the same order, each with "slug" copied from the dish.

Each recipe object has: slug, title {tr,en}, shortTitle {tr,en}|null, description {tr,en}, servings, prepMinutes, cookMinutes, waitMinutes|null, timeNote {tr,en}|null, difficulty (1|2|3), ingredients [{ name {tr,en}, amount|null, unit|null, note {tr,en}|null, pantryKey, substitute|null }], steps [{ text {tr,en}, timerSeconds|null }], prepAhead [{ text {tr,en}, when, freezer? }] (omit if none), freezerItem|null, tags [], mealSlots [], leftover { likelihood, keepsDays, reheatable }.

DISHES
${dishes.map(dishLine).join("\n")}${fixes}`;
}

/** Built-ins: only a description, many dishes per request. */
export function fillPrompt(items: { dish: Dish; recipe: CatalogRecipe }[]): string {
  return `These recipes already exist; write only a description for each: one or two sentences in Turkish and a faithful English translation, on what the dish is and why it's good. No clichés ("nefis", "enfes", "mükemmel"), no exclamation marks. Answer with JSON only: {"recipes": [{"slug": ..., "description": {"tr": ..., "en": ...}}]} in the same order.

${items.map(({ recipe }) => JSON.stringify({ slug: recipe.slug, title: recipe.title, ingredients: recipe.ingredients.map((i) => i.name.tr), steps: recipe.steps.map((s) => s.text.tr) })).join("\n")}`;
}

/** The answer's recipes array, from JSON text (tolerates a ```json fence). */
export function parseAnswer(text: string): unknown[] {
  const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const data = JSON.parse(body) as unknown;
  if (Array.isArray(data)) return data;
  const recipes = (data as { recipes?: unknown })?.recipes;
  if (!Array.isArray(recipes)) throw new Error('answer has no "recipes" array');
  return recipes;
}

/**
 * A draft from the model → a catalog recipe for `dish`, or the problems. The dish list supplies
 * the identity fields; the validator's per-recipe checks decide.
 */
export function draftToRecipe(raw: unknown, dish: Dish): { recipe: CatalogRecipe | null; problems: string[] } {
  const draft = draftSchema.safeParse(raw);
  if (!draft.success) return { recipe: null, problems: draft.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  const { slug: _slug, ...content } = draft.data;
  const candidate = {
    id: dish.id,
    slug: dish.slug,
    cuisine: dish.cuisine,
    category: dish.category,
    ...(dish.region ? { region: dish.region } : {}),
    ...content,
    leftover: content.leftover ?? defaultLeftover(dish.category),
    source: "curated-v1" as const,
    version: 1 as const,
  };
  const { recipe, problems } = recipeProblems(candidate);
  // Generated recipes also meet the quality rules (counts, timers, metric units, Kolay); failures go back as feedback.
  const all = recipe ? [...problems, ...qualityProblems(recipe)] : problems;
  return all.length ? { recipe: null, problems: all } : { recipe, problems: [] };
}

/** JSON Schema of one answer (Anthropic's forced tool input). */
export function answerJsonSchema(fill: boolean): Record<string, unknown> {
  const item = fill ? fillSchema : draftSchema;
  return z.toJSONSchema(z.object({ recipes: z.array(item) }), { target: "draft-7", io: "input" }) as Record<string, unknown>;
}
