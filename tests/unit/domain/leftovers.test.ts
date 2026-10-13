import { describe, expect, it } from "vitest";
import type { LeftoverChoice, LeftoverPolicy, PlanItem } from "@/data/models";
import { builtinRecipes } from "@/data/seed/recipes";
import { LEFTOVER_DEFAULTS } from "@/data/seed/leftovers";
import {
  defaultOutcome,
  eatsLunchAtHome,
  eveningLeftover,
  fridgeItems,
  lunchOn,
  policyMeta,
  resolveLeftover,
  useByLabel,
  type LunchSetting,
} from "@/domain/leftovers";
import { addToPlan, markCooked, placeLeftover, rollover, type PlanState } from "@/domain/plan";
import { generatePrepTasks } from "@/domain/prep";
import { listSourceRecipes } from "@/store/app";
import { day, item, R, recipesById } from "./helpers";

const SUN = "2026-10-11"; // Pazar
const MON = "2026-10-12"; // Pazartesi
const TUE = "2026-10-13";

const yes: LunchSetting = { lunchAtHome: "yes", lunchDays: [] };
const no: LunchSetting = { lunchAtHome: "no", lunchDays: [] };
const weekendsOnly: LunchSetting = { lunchAtHome: "some", lunchDays: [0, 6] };

const recipe = (policy: LeftoverPolicy, days = 2) => ({ leftoverPolicy: policy, leftoverDays: days });

function state(items: PlanItem[], days = [day(SUN, { status: "cooked" })]): PlanState {
  return { items, days, matches: [], recipesById };
}

describe("lunch at home", () => {
  it("yes / no / some weekdays", () => {
    expect(eatsLunchAtHome(yes, MON)).toBe(true);
    expect(eatsLunchAtHome(no, MON)).toBe(false);
    expect(eatsLunchAtHome(weekendsOnly, MON)).toBe(false);
    expect(eatsLunchAtHome(weekendsOnly, SUN)).toBe(true);
  });
});

describe("recipe default × household lunch setting × per-evening choice", () => {
  const cases: [LeftoverPolicy, LunchSetting, LeftoverChoice | null, string][] = [
    // defaults
    ["none", yes, null, "none"],
    ["lunch", yes, null, `lunch ${MON}`],
    ["lunch", no, null, `fridge ${TUE}`],
    ["lunch", weekendsOnly, null, `fridge ${TUE}`], // Monday nobody is home
    ["store", yes, null, `fridge ${TUE}`],
    ["store", no, null, `fridge ${TUE}`],
    // overrides
    ["none", yes, "lunch", `lunch ${MON}`],
    ["none", no, "lunch", `fridge ${TUE}`], // nobody home for lunch: never a lunch plan
    ["store", yes, "lunch", `lunch ${MON}`],
    ["lunch", yes, "fridge", `fridge ${TUE}`],
    ["store", yes, "none", "none"],
    ["store", yes, "discard", "discard"],
    ["store", yes, "eaten", "eaten"],
  ];
  it.each(cases)("%s · lunch %o · choice %s → %s", (policy, h, choice, expected) => {
    const o = resolveLeftover({ recipe: recipe(policy), fromDate: SUN, choice, household: h });
    expect(o.kind === "lunch" ? `lunch ${o.date}` : o.kind === "fridge" ? `fridge ${o.useBy}` : o.kind).toBe(expected);
  });

  it("stored days come from the recipe (1–4)", () => {
    expect(defaultOutcome(recipe("store", 4), SUN, yes)).toEqual({ kind: "fridge", useBy: "2026-10-15" });
    expect(defaultOutcome(recipe("store", 1), SUN, yes)).toEqual({ kind: "fridge", useBy: MON });
  });
});

describe("evenings", () => {
  const fasulye = item(SUN, "ana", "Kuru fasulye"); // store, 3 days

  it("default: kuru fasulye goes in the fridge for three days", () => {
    const ev = eveningLeftover(state([fasulye]), yes, SUN, 2, MON)!;
    expect(ev.outcome).toEqual({ kind: "fridge", useBy: "2026-10-14" });
    expect(ev.portions).toBe(2);
    expect(lunchOn(state([fasulye]), yes, MON, 2, MON)).toBeNull();
    expect(fridgeItems(state([fasulye]), yes, MON, 2).map((f) => f.recipe.name)).toEqual(["Kuru fasulye"]);
  });

  it("choice 'lunch' makes it Monday's lunch (Bugün card and board row)", () => {
    const s = state([fasulye], [day(SUN, { status: "cooked", leftoverChoice: "lunch", leftoverChoiceBy: "ali" })]);
    expect(lunchOn(s, yes, MON, 2, MON)?.recipe.name).toBe("Kuru fasulye");
    expect(lunchOn(s, no, MON, 2, MON)).toBeNull();
    expect(fridgeItems(s, no, MON, 2)).toHaveLength(1);
  });

  it("'artmaz' recipe: cooking it creates no lunch and nothing in the fridge", () => {
    const menemen = item(SUN, "ana", "Menemen");
    expect(R("Menemen").leftoverPolicy).toBe("none");
    expect(lunchOn(state([menemen]), yes, MON, 2, MON)).toBeNull();
    expect(fridgeItems(state([menemen]), yes, MON, 2)).toEqual([]);
  });

  it("not cooked yet, eaten out, past use-by, or 'Kimse yemeyecek' → nothing dolapta", () => {
    const today = item(MON, "ana", "Kuru fasulye");
    expect(fridgeItems(state([today], [day(MON)]), yes, MON, 2)).toEqual([]);
    expect(fridgeItems(state([fasulye], [day(SUN, { status: "ate-out" })]), yes, MON, 2)).toEqual([]);
    expect(fridgeItems(state([fasulye]), yes, "2026-10-15", 2)).toEqual([]);
    expect(fridgeItems(state([fasulye], [day(SUN, { status: "cooked", leftoverChoice: "discard" })]), yes, MON, 2)).toEqual([]);
  });

  it("a dolapta dish placed on an evening: shown as planned, then gone once eaten", () => {
    const placed = item(TUE, "ana", "Kuru fasulye", { source: "leftover", leftoverFrom: SUN });
    const s = state([fasulye, placed]);
    expect(fridgeItems(s, yes, MON, 2)[0].plannedDate).toBe(TUE);
    expect(fridgeItems(s, yes, "2026-10-14", 2)).toEqual([]);
    // the leftover evening itself leaves no new leftovers
    expect(eveningLeftover(s, yes, TUE, 2, MON)).toBeNull();
  });
});

