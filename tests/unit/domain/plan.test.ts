import { describe, expect, it } from "vitest";
import type { PlanItem } from "@/data/models";
import {
  addToPlan,
  approve,
  dayNote,
  freezerLines,
  markAteOut,
  menuFor,
  menuLine,
  menuTitle,
  moveDayToTomorrow,
  moveItem,
  removeFromPlan,
  rollover,
  sendBackToMatches,
  summarizeWeek,
  totalMinutes,
  type PlanState,
} from "@/domain/plan";
import { boardWindow } from "@/domain/dates";
import { day, item, match, R, recipesById, user } from "./helpers";

function state(items: PlanItem[], extra: Partial<PlanState> = {}): PlanState {
  return { items, days: [], matches: [], recipesById, ...extra };
}

const monday = [
  item("2026-10-12", "corba", "Mercimek çorbası"),
  item("2026-10-12", "ana", "İzmir köfte"),
  item("2026-10-12", "yaninda", "Tereyağlı pirinç pilavı"),
  item("2026-10-12", "salata", "Çoban salata"),
];

describe("menus", () => {
  it("titles and lines menus like the design", () => {
    const menu = menuFor(monday, "2026-10-12");
    expect(menuTitle(menu, recipesById)).toBe("İzmir köfte sofrası");
    const tue = menuFor(
      [item("2026-10-13", "ana", "Karnıyarık"), item("2026-10-13", "salata", "Cacık"), item("2026-10-13", "yaninda", "Şehriyeli pilav")],
      "2026-10-13",
    );
    expect(menuLine(tue, recipesById)).toBe("Karnıyarık · cacık · şehriyeli pilav");
    expect(totalMinutes(menu, recipesById)).toBe(75);
  });
});

describe("transitions", () => {
  it("adding replaces the slot, resets approvals to the adder and the leftover choice to the defaults", () => {
    const s = state(monday);
    const ops = addToPlan(s, { date: "2026-10-12", slot: "ana", recipeId: R("Kuru fasulye").id, source: "manual", by: "zeynep" });
    expect(ops[0]).toEqual({ op: "removeItem", id: monday[1].id });
    expect(ops[1]).toMatchObject({ op: "addItem", row: { slot: "ana", recipeId: R("Kuru fasulye").id } });
    expect(ops[2]).toEqual({ op: "upsertDay", date: "2026-10-12", patch: { approvals: ["zeynep"], leftoverChoice: null, leftoverChoiceBy: null } });
  });

  it("placing a matched dish marks the match as placed", () => {
    const m = match("Karnıyarık");
    const ops = addToPlan(state([], { matches: [m] }), { date: "2026-10-13", slot: "ana", recipeId: m.recipeId, source: "match", by: "ali" });
    expect(ops).toContainEqual({ op: "updateMatch", id: m.id, patch: { status: "placed", placedDate: "2026-10-13" } });
  });

  it("adding to an eaten-out day reopens it", () => {
    const ops = addToPlan(state([], { days: [day("2026-10-10", { status: "ate-out" })] }), {
      date: "2026-10-10",
      slot: "corba",
      recipeId: R("Tarhana çorbası").id,
      source: "manual",
      by: "ali",
    });
    expect(ops.find((o) => o.op === "upsertDay")).toMatchObject({ patch: { status: "open" } });
  });

  it("removing a placed match sends it back to open", () => {
    const it1 = item("2026-10-13", "ana", "Karnıyarık");
    const m = match("Karnıyarık", { status: "placed", placedDate: "2026-10-13" });
    const ops = removeFromPlan(state([it1], { matches: [m] }), it1.id, "ali");
    expect(ops).toContainEqual({ op: "updateMatch", id: m.id, patch: { status: "open", placedDate: null } });
    expect(removeFromPlan(state([]), "nope", "ali")).toEqual([]);
  });

  it("moving onto an occupied slot swaps the two dishes", () => {
    const a = item("2026-10-13", "ana", "Karnıyarık");
    const b = item("2026-10-14", "ana", "Menemen");
    const ops = moveItem(state([a, b]), a.id, "2026-10-14", "ana", "ali");
    expect(ops).toContainEqual({ op: "updateItem", id: a.id, patch: { date: "2026-10-14", slot: "ana", source: "moved" } });
    expect(ops).toContainEqual({ op: "updateItem", id: b.id, patch: { date: "2026-10-13", slot: "ana", source: "moved" } });
    expect(moveItem(state([a]), a.id, "2026-10-13", "ana", "ali")).toEqual([]);
  });

  it("'dışarıda yedik' clears the menu, returns the main dish to matches, marks the day neutrally", () => {
    const ops = markAteOut(state(monday), "2026-10-12", "ali");
    expect(ops.filter((o) => o.op === "removeItem")).toHaveLength(4);
    expect(ops).toContainEqual(
      expect.objectContaining({ op: "addMatch", row: expect.objectContaining({ recipeId: R("İzmir köfte").id, status: "returned", returnedFrom: "2026-10-12" }) }),
    );
    expect(ops).toContainEqual({
      op: "upsertDay",
      date: "2026-10-12",
      patch: { status: "ate-out", approvals: [], leftoverChoice: null, leftoverChoiceBy: null, returnedRecipeIds: [R("İzmir köfte").id] },
    });
  });

  it("'eaten out' on a matched dish reuses the existing match", () => {
    const m = match("İzmir köfte", { status: "placed", placedDate: "2026-10-12" });
    const ops = markAteOut(state(monday, { matches: [m] }), "2026-10-12", "ali");
    expect(ops).toContainEqual({ op: "updateMatch", id: m.id, patch: { status: "returned", placedDate: null, returnedFrom: "2026-10-12" } });
    expect(ops.some((o) => o.op === "addMatch")).toBe(false);
  });

  it("'plan değişti → eşleşmelere' leaves an open, empty evening", () => {
    const ops = sendBackToMatches(state(monday), "2026-10-12", "ali");
    expect(ops.at(-1)).toMatchObject({ op: "upsertDay", patch: { status: "open" } });
  });

  it("'plan değişti → yarına' moves today's menu and swaps with a planned tomorrow", () => {
    const tue = item("2026-10-13", "ana", "Karnıyarık");
    const ops = moveDayToTomorrow(state([...monday, tue], { days: [day("2026-10-12", { leftoverChoice: "lunch" })] }), "2026-10-12", "ali");
    for (const m of monday) expect(ops).toContainEqual({ op: "updateItem", id: m.id, patch: { date: "2026-10-13", source: "moved" } });
    expect(ops).toContainEqual({ op: "updateItem", id: tue.id, patch: { date: "2026-10-12", source: "moved" } });
    expect(ops).toContainEqual(expect.objectContaining({ op: "upsertDay", date: "2026-10-13", patch: expect.objectContaining({ leftoverChoice: "lunch" }) }));
  });

  it("approvals accumulate without duplicates", () => {
    const s = state(monday, { days: [day("2026-10-12", { approvals: ["ali"] })] });
    expect(approve(s, "2026-10-12", "zeynep")).toEqual([{ op: "upsertDay", date: "2026-10-12", patch: { approvals: ["ali", "zeynep"] } }]);
    expect(approve(s, "2026-10-12", "ali")[0]).toMatchObject({ patch: { approvals: ["ali"] } });
  });

  it("rollover marks past planned days cooked and logs them once", () => {
    const sun = [item("2026-10-11", "ana", "Kuru fasulye"), item("2026-10-11", "corba", "Tarhana çorbası")];
    const sat = item("2026-10-10", "ana", "Etli nohut");
    const s = state([...sun, sat, ...monday], { days: [day("2026-10-10", { status: "ate-out" })] });
    const { ops, cooked } = rollover(s, [], "2026-10-12", "ali", "2026-10-12T06:00:00Z");
    expect(cooked.map((c) => c.date)).toEqual(["2026-10-11", "2026-10-11"]);
    expect(ops).toContainEqual({ op: "upsertDay", date: "2026-10-11", patch: { status: "cooked", cookedAt: "2026-10-12T06:00:00Z" } });
    const again = rollover({ ...s, days: [...s.days, day("2026-10-11", { status: "cooked" })] }, [], "2026-10-12", "ali", "x");
    expect(again.ops).toEqual([]);
  });
});

