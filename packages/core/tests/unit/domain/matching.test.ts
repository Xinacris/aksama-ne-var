import { describe, expect, it } from "vitest";
import type { Favorite, Swipe } from "@/data/models";
import { builtinRecipes } from "@/data/seed/recipes";
import { buildDeck, courseToSlot, isMatch, nextCard, progress, sortMatches, swipesFor } from "@/domain/matching";
import { lastCookedMap, rotationLabel, rotationShort, daysSinceCooked } from "@/domain/rotation";
import { match, R } from "@/testing/builders";

const fav = (name: string): Favorite => ({ id: name, householdId: "h", recipeId: R(name).id, createdBy: "ali", createdAt: "", updatedAt: "" });
const cook = (name: string, date: string) => ({ id: name + date, householdId: "h", recipeId: R(name).id, date, createdBy: "ali", createdAt: "", updatedAt: "" });
const swipe = (userId: string, name: string, decision: "like" | "pass", date = "2026-10-13"): Swipe => ({
  id: `${userId}-${name}`,
  householdId: "h",
  userId,
  recipeId: R(name).id,
  date,
  slot: "ana",
  decision,
  createdBy: userId,
  createdAt: "",
  updatedAt: "",
});

describe("deck building", () => {
  const base = { recipes: builtinRecipes, slot: "ana" as const, date: "2026-10-13", plannedRecipeIds: new Set<string>(), matches: [] };

  it("puts favorites first, least recently cooked first", () => {
    const deck = buildDeck({
      ...base,
      favorites: [fav("Karnıyarık"), fav("Taze fasulye"), fav("Fırın makarna")],
      lastCooked: lastCookedMap([cook("Karnıyarık", "2026-09-21"), cook("Taze fasulye", "2026-10-02"), cook("Fırın makarna", "2026-09-07")]),
    });
    expect(deck.slice(0, 3).map((r) => r.name)).toEqual(["Fırın makarna", "Karnıyarık", "Taze fasulye"]);
    expect(deck).toHaveLength(12);
  });

  it("puts never-cooked favorites before cooked ones", () => {
    const deck = buildDeck({
      ...base,
      favorites: [fav("Karnıyarık"), fav("Mantı")],
      lastCooked: lastCookedMap([cook("Karnıyarık", "2026-09-21")]),
    });
    expect(deck[0].name).toBe("Mantı");
  });

  it("only includes dishes that fit the slot and leaves out planned or matched ones", () => {
    const deck = buildDeck({
      ...base,
      favorites: [fav("Karnıyarık"), fav("Cacık"), fav("Menemen")],
      lastCooked: new Map(),
      plannedRecipeIds: new Set([R("Karnıyarık").id]),
      matches: [match("Menemen", { date: "2026-10-13", slot: "ana" })],
    });
    const names = deck.map((r) => r.name);
    expect(names).not.toContain("Karnıyarık");
    expect(names).not.toContain("Cacık");
    expect(names).not.toContain("Menemen");
    expect(deck.every((r) => r.course === "ana" || r.course === "kahvalti")).toBe(true);
  });

  it("is deterministic for both members", () => {
    const args = { ...base, favorites: [fav("Karnıyarık")], lastCooked: new Map() };
    expect(buildDeck(args).map((r) => r.id)).toEqual(buildDeck(args).map((r) => r.id));
  });

  it("maps courses to slots", () => {
    expect(courseToSlot("kahvalti")).toBe("ana");
    expect(courseToSlot("salata")).toBe("salata");
    expect(courseToSlot("tatli")).toBe("tatli");
  });
});

describe("matching rules", () => {
  const deck = [R("Karnıyarık"), R("Fırın makarna"), R("Etli nohut")];

  it("advances each member independently", () => {
    const swipes = [swipe("ali", "Karnıyarık", "like"), swipe("zeynep", "Karnıyarık", "pass"), swipe("zeynep", "Fırın makarna", "pass")];
    expect(nextCard(deck, swipesFor(swipes, "2026-10-13", "ana", "ali"))?.name).toBe("Fırın makarna");
    expect(nextCard(deck, swipesFor(swipes, "2026-10-13", "ana", "zeynep"))?.name).toBe("Etli nohut");
    expect(progress(deck, swipesFor(swipes, "2026-10-13", "ana", "zeynep"))).toBe(2);
  });

  it("matches only when every member liked the same card for the same day", () => {
    const members = ["ali", "zeynep"];
    expect(isMatch([swipe("ali", "Karnıyarık", "like")], R("Karnıyarık").id, "2026-10-13", "ana", members)).toBe(false);
    const both = [swipe("ali", "Karnıyarık", "like"), swipe("zeynep", "Karnıyarık", "like")];
    expect(isMatch(both, R("Karnıyarık").id, "2026-10-13", "ana", members)).toBe(true);
    const oneSaysNo = [swipe("ali", "Karnıyarık", "like"), swipe("zeynep", "Karnıyarık", "pass")];
    expect(isMatch(oneSaysNo, R("Karnıyarık").id, "2026-10-13", "ana", members)).toBe(false);
    const otherDay = [swipe("ali", "Karnıyarık", "like"), swipe("zeynep", "Karnıyarık", "like", "2026-10-14")];
    expect(isMatch(otherDay, R("Karnıyarık").id, "2026-10-13", "ana", members)).toBe(false);
  });

  it("a solo member matches on their own like; nobody never matches", () => {
    expect(isMatch([swipe("ali", "Karnıyarık", "like")], R("Karnıyarık").id, "2026-10-13", "ana", ["ali"])).toBe(true);
    expect(isMatch([], R("Karnıyarık").id, "2026-10-13", "ana", [])).toBe(false);
  });

  it("returns null when the deck is finished", () => {
    const all = deck.map((r) => swipe("ali", r.name, "pass"));
    expect(nextCard(deck, all)).toBeNull();
  });

  it("sorts open matches before placed ones", () => {
    const sorted = sortMatches([
      match("Karnıyarık", { status: "placed", updatedAt: "3" }),
      match("Mantı", { status: "open", updatedAt: "1" }),
      match("Etli nohut", { status: "returned", updatedAt: "2" }),
    ]);
    expect(sorted.map((m) => m.status)).toEqual(["returned", "open", "placed"]);
  });
});

describe("rotation memory", () => {
  it("phrases how long ago a dish was made", () => {
    const last = lastCookedMap([cook("Karnıyarık", "2026-09-01"), cook("Karnıyarık", "2026-09-21")]);
    const days = daysSinceCooked(R("Karnıyarık").id, last, "2026-10-12");
    expect(days).toBe(21);
    expect(rotationLabel(days)).toBe("En son 3 hafta önce yaptınız");
    expect(rotationShort(days)).toBe("en son 3 hafta önce");
    expect(rotationLabel(null)).toBe("Henüz birlikte yapmadınız");
    expect(rotationLabel(10, true)).toBe("En son 10 gün önce yaptın");
  });
});
