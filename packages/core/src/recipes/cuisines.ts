import type { Recipe } from "../data/models";
import type { KeyValueStore } from "../data/storage";
import { CUISINES, type Cuisine } from "./schema";

/**
 * Cuisines as the app shows them: one ordering and one pair of i18n keys per cuisine
 * (`cuisine.<key>.short` for pills, `cuisine.<key>.long` everywhere else). A new cuisine is one
 * key in `CUISINES` + here, and four strings in tr.json / en.json.
 */
export const CUISINE_ORDER: readonly Cuisine[] = ["turkish", "italian", "indian", "french", "spanish", "indonesian", "american", "british"];

export type CuisineLabelForm = "short" | "long";

export function isCuisine(v: unknown): v is Cuisine {
  return typeof v === "string" && (CUISINES as readonly string[]).includes(v);
}

/** i18n key for a cuisine label: pass it to `t`. */
export function cuisineLabelKey(cuisine: Cuisine, form: CuisineLabelForm): string {
  return `cuisine.${cuisine}.${form}`;
}

/** Cuisines the recipes span, in display order. Household recipes (no cuisine) add none. */
export function availableCuisines(recipes: Pick<Recipe, "cuisine">[]): Cuisine[] {
  const present = new Set(recipes.map((r) => r.cuisine));
  return CUISINE_ORDER.filter((c) => present.has(c));
}

/** Known keys only, no duplicates, in display order. Anything unknown is dropped silently. */
export function sanitizeCuisines(raw: unknown): Cuisine[] {
  if (!Array.isArray(raw)) return [];
  const picked = new Set(raw.filter(isCuisine));
  return CUISINE_ORDER.filter((c) => picked.has(c));
}

/**
 * The selection that actually filters: the chosen cuisines that still have recipes here. If none
 * of them do (another slot, a cuisine gone from the data), it's empty, which means all cuisines.
 */
export function activeCuisines(selected: readonly Cuisine[], available: readonly Cuisine[]): Cuisine[] {
  return selected.filter((c) => available.includes(c));
}

/**
 * The swipe deck's cuisine filter: OR within cuisines, nothing selected = everything (household
 * recipes included). With a selection, recipes without a cuisine are left out.
 */
export function filterDeckByCuisines<T extends Pick<Recipe, "cuisine">>(recipes: readonly T[], selected: readonly Cuisine[]): T[] {
  if (selected.length === 0) return [...recipes];
  const want = new Set<string>(selected);
  return recipes.filter((r) => r.cuisine !== undefined && want.has(r.cuisine));
}

/** Device-level: the swipe deck's cuisine pills (not synced across household members). */
export const SWIPE_CUISINES_KEY = "anv.swipeCuisines";

export function readSwipeCuisines(store: Pick<KeyValueStore, "getItem"> | null | undefined): Cuisine[] {
  try {
    const raw = store?.getItem(SWIPE_CUISINES_KEY);
    return raw ? sanitizeCuisines(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function writeSwipeCuisines(store: Pick<KeyValueStore, "setItem"> | null | undefined, selected: readonly Cuisine[]): void {
  try {
    store?.setItem(SWIPE_CUISINES_KEY, JSON.stringify(sanitizeCuisines(selected)));
  } catch {
    // storage unavailable: the selection works in memory for this session
  }
}

/** Pill toggle: add or remove one cuisine, keeping display order. */
export function toggleCuisine(selected: readonly Cuisine[], cuisine: Cuisine): Cuisine[] {
  return selected.includes(cuisine) ? selected.filter((c) => c !== cuisine) : sanitizeCuisines([...selected, cuisine]);
}
