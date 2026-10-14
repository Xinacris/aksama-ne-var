import { describe, expect, it } from "vitest";
import {
  consumePantry,
  formatAmount,
  formatIngredientQuantity,
  generateList,
  groupList,
  ingredientKey,
  ingredientStatus,
  planFinish,
  remainingNote,
  sideCount,
  toBase,
  type ListInput,
} from "@/domain/shopping";
import type { ShoppingItem } from "@/data/models";
import { check, pantry, R, recipesById } from "@/testing/builders";

function list(planned: string[], extra: Partial<ListInput> = {}) {
  return generateList({
    planned: planned.map(R),
    pantry: [],
    manualItems: [],
    checks: [],
    recipesById,
    ...extra,
  });
}
const row = (rows: ReturnType<typeof list>, name: string) => rows.find((r) => r.name === name);

describe("unit conversion", () => {
  it("converts kitchen measures into the base unit", () => {
    expect(toBase("Kırmızı mercimek", 1.5, "su bardağı")).toEqual({ amount: 270, unit: "g" });
    expect(toBase("Domates", 3, "adet")).toEqual({ amount: 450, unit: "g" });
    expect(toBase("Kıyma", 0.5, "kg")).toEqual({ amount: 500, unit: "g" });
    expect(toBase("Süt", 1, "l")).toEqual({ amount: 1000, unit: "ml" });
    expect(toBase("Sarımsak", 2, "diş")).toEqual({ amount: 2, unit: "adet" });
    expect(toBase("Biber salçası", 1, "kavanoz")).toEqual({ amount: 700, unit: "g" });
  });

  it("keeps unconvertible measures in their own unit", () => {
    expect(toBase("Maydanoz", 50, "g")).toEqual({ amount: 50, unit: "g" });
    expect(toBase("Ev yapımı erişte", 2, "su bardağı")).toEqual({ amount: 400, unit: "ml" });
  });

  it("rounds to how things are sold", () => {
    expect(formatAmount("Kıyma", { amount: 300, unit: "g" })).toBe("500 g");
    expect(formatAmount("Baldo pirinç", { amount: 360, unit: "g" })).toBe("1 kg");
    expect(formatAmount("Domates", { amount: 1350, unit: "g" })).toBe("1,5 kg");
    expect(formatAmount("Patates", { amount: 600, unit: "g" })).toBe("1 kg");
    expect(formatAmount("Yumurta", { amount: 4, unit: "adet" })).toBe("10 adet");
    expect(formatAmount("Yumurta", { amount: 12, unit: "adet" })).toBe("20 adet");
    expect(formatAmount("Arpa şehriye", { amount: 85, unit: "g" })).toBe("1 paket");
    expect(formatAmount("Sarımsak", { amount: 12, unit: "adet" })).toBe("2 baş");
    expect(formatAmount("Maydanoz", { amount: 1.5, unit: "demet" })).toBe("2 demet");
  });

  it("formats recipe-side quantities like the design", () => {
    expect(formatIngredientQuantity({ quantity: 500, unit: "g" })).toBe("500 g");
    expect(formatIngredientQuantity({ quantity: 3, unit: "adet" })).toBe("3");
    expect(formatIngredientQuantity({ quantity: 1.5, unit: "su bardağı" })).toBe("1,5 su bardağı");
    expect(formatIngredientQuantity({ quantity: 3, unit: "adet" }, 0.5)).toBe("1,5");
    expect(formatIngredientQuantity({ quantity: null, unit: null })).toBe("");
  });
});

