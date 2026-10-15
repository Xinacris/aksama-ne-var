import type { Course, Ingredient, Recipe, RecipeTranslation } from "../data/models";
import { pantryEntry } from "../data/seed/ingredients";
import { SEED_TIMESTAMP } from "../data/seed/build";
import { ingredientLabel } from "../domain/recipeText";
import { APP_TAGS, type CatalogIngredient, type CatalogRecipe, type Category } from "./schema";

/**
 * The catalog in the app's own `Recipe` shape, so every screen, the planner and the shopping list
 * keep working unchanged. Built-ins keep their slug as the app id (today's ids, URLs, plans and
 * tests stay valid); the catalog UUID travels as `catalogId` for Supabase. Turkish is the recipe's
 * own language, English its translation (`origin: "seed"`).
 */

const COURSE: Record<Category, Course> = { main: "ana", soup: "corba", salad: "salata", side: "yaninda", dessert: "tatli" };

/** Flag tags as the app's Turkish chips, so filters see generated recipes the same way. */
const TAG_FROM_FLAG: Record<string, string> = { vegetarian: "Vejetaryen", quick: "Hızlı", budget: "Ekonomik", onePot: "Tek tabak", spicy: "Acılı", guest: "Misafir", makeAhead: "Önceden hazırla" };
const APP_TAG_SET = new Set<string>(APP_TAGS);

function entryFor(key: string) {
  const e = pantryEntry(key);
  if (!e) throw new Error(`catalog: unknown pantryKey "${key}"`);
  return e;
}

function ingredient(i: CatalogIngredient): Ingredient {
  const e = entryFor(i.pantryKey);
  const sub = i.substitute ? entryFor(i.substitute.pantryKey) : null;
  return {
    name: e.name,
    quantity: i.amount ?? null,
    unit: i.unit ?? null,
    side: e.side,
    aisle: e.aisle,
    ...(e.staple ? { staple: true } : {}),
    ...(i.note?.tr ? { note: i.note.tr } : {}),
    ...(i.substitute && sub
      ? { substitute: { name: sub.name, quantity: i.substitute.amount ?? null, unit: i.substitute.unit ?? null, side: sub.side, aisle: sub.aisle, note: i.substitute.note.tr } }
      : {}),
  };
}

export function catalogToRecipe(c: CatalogRecipe): Recipe {
  const breakfastOnly = c.mealSlots.length === 1 && c.mealSlots[0] === "breakfast";
  const ingredients = c.ingredients.map(ingredient);
  const tags = [...new Set([...c.tags.filter((t) => APP_TAG_SET.has(t)), ...c.tags.map((t) => TAG_FROM_FLAG[t]).filter((t): t is string => !!t)])];
  const notesEn: Record<string, string> = {};
  const namesEn: Record<string, string> = {};
  const subsEn: Record<string, string> = {};
  c.ingredients.forEach((i, n) => {
    const canonical = ingredients[n].name;
    if (i.note?.en) notesEn[canonical] = i.note.en;
    if (i.name.en && i.name.en !== ingredientLabel(canonical, "en")) namesEn[canonical] = i.name.en;
    if (i.substitute) subsEn[canonical] = i.substitute.note.en;
  });
  const en: RecipeTranslation = {
    name: c.title.en,
    ...(c.shortTitle?.en ? { shortName: c.shortTitle.en } : {}),
    ...(c.timeNote ? { timeNote: c.timeNote.en } : {}),
    ...(Object.keys(namesEn).length ? { ingredients: namesEn } : {}),
    ...(Object.keys(notesEn).length ? { notes: notesEn } : {}),
    steps: c.steps.map((s) => s.text.en),
    ...(c.prepAhead?.length ? { prepItems: c.prepAhead.map((p) => p.text.en) } : {}),
    origin: "seed",
    ...(c.description ? { description: c.description.en } : {}),
    ...(Object.keys(subsEn).length ? { substituteNotes: subsEn } : {}),
  };
  return {
    id: c.slug,
    householdId: null,
    name: c.title.tr,
    ...(c.shortTitle?.tr ? { shortName: c.shortTitle.tr } : {}),
    course: breakfastOnly ? "kahvalti" : COURSE[c.category],
    prepMinutes: c.prepMinutes,
    cookMinutes: c.cookMinutes,
    ...(c.waitMinutes ? { waitMinutes: c.waitMinutes } : {}),
    ...(c.timeNote ? { timeNote: c.timeNote.tr } : {}),
    servings: c.servings,
    tags,
    ingredients,
    prepItems: (c.prepAhead ?? []).map((p) => ({ label: p.text.tr, offset: p.when, ...(p.freezer ? { freezer: true } : {}) })),
    steps: c.steps.map((s) => s.text.tr),
    // Leftovers are never guessed for the household ("Artmaz" until someone says otherwise); the
    // likelihood is only a hint for the planner.
    leftoverPolicy: "none",
    leftoverDays: c.leftover.keepsDays,
    freezerItem: c.freezerItem ? entryFor(c.freezerItem).name : null,
    lang: "tr",
    translations: { en },
    catalogId: c.id,
    cuisine: c.cuisine,
    category: c.category,
    ...(c.description ? { description: c.description.tr } : {}),
    difficulty: c.difficulty,
    leftoverLikelihood: c.leftover.likelihood,
    createdBy: null,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

/** Every catalog recipe that exists so far, in dish-list order of the files (works with a partial catalog). */
export function loadCatalog(files: Record<string, unknown[]>): Recipe[] {
  return Object.values(files).flatMap((rows) => (rows as CatalogRecipe[]).map(catalogToRecipe));
}