describe("summaries", () => {
  const items = [
    item("2026-10-11", "ana", "Kuru fasulye"),
    ...monday,
    item("2026-10-13", "ana", "Karnıyarık"),
    item("2026-10-14", "ana", "Menemen"),
    item("2026-10-15", "ana", "Tavuk sote"),
  ];
  const s = state(items, { days: [day("2026-10-10", { status: "ate-out" })] });
  const dates = boardWindow("2026-10-12");

  it("summarizes the week like the design", () => {
    expect(summarizeWeek(s, dates, "2026-10-12")).toEqual({ planned: 5, note: "Cumartesi dışarıda · Cuma henüz boş" });
  });

  it("lists freezer items with day and part of day", () => {
    const users = new Map([["ali", user("ali", "Ali")]]);
    const tasks = [
      { id: "t1", householdId: "h", date: "2026-10-12", recipeId: R("İzmir köfte").id, label: "Kıymayı buzluktan çıkar", offset: "morning" as const, freezer: true, dueAt: new Date(2026, 9, 12, 9).toISOString(), assigneeId: "ali", status: "done" as const, doneBy: "ali", doneAt: "x", createdBy: "ali", createdAt: "", updatedAt: "" },
      { id: "t2", householdId: "h", date: "2026-10-15", recipeId: R("Tavuk sote").id, label: "Tavuk butları buzluktan buzdolabına al", offset: "night-before" as const, freezer: true, dueAt: new Date(2026, 9, 14, 21).toISOString(), assigneeId: "ali", status: "pending" as const, doneBy: null, doneAt: null, createdBy: "ali", createdAt: "", updatedAt: "" },
    ];
    expect(freezerLines(tasks, dates, recipesById, users)).toEqual([
      { taskId: "t1", text: "Kıyma 500 g · Pzt sabah", done: true, who: "Ali" },
      { taskId: "t2", text: "Tavuk but 700 g · Çar akşam", done: false, who: "Ali" },
    ]);
  });

  it("derives the footer notes under each day", () => {
    const withApprovals = { ...s, days: [...s.days, day("2026-10-12", { approvals: ["ali", "zeynep"] })] };
    expect(dayNote(withApprovals, "2026-10-11", ["ali", "zeynep"], "2026-10-12").kind).toBe("cooked");
    expect(dayNote(withApprovals, "2026-10-12", ["ali", "zeynep"], "2026-10-12").kind).toBe("approved");
    expect(dayNote(withApprovals, "2026-10-16", ["ali", "zeynep"], "2026-10-12").kind).toBe("empty");
    expect(dayNote(withApprovals, "2026-10-10", ["ali", "zeynep"], "2026-10-12").kind).toBe("none");
    expect(dayNote(withApprovals, "2026-10-14", ["ali", "zeynep"], "2026-10-12").kind).toBe("light");
    const m = { ...withApprovals, items: [...items.filter((i) => i.date !== "2026-10-13"), item("2026-10-13", "ana", "Karnıyarık", { source: "match" })] };
    expect(dayNote(m, "2026-10-13", ["ali", "zeynep"], "2026-10-12").kind).toBe("match");
  });
});
