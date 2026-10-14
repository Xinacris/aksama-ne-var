import { describe, expect, it } from "vitest";
import { recipeSchema, type Course } from "@/data/models";
import { catalogEntry, INGREDIENT_CATALOG, normalizeIngredientName } from "@/data/seed/ingredients";
import { builtinRecipes } from "@/data/seed/recipes";

const byName = new Map(builtinRecipes.map((r) => [r.name, r]));

/** Every dish named anywhere in design/*.dc.html. */
const DESIGN_DISHES = [
  "Mercimek çorbası",
  "Ezogelin çorbası",
  "Tarhana çorbası",
  "Yayla çorbası",
  "Domates çorbası",
  "Tavuk suyu çorba",
  "Karnıyarık",
  "İzmir köfte",
  "Kuru fasulye",
  "Etli nohut",
  "Taze fasulye",
  "İmam bayıldı",
  "Mantı",
  "Fırın makarna",
  "Tavuk sote",
  "Patates oturtma",
  "Türlü",
  "Menemen",
  "Tereyağlı pirinç pilavı",
  "Bulgur pilavı",
  "Şehriyeli pilav",
  "Makarna",
  "Patates kızartması",
  "Cacık",
  "Çoban salata",
  "Piyaz",
  "Gavurdağı",
  "Haydari",
  "Turşu",
];

describe("built-in recipe seed", () => {
  it("has exactly 100 recipes", () => {
    expect(builtinRecipes).toHaveLength(100);
  });

  it("every recipe passes the schema", () => {
    for (const r of builtinRecipes) expect(recipeSchema.safeParse(r).success, r.name).toBe(true);
  });

  it("has unique ids and names", () => {
    expect(new Set(builtinRecipes.map((r) => r.id)).size).toBe(100);
    expect(new Set(builtinRecipes.map((r) => r.name)).size).toBe(100);
  });

  it("ids are url-safe slugs", () => {
    for (const r of builtinRecipes) expect(r.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("contains every dish named in the design", () => {
    for (const d of DESIGN_DISHES) expect(byName.has(d), d).toBe(true);
  });

  it("is weighted to how people eat dinner", () => {
    const count = (c: Course) => builtinRecipes.filter((r) => r.course === c).length;
    expect(count("corba")).toBe(15);
    expect(count("ana")).toBe(40);
    expect(count("yaninda")).toBe(15);
    expect(count("salata")).toBe(15);
    expect(count("kahvalti")).toBe(10);
    expect(count("tatli")).toBe(5);
  });

  it("has 4–10 steps per recipe", () => {
    for (const r of builtinRecipes) {
      expect(r.steps.length, r.name).toBeGreaterThanOrEqual(4);
      expect(r.steps.length, r.name).toBeLessThanOrEqual(10);
    }
  });

  it("uses only canonical ingredient names with catalog side/aisle", () => {
    for (const r of builtinRecipes) {
      for (const ing of r.ingredients) {
        const c = catalogEntry(ing.name);
        expect(c, `${r.name}: ${ing.name}`).toBeDefined();
        expect(ing.side).toBe(c!.side);
        expect(ing.aisle).toBe(c!.aisle);
      }
    }
  });

  it("freezer items refer to an ingredient of the recipe", () => {
    for (const r of builtinRecipes.filter((x) => x.freezerItem)) {
      expect(r.ingredients.some((i) => i.name === r.freezerItem), r.name).toBe(true);
      expect(r.prepItems.some((p) => p.freezer), r.name).toBe(true);
    }
  });

  it("has realistic household quantities", () => {
    for (const r of builtinRecipes) {
      expect(r.servings, r.name).toBeGreaterThanOrEqual(1);
      expect(r.servings, r.name).toBeLessThanOrEqual(8);
      for (const ing of r.ingredients) {
        if (ing.unit === "g") expect(ing.quantity!, `${r.name} ${ing.name}`).toBeLessThanOrEqual(1500);
        if (ing.unit === "adet") expect(ing.quantity!, `${r.name} ${ing.name}`).toBeLessThanOrEqual(12);
      }
    }
  });

  it("keeps the design's sample details", () => {
    const kofte = byName.get("İzmir köfte")!;
    expect(kofte.prepMinutes + kofte.cookMinutes).toBe(70);
    expect(kofte.freezerItem).toBe("Kıyma");
    expect(kofte.prepItems.map((p) => p.label)).toContain("Kıymayı buzluktan çıkar");
    const karni = byName.get("Karnıyarık")!;
    expect(karni.prepMinutes + karni.cookMinutes).toBe(75);
    expect(karni.tags).toEqual(["Fırında", "Kıymalı"]);
    expect(byName.get("Mantı")!.timeNote).toBe("45 dk (hazır mantıyla)");
    expect(byName.get("Etli nohut")!.tags).toEqual(["Akşamdan ıslat", "Tencere"]);
    expect(byName.get("Tavuk sote")!.freezerItem).toBe("Tavuk but");
  });

  it("catalog names are unique and normalization finds them case-insensitively", () => {
    expect(new Set(INGREDIENT_CATALOG.map((c) => c.name)).size).toBe(INGREDIENT_CATALOG.length);
    expect(normalizeIngredientName("  KIYMA ")).toBe("Kıyma");
    expect(normalizeIngredientName("sivri biber")).toBe("Sivri biber");
    expect(normalizeIngredientName("ıhlamur")).toBe("Ihlamur");
  });
});