describe("plan + list + prep with leftover items", () => {
  it("placeLeftover adds a leftover item, resets approvals, touches no match", () => {
    const ops = placeLeftover(state([]), { fromDate: SUN, recipeId: "kuru-fasulye", toDate: TUE, slot: "ana", by: "ali" });
    expect(ops[0]).toEqual({ op: "addItem", row: { date: TUE, slot: "ana", recipeId: "kuru-fasulye", source: "leftover", leftoverFrom: SUN, createdBy: "ali" } });
    expect(ops.some((o) => o.op === "updateMatch")).toBe(false);
  });

  it("a new main dish resets the evening's choice to the defaults", () => {
    const s = state([], [day(TUE, { leftoverChoice: "none", leftoverChoiceBy: "ali" })]);
    const ops = addToPlan(s, { date: TUE, slot: "ana", recipeId: "karniyarik", source: "manual", by: "zeynep" });
    expect(ops).toContainEqual(expect.objectContaining({ op: "upsertDay", patch: expect.objectContaining({ leftoverChoice: null, leftoverChoiceBy: null }) }));
  });

  it("the shopping list skips leftover items", () => {
    const placed = item(TUE, "ana", "Kuru fasulye", { source: "leftover", leftoverFrom: SUN });
    const salad = item(TUE, "salata", "Çoban salata");
    const recipes = listSourceRecipes({ planItems: [placed, salad], planDays: [], matches: [], recipes: builtinRecipes, today: MON });
    expect(recipes.map((r) => r.name)).toEqual(["Çoban salata"]);
  });

  it("prep tasks, cook log and rollover skip leftover items", () => {
    const placed = item(MON, "ana", "İzmir köfte", { source: "leftover", leftoverFrom: SUN });
    const tasks = generatePrepTasks({ householdId: "h", items: [placed], recipesById, members: [], existing: [], dinnerTime: "19:30", createdBy: "ali" });
    expect(tasks).toEqual([]);
    expect(markCooked(state([placed], []), [], MON, "ali", "now").cooked).toEqual([]);
    expect(rollover(state([placed], []), [], TUE, "ali", "now").cooked).toEqual([]);
  });

  it("markCooked logs tonight's dishes once and marks the day cooked", () => {
    const k = item(MON, "ana", "İzmir köfte");
    const { ops, cooked } = markCooked(state([k], []), [], MON, "ali", "2026-10-12T17:00:00Z");
    expect(cooked).toEqual([{ date: MON, recipeId: "izmir-kofte" }]);
    expect(ops.at(-1)).toEqual({ op: "upsertDay", date: MON, patch: { status: "cooked", cookedAt: "2026-10-12T17:00:00Z" } });
  });
});

describe("built-in defaults are data", () => {
  it("every built-in recipe has an entry, and the table has no strays", () => {
    const ids = builtinRecipes.map((r) => r.id).sort();
    expect(Object.keys(LEFTOVER_DEFAULTS).sort()).toEqual(ids);
  });

  it("follows the household intuition: legumes/soups stored, salads and egg dishes do not leave leftovers", () => {
    for (const n of ["Kuru fasulye", "Mercimek çorbası", "Etli nohut"]) expect(R(n).leftoverPolicy).toBe("store");
    expect(R("Kuru fasulye").leftoverDays).toBe(3);
    for (const n of ["Cacık", "Çoban salata", "Menemen", "Patates kızartması", "Hamsi tava"]) expect(R(n).leftoverPolicy).toBe("none");
  });

  it("labels", () => {
    expect(policyMeta(R("Kuru fasulye"))).toBe("artarsa 3 gün saklanır");
    expect(policyMeta(R("Tavuk sote"))).toBe("ertesi gün öğlen yenir");
    expect(policyMeta(R("Cacık"))).toBeNull();
    expect(useByLabel(MON, MON)).toBe("Bugün bitirilmeli");
    expect(useByLabel(TUE, MON)).toBe("Yarına kadar");
    expect(useByLabel("2026-10-15", MON)).toBe("Perşembe'ye kadar");
    expect(useByLabel("2026-10-16", MON)).toBe("Cuma'ya kadar");
  });
});
