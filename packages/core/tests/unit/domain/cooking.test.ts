import { describe, expect, it } from "vitest";
import {
  dishesToCook,
  isFinished,
  mergedIngredients,
  missingForCooking,
  moveStep,
  newTimer,
  overallProgress,
  parseCookTarget,
  pendingPrep,
  remainingSeconds,
  ringingTimers,
  stepOf,
  stepTimers,
  visibleTimers,
} from "@/domain/cooking";
import type { PantryItem, PrepTask, Recipe, ShoppingCheck } from "@/data/models";
import { generateList, ingredientKey } from "@/domain/shopping";
import { check, item, pantry, R, recipesById } from "@/testing/builders";

const MON = "2026-10-12";
const menu = [
  item(MON, "salata", "Çoban salata"),
  item(MON, "ana", "İzmir köfte"),
  item(MON, "corba", "Mercimek çorbası"),
  item(MON, "yaninda", "Tereyağlı pirinç pilavı"),
];

describe("what to cook", () => {
  it("parses the route id", () => {
    expect(parseCookTarget("2026-10-12")).toEqual({ kind: "menu", date: MON });
    expect(parseCookTarget("izmir-kofte")).toEqual({ kind: "recipe", recipeId: "izmir-kofte" });
  });

  it("menu dishes in tab order (çorba · ana · yanında · salata), skipping dolapta leftovers", () => {
    expect(dishesToCook({ kind: "menu", date: MON }, menu, recipesById).map((r) => r.name)).toEqual(["Mercimek çorbası", "İzmir köfte", "Tereyağlı pirinç pilavı", "Çoban salata"]);
    const withLeftover = [item(MON, "ana", "Kuru fasulye", { source: "leftover", leftoverFrom: "2026-10-11" }), item(MON, "salata", "Cacık")];
    expect(dishesToCook({ kind: "menu", date: MON }, withLeftover, recipesById).map((r) => r.name)).toEqual(["Cacık"]);
    expect(dishesToCook({ kind: "recipe", recipeId: "menemen" }, [], recipesById).map((r) => r.name)).toEqual(["Menemen"]);
  });

  it("merges ingredients across dishes, staples last", () => {
    const rows = mergedIngredients([R("İzmir köfte"), R("Mercimek çorbası"), R("Çoban salata")]);
    const domates = rows.find((r) => r.name === "Domates")!;
    expect(domates.forDishes.length).toBeGreaterThan(1);
    // köfte 3 + salad 3 domates, written like the recipe page ("6 domates")
    expect(domates.amount).toBe(String(R("İzmir köfte").ingredients.find((i) => i.name === "Domates")!.quantity! + R("Çoban salata").ingredients.find((i) => i.name === "Domates")!.quantity!));
    const firstStaple = rows.findIndex((r) => r.staple);
    expect(rows.slice(firstStaple).every((r) => r.staple)).toBe(true);
  });

  it("pending prep reminders for this evening only", () => {
    const t = (status: "pending" | "done", date = MON) =>
      ({ id: `${status}${date}`, date, recipeId: "izmir-kofte", status, dueAt: `${date}T06:00:00Z`, label: "x" }) as never;
    const out = pendingPrep([t("pending"), t("done"), t("pending", "2026-10-13")], { kind: "menu", date: MON }, ["izmir-kofte"], MON);
    expect(out).toHaveLength(1);
  });
});

describe("steps", () => {
  const kofte = R("İzmir köfte");
  const corba = R("Mercimek çorbası");
  it("each dish keeps its own position, clamped to its steps", () => {
    let pos: Record<string, number> = {};
    pos = moveStep(pos, kofte, 1);
    pos = moveStep(pos, kofte, 1);
    pos = moveStep(pos, corba, 1);
    expect(pos).toEqual({ [kofte.id]: 2, [corba.id]: 1 });
    expect(moveStep(pos, kofte, -5)[kofte.id]).toBe(0);
    expect(moveStep(pos, kofte, 99)[kofte.id]).toBe(kofte.steps.length - 1);
    expect(stepOf({ positions: { [kofte.id]: 99 } }, kofte)).toBe(kofte.steps.length - 1);
  });

  it("overall progress across dishes: 'adım 3/7'", () => {
    const total = kofte.steps.length + corba.steps.length;
    expect(overallProgress({ phase: "prep", positions: {} }, [corba, kofte])).toEqual({ step: 0, total });
    expect(overallProgress({ phase: "steps", positions: {} }, [corba, kofte])).toEqual({ step: 1, total });
    expect(overallProgress({ phase: "steps", positions: { [kofte.id]: 1, [corba.id]: 1 } }, [corba, kofte])).toEqual({ step: 3, total });
    expect(overallProgress({ phase: "done", positions: {} }, [corba, kofte])).toEqual({ step: total, total });
  });

  it("timer buttons come from the step text (at most two)", () => {
    expect(stepTimers("Fasulyeyi 10 dakika haşla, sonra 1 saat pişir, 5 dk dinlendir").map((d) => d.seconds)).toEqual([600, 3600]);
    expect(stepTimers("Soğanı doğra")).toEqual([]);
  });
});

