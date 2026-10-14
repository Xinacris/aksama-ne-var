import type { CookingSession, CookingTimer, Ingredient, PantryItem, PlanItem, PrepTask, Recipe, Slot } from "../data/models";
import { findDurations, formatTimerLength, type FoundDuration } from "./durations";
import { formatIngredientQuantity, ingredientStatus, recipeLabel, type ListRow } from "./shopping";

/**
 * Cooking mode, pure parts: what to cook, the merged "Hazırlık" list, step
 * positions per dish, overall progress and timers kept as absolute end times.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type CookTarget = { kind: "menu"; date: string } | { kind: "recipe"; recipeId: string };

/** `/pisir/2026-10-12` is that evening's menu; anything else is a recipe id. */
export function parseCookTarget(id: string): CookTarget {
  return ISO.test(id) ? { kind: "menu", date: id } : { kind: "recipe", recipeId: id };
}

/** Cooking order of a menu: soup, main, side, salad — the design's tab order. */
const ORDER: Slot[] = ["corba", "ana", "yaninda", "salata"];

/** Dishes to cook: planned, with steps, not a dolapta leftover (already cooked). */
export function dishesToCook(target: CookTarget, items: PlanItem[], recipesById: Map<string, Recipe>): Recipe[] {
  if (target.kind === "recipe") {
    const r = recipesById.get(target.recipeId);
    return r && r.steps.length ? [r] : [];
  }
  return ORDER.map((slot) => items.find((i) => i.date === target.date && i.slot === slot && i.source !== "leftover"))
    .map((i) => (i ? recipesById.get(i.recipeId) : undefined))
    .filter((r): r is Recipe => !!r && r.steps.length > 0);
}

export interface PrepListRow {
  key: string;
  /** Stored ingredient name ("evde var", list). */
  name: string;
  /** Shown name in the current language. */
  label: string;
  amount: string;
  /** Dishes using it, for menus ("köfte, pilav"). */
  forDishes: string[];
  staple: boolean;
}

/** All ingredients of the menu merged by name; amounts added when the units can be summed. */
export function mergedIngredients(recipes: Recipe[]): PrepListRow[] {
  const rows = new Map<string, { name: string; parts: Ingredient[]; dishes: string[]; staple: boolean }>();
  for (const r of recipes) {
    for (const ing of r.ingredients) {
      const key = ing.name.toLocaleLowerCase("tr");
      const row = rows.get(key) ?? { name: ing.name, parts: [], dishes: [], staple: !!ing.staple };
      row.parts.push(ing);
      if (!row.dishes.includes(recipeLabel(r))) row.dishes.push(recipeLabel(r));
      row.staple = row.staple && !!ing.staple;
      rows.set(key, row);
    }
  }
  const out: PrepListRow[] = [];
  for (const [key, row] of rows) {
    out.push({ key, name: row.name, label: row.parts[0]?.label ?? row.name, amount: mergeAmounts(row.parts), forDishes: row.dishes, staple: row.staple });
  }
  // Staples (salt, spices) last: they are usually at hand.
  return out.sort((a, b) => Number(a.staple) - Number(b.staple));
}

function mergeAmounts(parts: Ingredient[]): string {
  const measured = parts.filter((p) => p.quantity !== null);
  if (!measured.length) return "";
  if (measured.length === 1) return formatIngredientQuantity(measured[0]);
  const sameUnit = measured.every((p) => p.unit === measured[0].unit);
  if (sameUnit) return formatIngredientQuantity({ quantity: measured.reduce((s, p) => s + (p.quantity ?? 0), 0), unit: measured[0].unit });
  // Different kitchen measures: list them ("1 yemek kaşığı + 2 tatlı kaşığı").
  return measured.map((p) => formatIngredientQuantity(p)).join(" + ");
}

