import type { Recipe } from "../data/models";
import { CUISINES, type Cuisine } from "./schema";

/** Cuisines the household's recipes span, in catalog order (the filter row shows only when there are two or more). */
export function cuisinesIn(recipes: Pick<Recipe, "cuisine">[]): Cuisine[] {
  const present = new Set(recipes.map((r) => r.cuisine));
  return CUISINES.filter((c) => present.has(c));
}

/** "all" keeps every recipe, including the household's own (which have no cuisine). */
export function byCuisine(cuisine: Cuisine | "all") {
  return (r: Pick<Recipe, "cuisine">) => cuisine === "all" || r.cuisine === cuisine;
}

/**
 * Placeholders for recipe ids that plans, matches or the cook log still reference but no recipe
 * has any more (a built-in renamed or dropped from the catalog): they show "Tarif kaldırıldı"
 * instead of an empty slot. No ingredients or steps, so they never reach the shopping list.
 */
export function removedRecipes(recipes: Pick<Recipe, "id">[], referenced: Iterable<string>, name: string, timestamp: string): Recipe[] {
  const have = new Set(recipes.map((r) => r.id));
  const out = new Map<string, Recipe>();
  for (const id of referenced) {
    if (!id || have.has(id) || out.has(id)) continue;
    out.set(id, {
      id,
      householdId: null,
      name,
      course: "ana",
      prepMinutes: 0,
      cookMinutes: 0,
      servings: 1,
      tags: [],
      ingredients: [],
      prepItems: [],
      steps: [],
      leftoverPolicy: "none",
      leftoverDays: 1,
      freezerItem: null,
      removed: true,
      createdBy: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  return [...out.values()];
}
