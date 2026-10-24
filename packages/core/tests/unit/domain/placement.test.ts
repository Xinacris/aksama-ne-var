import { describe, expect, it } from "vitest";
import type { PlanItem, Recipe } from "@/data/models";
import { dropOnDay, moveToDay, slotForRecipe, validSlot } from "@/domain/placement";
import type { PlanState } from "@/domain/plan";
import { item, match, R, recipesById } from "@/testing/builders";

function state(items: PlanItem[], extra: Partial<PlanState> = {}): PlanState {
  return { items, days: [], matches: [], recipesById, ...extra };
}
const TUE = "2026-10-13";
const own = (extra: Partial<Recipe>): Recipe => ({ ...R("Karnıyarık"), id: "own-1", householdId: "h", category: undefined, catalogId: undefined, ...extra });

describe("slotForRecipe", () => {
  it("follows the category, then the course", () => {
    expect(slotForRecipe(R("Mercimek çorbası"))).toBe("corba");
    expect(slotForRecipe(R("Karnıyarık"))).toBe("ana");
    expect(slotForRecipe(R("Çoban salata"))).toBe("salata");
    expect(slotForRecipe(R("Bulgur pilavı"))).toBe("yaninda");
    expect(slotForRecipe(own({ course: "tatli" }))).toBe("tatli");
    expect(slotForRecipe(own({ course: "corba", category: "dessert" }))).toBe("tatli");
  });
  it("has no slot for a stub or a breakfast / one-plate dish without a category", () => {
    expect(slotForRecipe(own({ stub: true }))).toBeNull();
    expect(slotForRecipe(own({ course: "kahvalti" }))).toBeNull();
    expect(slotForRecipe(own({ stub: true, category: "side" }))).toBe("yaninda");
    expect(validSlot(null)).toBeNull();
  });
});

describe("dropOnDay: placement", () => {
  it("puts a main dish in the main slot wherever it is dropped on the day", () => {
    const res = dropOnDay(state([]), { date: TUE, recipe: R("Karnıyarık"), origin: "recipe", by: "ali" });
    expect(res.kind).toBe("placed");
    if (res.kind !== "placed") return;
    expect(res.slot).toBe("ana");
    expect(res.displaced).toBeNull();
    expect(res.ops).toContainEqual(expect.objectContaining({ op: "addItem", row: expect.objectContaining({ date: TUE, slot: "ana", recipeId: R("Karnıyarık").id, source: "manual" }) }));
  });

  it("puts each category in its own slot, desserts included", () => {
    for (const [name, slot] of [["Mercimek çorbası", "corba"], ["Cacık", "salata"], ["Bulgur pilavı", "yaninda"]] as const) {
      const res = dropOnDay(state([]), { date: TUE, recipe: R(name), origin: "recipe", by: "ali" });
      expect(res.kind === "placed" && res.slot).toBe(slot);
    }
    const res = dropOnDay(state([]), { date: TUE, recipe: own({ course: "tatli" }), origin: "recipe", by: "ali" });
    expect(res.kind === "placed" && res.slot).toBe("tatli");
  });

  it("a match drop marks that match placed", () => {
    const m = match("Karnıyarık");
    const res = dropOnDay(state([], { matches: [m] }), { date: TUE, recipe: R("Karnıyarık"), origin: "match", matchId: m.id, by: "ali" });
    expect(res.kind === "placed" && res.ops).toContainEqual({ op: "updateMatch", id: m.id, patch: { status: "placed", placedDate: TUE } });
    expect(res.kind === "placed" && res.ops).toContainEqual(expect.objectContaining({ op: "addItem", row: expect.objectContaining({ source: "match" }) }));
  });

  it("asks for a slot when the recipe has no category, and uses the answer", () => {
    expect(dropOnDay(state([]), { date: TUE, recipe: own({ stub: true }), origin: "recipe", by: "ali" })).toEqual({ kind: "needsSlot" });
    const res = dropOnDay(state([]), { date: TUE, recipe: own({ stub: true }), origin: "recipe", by: "ali", slot: "yaninda" });
    expect(res.kind === "placed" && res.slot).toBe("yaninda");
  });

  it("ignores a slot answer for a recipe that has a category (it stays locked)", () => {
    const res = dropOnDay(state([]), { date: TUE, recipe: R("Karnıyarık"), origin: "recipe", by: "ali", slot: "corba" });
    expect(res.kind === "placed" && res.slot).toBe("ana");
  });

  it("dropping the dish already in that slot changes nothing", () => {
    const s = state([item(TUE, "ana", "Karnıyarık")]);
    expect(dropOnDay(s, { date: TUE, recipe: R("Karnıyarık"), origin: "recipe", by: "ali" })).toEqual({ kind: "noop", reason: "same", slot: "ana" });
  });

  it("dropping a dish that is already on that day (another slot, old data) changes nothing", () => {
    const s = state([item(TUE, "yaninda", "Karnıyarık")]);
    expect(dropOnDay(s, { date: TUE, recipe: R("Karnıyarık"), origin: "recipe", by: "ali" })).toMatchObject({ kind: "noop", reason: "onDay" });
  });
});