describe("timers", () => {
  const now = new Date("2026-10-12T19:00:00Z");
  const kofte = R("İzmir köfte");

  it("stores an absolute end time; remaining time survives a reload", () => {
    const t = newTimer({ id: "t1", recipe: kofte, step: 4, seconds: 35 * 60, now });
    expect(t).toMatchObject({ endsAt: "2026-10-12T19:35:00.000Z", label: "İzmir köfte · 35 dk", dismissed: false });
    // "reload" ten minutes later: the same row gives the right countdown
    const reloaded: typeof t = JSON.parse(JSON.stringify(t));
    expect(remainingSeconds(reloaded, new Date("2026-10-12T19:10:00Z"))).toBe(25 * 60);
    expect(remainingSeconds(reloaded, new Date("2026-10-12T19:34:59.200Z"))).toBe(1);
    expect(isFinished(reloaded, new Date("2026-10-12T19:35:00Z"))).toBe(true);
    expect(remainingSeconds(reloaded, new Date("2026-10-12T20:00:00Z"))).toBe(0);
    // a render clock that is a second behind never shows more than the timer's length
    expect(remainingSeconds(reloaded, new Date("2026-10-12T18:59:59Z"))).toBe(35 * 60);
  });

  it("several timers at once: running first by end time, finished ones ring until dismissed", () => {
    const lentils = newTimer({ id: "a", recipe: R("Mercimek çorbası"), step: 2, seconds: 25 * 60, now });
    const rest = newTimer({ id: "b", recipe: kofte, step: 0, seconds: 20 * 60, now });
    const short = newTimer({ id: "c", recipe: kofte, step: 1, seconds: 60, now });
    const later = new Date(now.getTime() + 5 * 60_000);
    expect(visibleTimers([lentils, rest, short], later).map((t) => t.id)).toEqual(["b", "a", "c"]);
    expect(ringingTimers([lentils, rest, short], later).map((t) => t.id)).toEqual(["c"]);
    expect(ringingTimers([lentils, rest, { ...short, dismissed: true }], later)).toEqual([]);
  });
});

describe("missing before cooking", () => {
  const kofte = R("İzmir köfte");
  const pilav = R("Tereyağlı pirinç pilavı");
  const recipes = [kofte, pilav];
  const target = { kind: "menu", date: MON } as const;
  const nonStaple = (rs: Recipe[]) => [...new Set(rs.flatMap((r) => r.ingredients.filter((i) => !i.staple).map((i) => i.name)))];
  const list = (opts: { pantry?: PantryItem[]; checks?: ShoppingCheck[]; planned?: Recipe[] } = {}) =>
    generateList({ planned: opts.planned ?? recipes, pantry: opts.pantry ?? [], manualItems: [], checks: opts.checks ?? [], recipesById });
  const task = (status: "pending" | "done") =>
    ({ id: `t-${status}`, date: MON, recipeId: kofte.id, status, dueAt: `${MON}T06:00:00Z`, label: "Kıymayı buzluktan çıkar", offset: "morning" }) as PrepTask;
  const run = (args: { pantry?: PantryItem[]; checks?: ShoppingCheck[]; tasks?: PrepTask[]; planned?: Recipe[] }) =>
    missingForCooking({ recipes, rows: list(args), pantry: args.pantry ?? [], tasks: args.tasks ?? [], target, today: MON });

  it("nothing bought, nothing at home: every non-staple ingredient, on the list, plus pending prep first", () => {
    const out = run({ tasks: [task("pending"), task("done")] });
    expect(out.prep.map((t) => t.id)).toEqual(["t-pending"]);
    expect(out.ingredients.map((i) => i.name).sort()).toEqual(nonStaple(recipes).sort());
    expect(out.ingredients.every((i) => i.onList)).toBe(true);
    expect(out.ingredients.find((i) => i.name === "Tereyağı")?.forDishes.length).toBeGreaterThanOrEqual(1);
    expect(out.count).toBe(out.ingredients.length + 1);
  });

  it("all bought (ticked in Liste) and no prep tasks: nothing missing", () => {
    const checks = list().map((r) => check(r.key, "ali"));
    expect(run({ checks })).toMatchObject({ prep: [], ingredients: [], count: 0 });
  });

  it("evde var covers an ingredient; staples never count", () => {
    const names = nonStaple(recipes);
    const out = run({ pantry: names.slice(1).map((n) => pantry(n, null, null)) });
    expect(out.ingredients.map((i) => i.name)).toEqual([names[0]]);
    expect(out.ingredients.some((i) => recipes.flatMap((r) => r.ingredients).find((x) => x.name === i.name)?.staple)).toBe(false);
  });

  it("partially covered menu: some bought, some at home, the rest is missing", () => {
    const names = nonStaple(recipes);
    const [bought, atHome, ...rest] = names;
    const checks = [check(ingredientKey(bought), "zeynep")];
    const out = run({ checks, pantry: [pantry(atHome, null, null)] });
    expect(out.ingredients.map((i) => i.name).sort()).toEqual(rest.sort());
  });

  it("a recipe outside the plan: missing ingredients are not on the list yet", () => {
    const menemen = R("Menemen");
    const out = missingForCooking({ recipes: [menemen], rows: list({ planned: [] }), pantry: [], tasks: [], target: { kind: "recipe", recipeId: menemen.id }, today: MON });
    expect(out.count).toBe(nonStaple([menemen]).length);
    expect(out.ingredients.every((i) => !i.onList && i.recipeId === menemen.id)).toBe(true);
  });
});
