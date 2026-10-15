import type { Course, Recipe } from "../data/models";
import { catalogEntry } from "../data/seed/ingredients";
import { findDurations } from "../domain/durations";
import { ingredientLabel } from "../domain/recipeText";
import { defaultLeftover, type CatalogRecipe, type Dish } from "./schema";

/**
 * The app's original built-in recipes (data/seed) in the catalog shape, in code (owner's answer 2):
 * names, ingredients, steps, prep, times, tags and the existing English text are kept; pantry keys
 * come from the ingredient catalog, timers from the durations written in the steps, leftovers from
 * the category defaults. A description doesn't exist yet: the generator's `--fill` adds it.
 */

const FLAG_FROM_TAG: Record<string, string> = {
  Vejetaryen: "vegetarian",
  Hızlı: "quick",
  Ekonomik: "budget",
  "Tek tabak": "onePot",
  Acılı: "spicy",
  Misafir: "guest",
  "Önceden hazırla": "makeAhead",
};

const HARD_TAGS = new Set(["Hamur işi", "Dolma", "Sarma"]);

/** 1 easy, 2 medium, 3 needs time or a technique (dough, stuffing). */
export function difficultyOf(r: Pick<Recipe, "tags" | "prepMinutes" | "cookMinutes" | "steps">): 1 | 2 | 3 {
  const total = r.prepMinutes + r.cookMinutes;
  if (r.tags.some((t) => HARD_TAGS.has(t)) || total >= 120 || r.steps.length >= 9) return 3;
  if (r.tags.includes("Kolay") || (total <= 30 && r.steps.length <= 5)) return 1;
  return 2;
}

const mealSlotsFor = (course: Course): CatalogRecipe["mealSlots"] => (course === "kahvalti" ? ["breakfast"] : ["lunch", "dinner"]);

export function convertBuiltin(r: Recipe, dish: Dish): CatalogRecipe {
  const en = r.translations?.en;
  if (!en) throw new Error(`${r.id}: no English text`);
  const key = (name: string) => {
    const c = catalogEntry(name);
    if (!c) throw new Error(`${r.id}: "${name}" is not in the ingredient catalog`);
    return c.key;
  };
  const flags = [...new Set(r.tags.map((t) => FLAG_FROM_TAG[t]).filter((x): x is string => !!x))];
  return {
    id: dish.id,
    slug: r.id,
    cuisine: dish.cuisine,
    category: dish.category,
    ...(dish.region ? { region: dish.region } : {}),
    title: { tr: r.name, en: en.name },
    ...(r.shortName ? { shortTitle: { tr: r.shortName, en: en.shortName ?? en.name } } : {}),
    servings: r.servings,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    ...(r.waitMinutes ? { waitMinutes: r.waitMinutes } : {}),
    ...(r.timeNote ? { timeNote: { tr: r.timeNote, en: en.timeNote ?? r.timeNote } } : {}),
    difficulty: difficultyOf(r),
    ingredients: r.ingredients.map((i) => ({
      name: { tr: i.name, en: ingredientLabel(i.name, "en") },
      amount: i.quantity,
      unit: i.unit,
      ...(i.note ? { note: { tr: i.note, en: en.notes?.[i.name] ?? i.note } } : {}),
      pantryKey: key(i.name),
    })),
    steps: r.steps.map((text, n) => {
      const seconds = findDurations(text)[0]?.seconds;
      return { text: { tr: text, en: en.steps[n] }, ...(seconds ? { timerSeconds: seconds } : {}) };
    }),
    ...(r.prepItems.length
      ? {
          prepAhead: r.prepItems.map((p, n) => ({
            text: { tr: p.label, en: en.prepItems?.[n] ?? p.label },
            when: p.offset,
            ...(p.freezer ? { freezer: true } : {}),
          })),
        }
      : {}),
    ...(r.freezerItem ? { freezerItem: key(r.freezerItem) } : {}),
    tags: [...r.tags, ...flags],
    mealSlots: mealSlotsFor(r.course),
    leftover: { ...defaultLeftover(dish.category), keepsDays: r.leftoverDays },
    source: "curated-v1",
    version: 1,
  };
}