describe("dropOnDay: displacement", () => {
  it("a dish that came from the matches goes back to the matches", () => {
    const m = match("İzmir köfte", { status: "placed", placedDate: TUE });
    const old = item(TUE, "ana", "İzmir köfte", { source: "match" });
    const res = dropOnDay(state([old], { matches: [m] }), { date: TUE, recipe: R("Karnıyarık"), origin: "recipe", by: "ali" });
    expect(res.kind).toBe("placed");
    if (res.kind !== "placed") return;
    expect(res.displaced).toEqual({ to: "matches", itemId: old.id, recipeId: old.recipeId });
    expect(res.ops).toContainEqual({ op: "removeItem", id: old.id });
    expect(res.ops).toContainEqual({ op: "updateMatch", id: m.id, patch: { status: "returned", placedDate: null, returnedFrom: TUE } });
    // The returned match is not consumed again by the new dish.
    expect(res.ops.filter((o) => o.op === "updateMatch")).toHaveLength(1);
  });

  it("a match-sourced dish without a match row gets one, so it is never lost", () => {
    const old = item(TUE, "ana", "İzmir köfte", { source: "match" });
    const res = dropOnDay(state([old]), { date: TUE, recipe: R("Karnıyarık"), origin: "recipe", by: "ali" });
    expect(res.kind === "placed" && res.ops).toContainEqual({
      op: "addMatch",
      row: { recipeId: old.recipeId, date: TUE, slot: "ana", status: "returned", placedDate: null, returnedFrom: TUE, createdBy: "ali" },
    });
  });

  it("a dish added by hand leaves the day (it stays in the recipes)", () => {
    const old = item(TUE, "corba", "Ezogelin çorbası");
    const res = dropOnDay(state([old]), { date: TUE, recipe: R("Mercimek çorbası"), origin: "match", by: "ali" });
    expect(res.kind).toBe("placed");
    if (res.kind !== "placed") return;
    expect(res.displaced).toEqual({ to: "removed", itemId: old.id, recipeId: old.recipeId });
    expect(res.ops).toContainEqual({ op: "removeItem", id: old.id });
    expect(res.ops.some((o) => o.op === "addMatch" || (o.op === "updateMatch" && o.patch.status === "returned"))).toBe(false);
  });

  it("other slots of the day are untouched", () => {
    const soup = item(TUE, "corba", "Ezogelin çorbası");
    const res = dropOnDay(state([soup]), { date: TUE, recipe: R("Karnıyarık"), origin: "recipe", by: "ali" });
    expect(res.kind === "placed" && res.displaced).toBeNull();
    expect(res.kind === "placed" && res.ops.some((o) => o.op === "removeItem")).toBe(false);
  });
});

describe("moveToDay", () => {
  it("keeps the slot and swaps with the target day's dish", () => {
    const a = item(TUE, "ana", "Karnıyarık");
    const b = item("2026-10-14", "ana", "İzmir köfte");
    const res = moveToDay(state([a, b]), { itemId: a.id, date: "2026-10-14", by: "ali" });
    expect(res.kind).toBe("placed");
    if (res.kind !== "placed") return;
    expect(res.slot).toBe("ana");
    expect(res.displaced).toEqual({ to: "swapped", itemId: b.id, recipeId: b.recipeId, date: TUE });
    expect(res.ops).toContainEqual({ op: "updateItem", id: a.id, patch: { date: "2026-10-14", slot: "ana", source: "moved" } });
    expect(res.ops).toContainEqual({ op: "updateItem", id: b.id, patch: { date: TUE, slot: "ana", source: "moved" } });
  });
  it("same day is a no-op; an unknown item is invalid", () => {
    const a = item(TUE, "ana", "Karnıyarık");
    expect(moveToDay(state([a]), { itemId: a.id, date: TUE, by: "ali" })).toEqual({ kind: "noop", reason: "same", slot: "ana" });
    expect(moveToDay(state([a]), { itemId: "nope", date: TUE, by: "ali" })).toEqual({ kind: "invalid" });
  });
});

describe("dropMessage", () => {
  it("says where the dish went and where the displaced one went", async () => {
    const { dropMessage } = await import("@/domain/placement");
    const m = match("İzmir köfte", { status: "placed", placedDate: TUE });
    const old = item(TUE, "ana", "İzmir köfte", { source: "match" });
    const res = dropOnDay(state([old], { matches: [m] }), { date: TUE, recipe: R("Karnıyarık"), origin: "recipe", by: "ali" });
    expect(dropMessage(res, { name: "Karnıyarık", date: TUE, recipesById })).toBe("Karnıyarık → Salı · Ana yemek. İzmir köfte eşleşmelere döndü.");
    expect(dropMessage({ kind: "noop", reason: "same", slot: "ana" }, { name: "Karnıyarık", date: TUE, recipesById })).toBe("Karnıyarık zaten Salı · Ana yemek.");
  });
});
