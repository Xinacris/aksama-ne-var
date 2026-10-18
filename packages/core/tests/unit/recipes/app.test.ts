import { describe, expect, it } from "vitest";
import type { Recipe } from "@/data/models";
import { generateList } from "@/domain/shopping";
import { byCuisine, cuisinesIn, removedRecipes } from "@/recipes/filters";
import { R } from "@/testing/builders";

const withWine: Recipe = {
  ...R("Et sote"),
  id: "sarapli-et",
  ingredients: [
    ...R("Et sote").ingredients,
    { name: "Kırmızı şarap", quantity: 200, unit: "ml", side: "market", aisle: "Diğer", substitute: { name: "Et suyu", quantity: 200, unit: "ml", side: "market", aisle: "Bakliyat ve kuru gıda", note: "Şarap kullanmak istemezseniz: 200 ml et suyu kullanın." } },
  ],
};

describe("catalog features in the app", () => {
  it("the shopping list buys the original by default and the alcohol-free substitute when the household chooses so", () => {
    const base = { pantry: [], manualItems: [], checks: [], recipesById: new Map([[withWine.id, withWine]]) };
    const names = (alcoholFree?: boolean) => generateList({ ...base, planned: [withWine], alcoholFree }).map((r) => r.name);
    expect(names()).toContain("Kırmızı şarap");
    expect(names()).not.toContain("Et suyu");
    expect(names(true)).toContain("Et suyu");
    expect(names(true)).not.toContain("Kırmızı şarap");
    // the recipe itself still lists both (the setting never hides the original)
    expect(withWine.ingredients.find((i) => i.name === "Kırmızı şarap")?.substitute?.name).toBe("Et suyu");
  });

  it("plans that point at a recipe that no longer exists get a 'Tarif kaldırıldı' placeholder, never on the list", () => {
    const placeholders = removedRecipes([R("Kuru fasulye")], ["kuru-fasulye", "eski-tarif", "eski-tarif"], "Tarif kaldırıldı", "2026-01-01T00:00:00.000Z");
    expect(placeholders.map((r) => [r.id, r.name, r.removed, r.ingredients.length])).toEqual([["eski-tarif", "Tarif kaldırıldı", true, 0]]);
  });

  it("cuisine filter: only cuisines present, 'all' keeps the household's own recipes", () => {
    const own = { cuisine: undefined };
    const rs = [{ cuisine: "turkish" }, { cuisine: "italian" }, own];
    expect(cuisinesIn(rs)).toEqual(["turkish", "italian"]);
    expect(rs.filter(byCuisine("italian"))).toEqual([{ cuisine: "italian" }]);
    expect(rs.filter(byCuisine("all"))).toHaveLength(3);
  });
});

describe("Supabase seed export", () => {
  it("one row per recipe, ingredient (with substitute columns), step, tag and prep item; SQL escapes quotes", async () => {
    const { CATALOG_FILES } = await import("../../../data/recipes/index");
    const { seedTables, toSql, toCsv } = await import("@/recipes/export");
    const recipes = Object.values(CATALOG_FILES).flat() as import("@/recipes/schema").CatalogRecipe[];
    const t = seedTables(recipes);
    expect(t.recipes).toHaveLength(recipes.length);
    expect(t.recipe_ingredients.length).toBe(recipes.reduce((n, r) => n + r.ingredients.length, 0));
    expect(Object.keys(t.recipe_ingredients[0])).toEqual(expect.arrayContaining(["substitute_pantry_key", "substitute_note_tr", "substitute_reason"]));
    expect(t.pantry_items.every((p) => p.aisle)).toBe(true);
    const sql = toSql(t);
    expect(sql).toMatch(/create table if not exists recipe_ingredients/);
    expect(toSql({ ...t, recipes: [{ ...t.recipes[0], title_tr: "Ali'nin pilavı" }] })).toContain("'Ali''nin pilavı'");
    expect(toCsv([{ a: 'x,"y"', b: null }])).toBe('a,b\n"x,""y""",\n');
  });
});
