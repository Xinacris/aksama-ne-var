import { findDurations } from "../domain/durations";
import type { CatalogRecipe } from "./schema";

/**
 * Quality rules for generated recipes (Round 3.4 sample review), one small check each. They are
 * enforced for generated recipes only; the converted built-ins predate them (cups, short recipes)
 * and are reported, not failed (`validateCatalog` › `builtinQuality`).
 */

export const INGREDIENTS_RANGE = [6, 14] as const;
export const STEPS_RANGE = [5, 9] as const;
/** Cup measures: the catalog measures solids in g and liquids in ml. */
const CUP_UNITS = new Set(["su bardağı", "çay bardağı"]);

type Check = (r: CatalogRecipe) => string[];

/** A step's timer must be a duration its own (Turkish) text states. */
export const timersMatchText: Check = (r) =>
  r.steps.flatMap((s, n) => {
    if (!s.timerSeconds) return [];
    const stated = findDurations(s.text.tr).map((d) => d.seconds);
    return stated.includes(s.timerSeconds) ? [] : [`steps.${n}: timer ${s.timerSeconds}s but the text states ${stated.length ? stated.map((x) => `${x}s`).join(", ") : "no time"} ("${s.text.tr.slice(0, 50)}")`];
  });

/** "Kolay" means difficulty 1. */
export const kolayMatchesDifficulty: Check = (r) => (r.tags.includes("Kolay") && r.difficulty !== 1 ? [`tags: "Kolay" with difficulty ${r.difficulty}`] : []);

/** Metric only: no su bardağı / çay bardağı (one unit system per recipe). */
export const metricUnits: Check = (r) => {
  const cups = r.ingredients.filter((i) => i.unit && CUP_UNITS.has(i.unit)).map((i) => `${i.name.tr} (${i.unit})`);
  return cups.length ? [`units: cup measures (${cups.join(", ")}); use g / ml / spoons`] : [];
};

export const ingredientCount: Check = (r) => {
  const n = r.ingredients.length;
  return n < INGREDIENTS_RANGE[0] || n > INGREDIENTS_RANGE[1] ? [`ingredients: ${n}, expected ${INGREDIENTS_RANGE[0]}–${INGREDIENTS_RANGE[1]}`] : [];
};

export const stepCount: Check = (r) => {
  const n = r.steps.length;
  return n < STEPS_RANGE[0] || n > STEPS_RANGE[1] ? [`steps: ${n}, expected ${STEPS_RANGE[0]}–${STEPS_RANGE[1]}`] : [];
};

export const QUALITY_CHECKS: Check[] = [timersMatchText, kolayMatchesDifficulty, metricUnits, ingredientCount, stepCount];

export function qualityProblems(r: CatalogRecipe): string[] {
  return QUALITY_CHECKS.flatMap((check) => check(r));
}