describe("generateList", () => {
  it("reproduces the design's week list", () => {
    const rows = list([
      "Mercimek çorbası",
      "İzmir köfte",
      "Tereyağlı pirinç pilavı",
      "Çoban salata",
      "Karnıyarık",
      "Şehriyeli pilav",
      "Cacık",
      "Menemen",
    ]);
    expect(row(rows, "Kemer patlıcan")?.quantityText).toBe("6 adet");
    expect(row(rows, "Sivri biber")?.quantityText).toBe("15 adet");
    expect(row(rows, "Salatalık")?.quantityText).toBe("4 adet");
    expect(row(rows, "Maydanoz")?.quantityText).toBe("1 demet");
    expect(row(rows, "Süzme yoğurt")?.quantityText).toBe("1 kg");
    expect(row(rows, "Yumurta")?.quantityText).toBe("10 adet");
    expect(row(rows, "Arpa şehriye")?.quantityText).toBe("1 paket");
    expect(row(rows, "Biber salçası")?.quantityText).toBe("1 kavanoz");
    expect(row(rows, "Kemer patlıcan")?.forLabel).toBe("Karnıyarık");
    expect(row(rows, "Salatalık")?.forLabel).toBe("Çoban salata · Cacık");
    expect(row(rows, "Tereyağı")?.forLabel).toContain("Pirinç pilavı");
  });

  it("aggregates the same ingredient across recipes with unit merging", () => {
    const rows = list(["İzmir köfte", "Karnıyarık"]);
    // 500 g + 300 g kıyma → 800 g → rounded to 250 g packs
    expect(row(rows, "Kıyma")?.amounts).toEqual([{ amount: 800, unit: "g" }]);
    expect(row(rows, "Kıyma")?.quantityText).toBe("1 kg");
    // 3 + 3 domates pieces merge in grams
    expect(row(rows, "Domates")?.amounts).toEqual([{ amount: 900, unit: "g" }]);
  });

  it("never lists pantry staples", () => {
    const rows = list(["İzmir köfte"]);
    expect(row(rows, "Tuz")).toBeUndefined();
    expect(row(rows, "Kimyon")).toBeUndefined();
    expect(row(rows, "Bayat ekmek")).toBeUndefined();
  });

  it("subtracts measured pantry items and drops covered rows", () => {
    const rows = list(["İzmir köfte", "Karnıyarık"], { pantry: [pantry("Kıyma", 500, "g")] });
    expect(row(rows, "Kıyma")?.amounts).toEqual([{ amount: 300, unit: "g" }]);
    const covered = list(["İzmir köfte"], { pantry: [pantry("Kıyma", 1, "kg")] });
    expect(row(covered, "Kıyma")).toBeUndefined();
  });

  it("drops rows marked 'evde var' without a quantity", () => {
    const rows = list(["İzmir köfte"], { pantry: [pantry("Patates", null, null)] });
    expect(row(rows, "Patates")).toBeUndefined();
  });

  it("keeps different-unit parts that cannot merge", () => {
    const custom = { ...R("Çoban salata"), id: "x", ingredients: [{ ...R("Çoban salata").ingredients[4], quantity: 50, unit: "g" as const }] };
    const rows = generateList({
      planned: [R("Çoban salata"), custom],
      pantry: [],
      manualItems: [],
      checks: [],
      recipesById: new Map([...recipesById, ["x", custom]]),
    });
    expect(row(rows, "Maydanoz")?.quantityText).toBe("1 demet + 50 g");
  });

  it("adds manual items and attaches checks", () => {
    const manual: ShoppingItem = {
      id: "m1",
      householdId: "h",
      name: "Deterjan",
      quantity: null,
      unit: null,
      side: "market",
      aisle: "Diğer",
      forRecipeId: null,
      createdBy: "ali",
      createdAt: "",
      updatedAt: "",
    };
    const rows = list(["Cacık"], { manualItems: [manual], checks: [check(ingredientKey("Salatalık"), "zeynep")] });
    expect(row(rows, "Deterjan")).toMatchObject({ key: "m:m1", forLabel: "Elle eklendi", manualItemId: "m1" });
    expect(row(rows, "Salatalık")?.checkedBy).toBe("zeynep");
  });

  it("handles an empty plan", () => {
    expect(list([])).toEqual([]);
    expect(remainingNote([])).toBe("Liste boş");
  });

  it("ignores recipes that no longer exist in labels", () => {
    const rows = generateList({ planned: [R("Cacık")], pantry: [], manualItems: [], checks: [], recipesById: new Map() });
    expect(row(rows, "Salatalık")?.forLabel).toBe("");
  });
});

