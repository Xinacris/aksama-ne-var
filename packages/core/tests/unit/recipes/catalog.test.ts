import { describe, expect, it } from "vitest";
import { CATALOG_FILES } from "../../../data/recipes/index";
import dishes from "../../../data/recipes/dish-list.json";
import { builtinRecipes } from "@/data/seed/recipes";
import { catalogRecipes } from "@/recipes/catalog";
import { formatReport, validateCatalog } from "@/recipes/validate";

describe("the recipe catalog", () => {
  it("passes the validator (partial: generation is still running), the dish list matches the matrix", () => {
    const report = validateCatalog({ dishes, files: CATALOG_FILES }, { partial: true });
    expect(report.ok, formatReport(report, { partial: true })).toBe(true);
    expect(report.totals.dishes).toBe(1000);
    expect(dishes.filter((d) => d.existing)).toHaveLength(100);
  });

  it("the 100 original built-ins come back from the catalog unchanged for the app", () => {
    const byId = new Map(catalogRecipes.map((r) => [r.id, r]));
    for (const old of builtinRecipes) {
      const now = byId.get(old.id);
      expect(now, old.id).toBeDefined();
      const pick = (r: typeof old) => ({
        name: r.name,
        shortName: r.shortName,
        // mercimek köftesi moved from salads to sides (the spec's own example)
        course: r.id === "mercimek-koftesi" ? "yaninda" : r.course,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        waitMinutes: r.waitMinutes,
        timeNote: r.timeNote,
        servings: r.servings,
        tags: [...r.tags].sort(),
        ingredients: r.ingredients,
        steps: r.steps,
        prepItems: r.prepItems,
        freezerItem: r.freezerItem,
        leftoverPolicy: r.leftoverPolicy,
        leftoverDays: r.leftoverDays,
        en: { ...r.translations!.en!, ingredients: undefined },
        lang: r.lang,
      });
      const expected = pick(old);
      const actual = { ...pick(now!), course: now!.course };
      expect(actual, old.id).toEqual(expected);
      expect(now!.catalogId).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
