import type { Household, LeftoverChoice, LeftoverPolicy, PlanDay, PlanItem, Recipe } from "../data/models";
import { addDays, dayName, fromIsoDate } from "./dates";
import { dative } from "../lib/text";
import { labelRecord, t } from "../i18n";
import { dayFor, menuFor, type Menu, type PlanState } from "./plan";

/**
 * Leftover rules. The outcome of an evening is derived, never stored:
 *   per-evening choice (if any) → otherwise the recipe default (none / lunch / store X days),
 *   then the household lunch setting: nobody home for lunch → lunch becomes "dolapta".
 */

export type LunchSetting = Pick<Household, "lunchAtHome" | "lunchDays">;

export type LeftoverOutcome =
  | { kind: "none" }
  | { kind: "discard" }
  | { kind: "eaten" }
  | { kind: "lunch"; date: string }
  | { kind: "fridge"; useBy: string };

export function eatsLunchAtHome(h: LunchSetting, iso: string): boolean {
  if (h.lunchAtHome === "yes") return true;
  if (h.lunchAtHome === "no") return false;
  return h.lunchDays.includes(fromIsoDate(iso).getDay());
}

function fridge(r: Pick<Recipe, "leftoverDays">, fromDate: string): LeftoverOutcome {
  return { kind: "fridge", useBy: addDays(fromDate, Math.min(4, Math.max(1, r.leftoverDays))) };
}

/** Lunch tomorrow if someone eats lunch at home then; otherwise it goes in the fridge. */
function lunchOrFridge(r: Pick<Recipe, "leftoverDays">, fromDate: string, h: LunchSetting): LeftoverOutcome {
  const next = addDays(fromDate, 1);
  return eatsLunchAtHome(h, next) ? { kind: "lunch", date: next } : fridge(r, fromDate);
}

export function defaultOutcome(r: Pick<Recipe, "leftoverPolicy" | "leftoverDays">, fromDate: string, h: LunchSetting): LeftoverOutcome {
  switch (r.leftoverPolicy) {
    case "none":
      return { kind: "none" };
    case "lunch":
      return lunchOrFridge(r, fromDate, h);
    case "store":
      return fridge(r, fromDate);
  }
}

export function resolveLeftover(args: {
  recipe: Pick<Recipe, "leftoverPolicy" | "leftoverDays">;
  fromDate: string;
  choice: LeftoverChoice | null;
  household: LunchSetting;
}): LeftoverOutcome {
  const { recipe, fromDate, choice, household } = args;
  switch (choice) {
    case null:
      return defaultOutcome(recipe, fromDate, household);
    case "lunch":
      return lunchOrFridge(recipe, fromDate, household);
    case "fridge":
      return fridge(recipe, fromDate);
    default:
      return { kind: choice };
  }
}

/** The dish whose leftovers matter: the main, else the first dish. Leftover items do not leave leftovers. */
export function leftoverSource(menu: Menu): PlanItem | null {
  const main = menu.ana ?? menu.corba ?? menu.yaninda ?? menu.salata ?? null;
  return main && main.source !== "leftover" ? main : null;
}

export interface EveningLeftover {
  fromDate: string;
  recipe: Recipe;
  outcome: LeftoverOutcome;
  choice: LeftoverChoice | null;
  choiceBy: string | null;
  portions: number;
  /** The dolapta dish was put on an evening in the plan (Hafta drag or day picker). */
  plannedDate: string | null;
  cooked: boolean;
}

export function eveningLeftover(state: PlanState, household: LunchSetting, date: string, memberCount: number, todayIso: string): EveningLeftover | null {
  const day: PlanDay | undefined = dayFor(state.days, date);
  if (day?.status === "ate-out") return null;
  const src = leftoverSource(menuFor(state.items, date));
  const recipe = src ? state.recipesById.get(src.recipeId) : undefined;
  if (!recipe) return null;
  const choice = day?.leftoverChoice ?? null;
  const planned = state.items.find((i) => i.source === "leftover" && i.leftoverFrom === date);
  return {
    fromDate: date,
    recipe,
    outcome: resolveLeftover({ recipe, fromDate: date, choice, household }),
    choice,
    choiceBy: day?.leftoverChoiceBy ?? null,
    portions: Math.max(1, recipe.servings - Math.max(1, memberCount)),
    plannedDate: planned?.date ?? null,
    cooked: day?.status === "cooked" || date < todayIso,
  };
}

/** The leftover eaten for lunch on `date` (yesterday's dinner resolved to lunch today). */
export function lunchOn(state: PlanState, household: LunchSetting, date: string, memberCount: number, todayIso: string): EveningLeftover | null {
  const ev = eveningLeftover(state, household, addDays(date, -1), memberCount, todayIso);
  return ev && ev.outcome.kind === "lunch" && ev.outcome.date === date && !ev.plannedDate ? ev : null;
}

/**
 * "Dolapta": cooked evenings whose leftovers went to the fridge and are still
 * good on `todayIso` (looks back four days, the longest keep). Already planned
 * ones are included with `plannedDate` so Bugün can say where they went.
 */
export function fridgeItems(state: PlanState, household: LunchSetting, todayIso: string, memberCount: number): EveningLeftover[] {
  const out: EveningLeftover[] = [];
  for (let back = 4; back >= 0; back--) {
    const date = addDays(todayIso, -back);
    const ev = eveningLeftover(state, household, date, memberCount, todayIso);
    if (!ev || !ev.cooked || ev.outcome.kind !== "fridge") continue;
    if (ev.outcome.useBy < todayIso) continue;
    if (ev.plannedDate && ev.plannedDate < todayIso) continue; // eaten already
    out.push(ev);
  }
  return out;
}

/** "Perşembe'ye kadar" / "Bugüne kadar" / "Yarına kadar". */
export function keepUntilLabel(useBy: string, todayIso: string): string {
  if (useBy === todayIso) return t("leftovers.until.today");
  if (useBy === addDays(todayIso, 1)) return t("leftovers.until.tomorrow");
  const day = dayName(useBy);
  return t("leftovers.until.day", { day, dayDat: dative(day) });
}

/** One-tap choices (Bugün, cooking finish screen). `lunch` reads "Yarın öğlen" from tonight's menu. */
export const CHOICE_LABEL = labelRecord<LeftoverChoice>("leftovers.choice", ["none", "lunch", "fridge", "discard", "eaten"]);
export const choiceLabel = (c: LeftoverChoice): string => CHOICE_LABEL[c];

export const POLICY_OPTION = labelRecord<LeftoverPolicy>("leftovers.policy", ["none", "lunch", "store"]);

/** Recipe page meta: "ertesi gün öğlen yenir", "3 gün saklanır"; null when nothing is left. */
export function policyMeta(r: Pick<Recipe, "leftoverPolicy" | "leftoverDays">): string | null {
  if (r.leftoverPolicy === "none") return null;
  return r.leftoverPolicy === "lunch" ? t("leftovers.meta.lunch") : t("leftovers.meta.store", { count: r.leftoverDays });
}

/** Days the board shows "Öğlen · …" on: lunch outcomes only. */
export function lunchLine(state: PlanState, household: LunchSetting, date: string, todayIso: string): Recipe | null {
  return lunchOn(state, household, date, 1, todayIso)?.recipe ?? null;
}
