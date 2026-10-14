import type { Ingredient, PrepTask, Recipe, RecipeTranslation } from "../data/models";
import { getLocale, t, type Locale } from "../i18n";
import { slugify } from "../lib/text";

/**
 * Recipes in two languages. A recipe keeps its language-neutral data (times,
 * servings, tags, leftovers, ingredient identity) and its text in `lang`;
 * `translations[locale]` holds the other language. Display copies are made
 * here; logic (shopping list, prep tasks, matching) keeps using the stored
 * Turkish ingredient names and labels, so nothing merges or breaks across
 * languages.
 */

/** Catalog ingredient in the current language ("Kıyma" → "Minced beef"); unknown names stay as written. */
export function ingredientLabel(name: string, locale: Locale = getLocale()): string {
  if (locale === "tr") return name;
  return t(`ing.${slugify(name)}`, { defaultValue: name, lng: locale });
}

export function sourceLang(r: Pick<Recipe, "lang">): Locale {
  return r.lang ?? "tr";
}

/** The text for `locale`, or null when the recipe has none in that language. */
export function translationFor(r: Pick<Recipe, "lang" | "translations">, locale: Locale): RecipeTranslation | null {
  if (sourceLang(r) === locale) return null;
  return r.translations?.[locale] ?? null;
}

/** True when the recipe can be read in `locale` (its own language or a saved translation). */
export function hasLocaleText(r: Pick<Recipe, "lang" | "translations">, locale: Locale = getLocale()): boolean {
  return sourceLang(r) === locale || !!r.translations?.[locale];
}

/** Display copy for `locale`: translated name, steps, prep labels, ingredient labels and notes. */
export function localizeRecipe(r: Recipe, locale: Locale = getLocale()): Recipe {
  const tr = translationFor(r, locale);
  const ingredients: Ingredient[] = r.ingredients.map((ing) => {
    const label = tr?.ingredients?.[ing.name] ?? (sourceLang(r) === locale ? undefined : ingredientLabel(ing.name, locale));
    const note = tr?.notes?.[ing.name] ?? ing.note;
    return { ...ing, ...(label && label !== ing.name ? { label } : {}), ...(note ? { note } : {}) };
  });
  if (!tr) return { ...r, ingredients };
  return {
    ...r,
    name: tr.name,
    shortName: tr.shortName,
    // A Turkish time note ("düdüklüde 35 dk") is text: without a translation, the computed time shows instead.
    timeNote: tr.timeNote,
    steps: tr.steps.length ? tr.steps : r.steps,
    prepItems: r.prepItems.map((p, i) => ({ ...p, label: tr.prepItems?.[i] || p.label })),
    ingredients,
  };
}

/** Prep tasks store the recipe's own label; show the translated one when there is one. */
export function localizeTask(task: PrepTask, raw: Recipe | undefined, locale: Locale = getLocale()): PrepTask {
  if (!raw) return task;
  const tr = translationFor(raw, locale);
  if (!tr?.prepItems) return task;
  const idx = raw.prepItems.findIndex((p) => p.label === task.label);
  const label = idx >= 0 ? tr.prepItems[idx] : undefined;
  return label ? { ...task, label } : task;
}

/** Display name of an ingredient row: its translated label, else the stored name. */
export function ingredientText(ing: Pick<Ingredient, "name" | "label">): string {
  return ing.label ?? ing.name;
}