describe("grouping and counts", () => {
  const rows = list(["İzmir köfte", "Karnıyarık", "Cacık", "Mercimek çorbası"]);

  it("groups market rows by aisle in store order", () => {
    const g = groupList(rows, "market");
    expect(g.map((x) => x.title)).toEqual(["Kasap", "Süt ve kahvaltılık", "Bakliyat ve kuru gıda"]);
    expect(g[0].note).toBe("1 kaldı");
  });

  it("groups pazar rows into Sebze / Meyve / Yeşillik", () => {
    const g = groupList(rows, "pazar");
    expect(g.map((x) => x.title)).toEqual(["Sebze", "Meyve"]);
    expect(g[0].items.map((i) => i.name)).toEqual([...g[0].items.map((i) => i.name)].sort((a, b) => a.localeCompare(b, "tr")));
  });

  it("shows x/y once something is checked and 'tamam' when a group is done", () => {
    const checked = rows.map((r) => (r.name === "Kıyma" ? { ...r, checkedBy: "ali" } : r));
    expect(sideCount(rows, "market")).toBe(String(rows.filter((r) => r.side === "market").length));
    expect(sideCount(checked, "market")).toBe(`1/${rows.filter((r) => r.side === "market").length}`);
    expect(groupList(checked, "market")[0].note).toBe("tamam");
    expect(remainingNote(checked)).toBe(`${rows.length - 1} ürün kaldı · alınmayanlar listede bekler`);
  });

  it("all items checked", () => {
    const all = rows.map((r) => ({ ...r, checkedBy: "ali" }));
    expect(remainingNote(all)).toMatch(/Hepsi alındı/);
  });
});

describe("finishing and pantry", () => {
  it("moves bought rows to the pantry at the bought (pack) amount", () => {
    const rows = list(["Karnıyarık"]).map((r) => (r.name === "Kıyma" || r.name === "Domates" ? { ...r, checkedBy: "ali" } : r));
    const plan = planFinish(rows);
    expect(plan.boughtCount).toBe(2);
    expect(plan.pantryAdds).toContainEqual({ name: "Kıyma", quantity: 500, unit: "g" });
    expect(plan.pantryAdds).toContainEqual({ name: "Domates", quantity: 450, unit: "g" });
    // after finishing, the bought rows disappear and the rest remain
    const after = generateList({
      planned: [R("Karnıyarık")],
      pantry: plan.pantryAdds.map((p) => pantry(p.name, p.quantity, p.unit)),
      manualItems: [],
      checks: [],
      recipesById,
    });
    expect(row(after, "Kıyma")).toBeUndefined();
    expect(row(after, "Kemer patlıcan")).toBeDefined();
  });

  it("consumes measured pantry when a dish is cooked", () => {
    const stock = [pantry("Kıyma", 800, "g"), pantry("Patates", null, null)];
    const { update, remove } = consumePantry(stock, R("İzmir köfte"));
    expect(update).toHaveLength(1);
    expect(update[0].quantity).toBe(300);
    expect(remove).toEqual([]);
    const { remove: gone } = consumePantry([pantry("Kıyma", 500, "g")], R("İzmir köfte"));
    expect(gone).toHaveLength(1);
  });

  it("derives ingredient status for the recipe page", () => {
    const rows = list(["İzmir köfte"]);
    const kofte = R("İzmir köfte");
    const ing = (n: string) => kofte.ingredients.find((i) => i.name === n)!;
    expect(ingredientStatus(ing("Patates"), rows, [])).toBe("listede");
    expect(ingredientStatus(ing("Kimyon"), rows, [])).toBe("evde");
    expect(ingredientStatus(ing("Patates"), [], [])).toBe("eksik");
    expect(ingredientStatus(ing("Patates"), [], [pantry("Patates", null, null)])).toBe("evde");
  });
});
