import { slugify } from "../../lib/text";
import type { Course, Ingredient, PrepItem, PrepOffset, Recipe, Unit } from "../models";
import { catalogEntry } from "./ingredients";
import { KEEP_DAYS } from "./leftovers";

export const SEED_TIMESTAMP = "2026-01-01T00:00:00.000Z";

/** Ingredient by canonical name; side and aisle come from the catalog. */
export function i(name: string, quantity: number | null, unit: Unit | null, note?: string): Ingredient {
  const c = catalogEntry(name);
  if (!c) throw new Error(`Unknown ingredient "${name}" — add it to the catalog`);
  return {
    name,
    quantity,
    unit,
    side: c.side,
    aisle: c.aisle,
    ...(c.staple ? { staple: true } : {}),
    ...(note ? { note } : {}),
  };
}

/** Pantry staple with no fixed amount ("tuz, karabiber"). */
export function st(name: string, quantity: number | null = null, unit: Unit | null = null): Ingredient {
  return { ...i(name, quantity, unit), staple: true };
}

export function p(label: string, offset: PrepOffset, freezer = false): PrepItem {
  return freezer ? { label, offset, freezer } : { label, offset };
}

export interface RecipeSpec {
  name: string;
  shortName?: string;
  course: Course;
  prep: number;
  cook: number;
  timeNote?: string;
  servings: number;
  tags: string[];
  freezer?: string;
  source?: string;
  ingredients: Ingredient[];
  prepItems?: PrepItem[];
  steps: string[];
}

export function recipe(s: RecipeSpec): Recipe {
  const id = slugify(s.name);
  const keepDays = KEEP_DAYS[id];
  if (!keepDays) throw new Error(`No keep days for "${id}" — add it to seed/leftovers.ts`);
  return {
    id,
    householdId: null,
    name: s.name,
    ...(s.shortName ? { shortName: s.shortName } : {}),
    course: s.course,
    prepMinutes: s.prep,
    cookMinutes: s.cook,
    ...(s.timeNote ? { timeNote: s.timeNote } : {}),
    servings: s.servings,
    tags: s.tags,
    ingredients: s.ingredients,
    prepItems: s.prepItems ?? [],
    steps: s.steps,
    // Nothing is guessed: "Artmaz" until the household chooses otherwise.
    leftoverPolicy: "none",
    leftoverDays: keepDays,
    freezerItem: s.freezer ?? null,
    ...(s.source ? { source: s.source } : {}),
    createdBy: null,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}
