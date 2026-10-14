/** Builders for tests (core and apps): plan items, days, users… over the built-in recipes. */
import type { Match, PantryItem, PlanDay, PlanItem, Recipe, ShoppingCheck, Slot, User } from "../data/models";
import { builtinRecipes } from "../data/seed/recipes";

export const recipesById = new Map(builtinRecipes.map((r) => [r.id, r]));
export const R = (name: string): Recipe => {
  const r = builtinRecipes.find((x) => x.name === name);
  if (!r) throw new Error(`no recipe ${name}`);
  return r;
};

let n = 0;
const T = "2026-10-12T08:00:00.000Z";
export function item(date: string, slot: Slot, recipeName: string, extra: Partial<PlanItem> = {}): PlanItem {
  n++;
  return {
    id: `item-${n}`,
    householdId: "h",
    date,
    slot,
    recipeId: R(recipeName).id,
    source: "manual",
    createdBy: "ali",
    createdAt: new Date(Date.parse(T) + n * 1000).toISOString(),
    updatedAt: T,
    ...extra,
  };
}

export function day(date: string, extra: Partial<PlanDay> = {}): PlanDay {
  return {
    id: `day-${date}`,
    householdId: "h",
    date,
    status: "open",
    approvals: [],
    leftoverChoice: null,
    leftoverChoiceBy: null,
    returnedRecipeIds: [],
    cookedAt: null,
    createdBy: "ali",
    createdAt: T,
    updatedAt: T,
    ...extra,
  };
}

export function match(recipeName: string, extra: Partial<Match> = {}): Match {
  n++;
  return {
    id: `match-${n}`,
    householdId: "h",
    recipeId: R(recipeName).id,
    date: "2026-10-13",
    slot: "ana",
    status: "open",
    placedDate: null,
    returnedFrom: null,
    createdBy: "ali",
    createdAt: T,
    updatedAt: T,
    ...extra,
  };
}

export function pantry(name: string, quantity: number | null, unit: PantryItem["unit"]): PantryItem {
  n++;
  return { id: `p-${n}`, householdId: "h", name, quantity, unit, createdBy: "ali", createdAt: T, updatedAt: T };
}

export function check(itemKey: string, by: string): ShoppingCheck {
  n++;
  return { id: `c-${n}`, householdId: "h", itemKey, checkedBy: by, createdBy: by, createdAt: T, updatedAt: T };
}

export function user(id: string, name: string): User {
  return {
    id,
    email: `${id}@ev.local`,
    name,
    avatarInitial: name[0],
    passwordHash: "",
    passwordSalt: "",
    onboarded: true,
    createdAt: T,
    updatedAt: T,
  };
}
