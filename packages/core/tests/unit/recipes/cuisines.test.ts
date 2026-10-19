import { describe, expect, it } from "vitest";
import { memoryStore } from "@/data/storage";
import { buildDeck, cuisineDeck, DECK_SIZE, nextCard } from "@/domain/matching";
import { i18n, setLocale, t } from "@/i18n";
import { catalogRecipes } from "@/recipes/catalog";
import {
  activeCuisines,
  availableCuisines,
  CUISINE_ORDER,
  cuisineLabelKey,
  filterDeckByCuisines,
  readSwipeCuisines,
  sanitizeCuisines,
  SWIPE_CUISINES_KEY,
  toggleCuisine,
  writeSwipeCuisines,
} from "@/recipes/cuisines";
import { CUISINES } from "@/recipes/schema";
import type { Swipe } from "@/data/models";

const rs = [{ cuisine: "turkish" }, { cuisine: "italian" }, { cuisine: "indian" }, { cuisine: undefined }, { cuisine: "italian" }];

describe("cuisines", () => {
  it("orders every catalog cuisine exactly once", () => {
    expect([...CUISINE_ORDER].sort()).toEqual([...CUISINES].sort());
  });

  it("filterDeckByCuisines: nothing selected keeps all (household recipes too); a selection is OR within cuisines", () => {
    expect(filterDeckByCuisines(rs, [])).toHaveLength(5);
    expect(filterDeckByCuisines(rs, ["italian", "indian"]).map((r) => r.cuisine)).toEqual(["italian", "indian", "italian"]);
    expect(filterDeckByCuisines(rs, ["french"])).toEqual([]);
  });

  it("availableCuisines lists only cuisines with recipes, in table order", () => {
    expect(availableCuisines([{ cuisine: "british" }, { cuisine: "indian" }, { cuisine: "turkish" }, { cuisine: undefined }])).toEqual(["turkish", "indian", "british"]);
  });

  it("sanitizeCuisines drops unknown keys and junk silently, dedupes, orders", () => {
    expect(sanitizeCuisines(["british", "klingon", "italian", "italian", 3, null])).toEqual(["italian", "british"]);
    expect(sanitizeCuisines("italian")).toEqual([]);
  });

  it("activeCuisines: a selected cuisine with no recipes here stops filtering; none left = all", () => {
    expect(activeCuisines(["italian", "british"], ["turkish", "italian"])).toEqual(["italian"]);
    expect(activeCuisines(["british"], ["turkish"])).toEqual([]);
  });

  it("toggleCuisine adds and removes in display order", () => {
    expect(toggleCuisine([], "indian")).toEqual(["indian"]);
    expect(toggleCuisine(["indian"], "italian")).toEqual(["italian", "indian"]);
    expect(toggleCuisine(["italian", "indian"], "italian")).toEqual(["indian"]);
  });

  it("persists the selection; unknown stored keys and broken JSON are dropped; storage errors don't throw", () => {
    const store = memoryStore();
    writeSwipeCuisines(store, ["indian", "italian"]);
    expect(readSwipeCuisines(store)).toEqual(["italian", "indian"]);
    store.setItem(SWIPE_CUISINES_KEY, '["italian","martian"]');
    expect(readSwipeCuisines(store)).toEqual(["italian"]);
    store.setItem(SWIPE_CUISINES_KEY, "{oops");
    expect(readSwipeCuisines(store)).toEqual([]);
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readSwipeCuisines(broken)).toEqual([]);
    expect(() => writeSwipeCuisines(broken, ["italian"])).not.toThrow();
    expect(readSwipeCuisines(null)).toEqual([]);
  });

  it("has a short and a long label for every cuisine in both languages (Endonezya, not Endonez)", () => {
    for (const lng of ["tr", "en"] as const) {
      for (const c of CUISINES)
        for (const form of ["short", "long"] as const) {
          expect(i18n.exists(cuisineLabelKey(c, form), { lng }), `${lng} ${c} ${form}`).toBe(true);
        }
    }
    setLocale("tr");
    expect(t(cuisineLabelKey("indonesian", "short"))).toBe("Endonezya");
    expect(t(cuisineLabelKey("indonesian", "long"))).toBe("Endonezya mutfağı");
    setLocale("en");
    expect(t(cuisineLabelKey("british", "long"))).toBe("British cuisine");
    setLocale("tr");
  });
});

describe("cuisineDeck (swipe screen)", () => {
  const pool = buildDeck({ recipes: catalogRecipes, favorites: [], lastCooked: new Map(), slot: "ana", date: "2026-10-13", plannedRecipeIds: new Set(), matches: [], size: Infinity });

  it("no selection = the usual deck", () => {
    const { deck, active } = cuisineDeck(pool, []);
    expect(active).toEqual([]);
    expect(deck.map((r) => r.id)).toEqual(pool.slice(0, DECK_SIZE).map((r) => r.id));
  });

  it("İtalyan + Hint fills a full deck with only Italian and Indian dishes, filtered before the cap", () => {
    const { deck, available } = cuisineDeck(pool, ["italian", "indian"]);
    expect(available).toEqual(CUISINE_ORDER);
    expect(deck).toHaveLength(DECK_SIZE);
    expect(new Set(deck.map((r) => r.cuisine))).toEqual(new Set(["italian", "indian"]));
  });

  it("changing the selection never brings back a card already swiped", () => {
    const first = cuisineDeck(pool, ["italian"]).deck;
    const mine: Swipe[] = first.slice(0, 3).map((r, i) => ({ id: `s${i}`, householdId: "h", userId: "me", recipeId: r.id, date: "2026-10-13", slot: "ana", decision: "pass", createdBy: "me", createdAt: "", updatedAt: "" }));
    const next = nextCard(cuisineDeck(pool, ["italian", "indian"]).deck, mine);
    expect(next).not.toBeNull();
    expect(mine.map((s) => s.recipeId)).not.toContain(next!.id);
  });

  it("a cuisine with nothing for the slot gets no pill, and selecting only it falls back to all", () => {
    const soups = buildDeck({ recipes: catalogRecipes.filter((r) => r.cuisine !== "british"), favorites: [], lastCooked: new Map(), slot: "corba", date: "2026-10-13", plannedRecipeIds: new Set(), matches: [], size: Infinity });
    const { available, active, deck } = cuisineDeck(soups, ["british"]);
    expect(available).not.toContain("british");
    expect(active).toEqual([]);
    expect(deck).toHaveLength(DECK_SIZE);
  });
});