/** Prep-ahead reminders for this evening that are not done yet (shown on top of "Hazırlık"). */
export function pendingPrep(tasks: PrepTask[], target: CookTarget, recipeIds: string[], todayIso: string): PrepTask[] {
  const date = target.kind === "menu" ? target.date : todayIso;
  return tasks.filter((t) => t.date === date && recipeIds.includes(t.recipeId) && t.status === "pending").sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export interface MissingIngredient extends PrepListRow {
  /** Already on the shopping list (not bought yet): "Listeye ekle" would add nothing. */
  onList: boolean;
  /** First use in the menu, for "Listeye ekle" (unit, aisle, recipe). */
  ingredient: Ingredient;
  recipeId: string;
}

export interface MissingForCooking {
  /** Prep-ahead tasks for this evening not marked done. */
  prep: PrepTask[];
  /** Ingredients neither bought (ticked in Liste) nor "evde var"; staples count as at hand. */
  ingredients: MissingIngredient[];
  count: number;
}

/**
 * What is actually missing before cooking ("Başlamadan önce · 3 eksik").
 * Nothing missing → cooking mode opens on step 1.
 */
export function missingForCooking(args: {
  recipes: Recipe[];
  rows: ListRow[];
  pantry: PantryItem[];
  tasks: PrepTask[];
  target: CookTarget;
  today: string;
}): MissingForCooking {
  const prep = pendingPrep(args.tasks, args.target, args.recipes.map((r) => r.id), args.today);
  const firstUse = new Map<string, { ing: Ingredient; recipeId: string }>();
  for (const r of args.recipes) for (const ing of r.ingredients) if (!firstUse.has(ing.name)) firstUse.set(ing.name, { ing, recipeId: r.id });
  const ingredients: MissingIngredient[] = [];
  for (const row of mergedIngredients(args.recipes)) {
    if (row.staple) continue;
    const use = firstUse.get(row.name)!;
    const status = ingredientStatus(use.ing, args.rows, args.pantry);
    if (status === "evde") continue;
    ingredients.push({ ...row, onList: status === "listede", ingredient: use.ing, recipeId: use.recipeId });
  }
  return { prep, ingredients, count: prep.length + ingredients.length };
}

// ───────────────────────── steps ─────────────────────────

export function stepOf(session: Pick<CookingSession, "positions">, recipe: Recipe): number {
  return Math.min(Math.max(0, session.positions[recipe.id] ?? 0), Math.max(0, recipe.steps.length - 1));
}

/** Move within a dish; returns the new positions (others keep theirs). */
export function moveStep(positions: Record<string, number>, recipe: Recipe, delta: number): Record<string, number> {
  const cur = positions[recipe.id] ?? 0;
  const next = Math.min(Math.max(0, cur + delta), recipe.steps.length - 1);
  return { ...positions, [recipe.id]: next };
}

/** "adım 3/7": steps reached across all dishes (the current one counts). */
export function overallProgress(session: Pick<CookingSession, "positions" | "phase">, recipes: Recipe[]): { step: number; total: number } {
  const total = recipes.reduce((s, r) => s + r.steps.length, 0);
  if (session.phase === "done") return { step: total, total };
  if (session.phase === "prep") return { step: 0, total };
  const passed = recipes.reduce((s, r) => s + Math.min(session.positions[r.id] ?? 0, r.steps.length - 1), 0);
  return { step: Math.min(total, passed + 1), total };
}

/** Timer buttons for a step: at most two durations ("10 dakika haşla, sonra 1 saat pişir"). */
export function stepTimers(text: string): FoundDuration[] {
  return findDurations(text).slice(0, 2);
}

// ───────────────────────── timers ─────────────────────────

export function newTimer(args: { id: string; recipe: Recipe; step: number; seconds: number; now: Date }): CookingTimer {
  return {
    id: args.id,
    recipeId: args.recipe.id,
    step: args.step,
    label: `${recipeLabel(args.recipe)} · ${formatTimerLength(args.seconds)}`,
    seconds: args.seconds,
    endsAt: new Date(args.now.getTime() + args.seconds * 1000).toISOString(),
    dismissed: false,
  };
}

/** Seconds left; computed from the end time, so a reload or another tab shows the same thing. */
export function remainingSeconds(t: Pick<CookingTimer, "endsAt"> & { seconds?: number }, now: Date): number {
  const left = Math.max(0, Math.ceil((Date.parse(t.endsAt) - now.getTime()) / 1000));
  // A render clock up to a second old must not show "20:01" for a 20-minute timer.
  return t.seconds ? Math.min(t.seconds, left) : left;
}

export function isFinished(t: Pick<CookingTimer, "endsAt">, now: Date): boolean {
  return remainingSeconds(t, now) === 0;
}

/** Running first (soonest end first), then finished ones not yet dismissed. */
export function visibleTimers(timers: CookingTimer[], now: Date): CookingTimer[] {
  return timers
    .filter((t) => !t.dismissed)
    .sort((a, b) => Number(isFinished(a, now)) - Number(isFinished(b, now)) || a.endsAt.localeCompare(b.endsAt));
}

/** Timers that just finished and still need the banner. */
export function ringingTimers(timers: CookingTimer[], now: Date): CookingTimer[] {
  return timers.filter((t) => !t.dismissed && isFinished(t, now));
}
