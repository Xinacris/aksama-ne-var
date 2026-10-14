import { describe, expect, it } from "vitest";
import { builtinRecipes } from "@/data/seed/recipes";
import { INGREDIENT_CATALOG } from "@/data/seed/ingredients";
import { BUILTIN_EN } from "@/data/seed/en";
import { ingredientLabel, localizeRecipe, localizeTask, hasLocaleText } from "@/domain/recipeText";
import { formatIngredientQuantity } from "@/domain/shopping";
import { unitAmount } from "@/domain/units";
import { setLocale, t, tagLabel } from "@/i18n";
import type { PrepTask } from "@/data/models";

describe("built-in recipes in English", () => {
  it("every built-in has English text that lines up with the Turkish", () => {
    expect(builtinRecipes).toHaveLength(100);
    for (const r of builtinRecipes) {
      const en = r.translations?.en;
      expect([r.id, !!en]).toEqual([r.id, true]);
      expect([r.id, en!.steps.length]).toEqual([r.id, r.steps.length]);
      expect([r.id, (en!.prepItems ?? []).length]).toEqual([r.id, r.prepItems.length]);
      for (const k of Object.keys(en!.notes ?? {})) expect([r.id, k, r.ingredients.some((i) => i.name === k && i.note)]).toEqual([r.id, k, true]);
      for (const i of r.ingredients.filter((x) => x.note)) expect([r.id, i.name, !!en!.notes?.[i.name]]).toEqual([r.id, i.name, true]);
      expect(r.lang).toBe("tr");
      expect(/[çğıöşüÇĞİÖŞÜ]/.test(en!.steps.join(" ").replace(/kaşar|İzmir|köfte|börek|böreği|pişi|mantı|yufka|erişte/gi, ""))).toBe(false);
    }
    expect(Object.keys(BUILTIN_EN).sort()).toEqual(builtinRecipes.map((r) => r.id).sort());
  });

  it("well-known dishes keep their Turkish name with an English hint", () => {
    expect(BUILTIN_EN["karniyarik"].name).toBe("Karnıyarık (stuffed aubergine)");
    expect(BUILTIN_EN["kuru-fasulye"].name).toBe("Kuru fasulye (white bean stew)");
  });

  it("every catalog ingredient and seed tag has an English name", () => {
    setLocale("en");
    try {
      for (const c of INGREDIENT_CATALOG) expect([c.name, ingredientLabel(c.name) !== c.name || c.name === "Tarhana" || c.name === "Spagetti"]).toEqual([c.name, true]);
      for (const r of builtinRecipes) for (const tag of r.tags) expect([tag, tagLabel(tag) !== tag || tag === "Meze" || tag === "Dolma"]).toEqual([tag, true]);
    } finally {
      setLocale("tr");
    }
  });
});

describe("localizing recipes", () => {
  const kofte = builtinRecipes.find((r) => r.id === "izmir-kofte")!;

  it("English: translated name, steps, prep labels, ingredient labels — canonical names untouched", () => {
    const en = localizeRecipe(kofte, "en");
    expect(en.name).toBe("İzmir köfte (meatball and potato bake)");
    expect(en.steps[0]).toMatch(/^Add the grated onion/);
    expect(en.prepItems[0].label).toBe("Take the mince out of the freezer");
    const mince = en.ingredients.find((i) => i.name === "Kıyma")!;
    expect(mince.label).toBe("Minced beef");
    expect(en.ingredients.find((i) => i.name === "Bayat ekmek")!.note).toBe("crumb only");
    expect(en.ingredients.map((i) => i.name)).toEqual(kofte.ingredients.map((i) => i.name));
  });

  it("Turkish: unchanged", () => {
    const tr = localizeRecipe(kofte, "tr");
    expect(tr.name).toBe("İzmir köfte");
    expect(tr.ingredients.every((i) => !i.label)).toBe(true);
  });

  it("a Turkish household recipe without English stays readable in English, with catalog ingredient names", () => {
    const own = { ...kofte, id: "own", lang: "tr" as const, translations: undefined, name: "Annemin köftesi" };
    expect(hasLocaleText(own, "en")).toBe(false);
    const en = localizeRecipe(own, "en");
    expect(en.name).toBe("Annemin köftesi");
    expect(en.ingredients.find((i) => i.name === "Kıyma")!.label).toBe("Minced beef");
  });

  it("prep tasks keep their stored Turkish label but show the translated one", () => {
    const task = { label: "Kıymayı buzluktan çıkar", recipeId: "izmir-kofte" } as PrepTask;
    expect(localizeTask(task, kofte, "en").label).toBe("Take the mince out of the freezer");
    expect(localizeTask(task, kofte, "tr").label).toBe("Kıymayı buzluktan çıkar");
  });
});

describe("units", () => {
  it("Turkish measures with a fixed size read as cups/tbsp with ml in English", () => {
    setLocale("en");
    try {
      expect(unitAmount(2, "su bardağı")).toBe("2 cups (400 ml)");
      expect(unitAmount(1, "su bardağı")).toBe("1 cup (200 ml)");
      expect(unitAmount(1, "yemek kaşığı")).toBe("1 tbsp (15 ml)");
      expect(unitAmount(1.5, "çay kaşığı")).toBe("1.5 tsp (8 ml)");
      expect(unitAmount(3, "diş")).toBe("3 cloves");
      expect(unitAmount(500, "g")).toBe("500 g");
      expect(formatIngredientQuantity({ quantity: 1.5, unit: "su bardağı" })).toBe("1.5 cups (300 ml)");
      expect(t("unit.paket")).toBe("pack");
    } finally {
      setLocale("tr");
    }
    expect(unitAmount(2, "su bardağı")).toBe("2 su bardağı");
    expect(formatIngredientQuantity({ quantity: 1.5, unit: "su bardağı" })).toBe("1,5 su bardağı");
  });
});

describe("editing in two languages", () => {
  it("an edit in English of a recipe with English text changes the translation, not the Turkish", async () => {
    const { draftForEdit, mergeEdit, parseDraft, editTarget } = await import("@/services/recipeForm");
    const raw = { ...builtinRecipes.find((r) => r.id === "izmir-kofte")!, householdId: "11111111-1111-4111-8111-111111111111" };
    expect(editTarget(raw, "en")).toBe("translation");
    setLocale("en");
    try {
      const d = draftForEdit(raw, "en");
      expect(d.name).toBe("İzmir köfte (meatball and potato bake)");
      expect(d.ingredients[0]).toMatchObject({ name: "Minced beef", key: "Kıyma" });
      d.name = "Our İzmir köfte";
      d.steps[0] = "Mix everything.";
      d.servings = "6";
      const res = parseDraft(d);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.ingredients[0].name).toBe("Kıyma");
      const out = mergeEdit(raw, res.value, "en");
      expect(out.name).toBe("İzmir köfte");
      expect(out.steps).toEqual(raw.steps);
      expect(out.prepItems.map((p) => p.label)).toEqual(raw.prepItems.map((p) => p.label));
      expect(out.translations?.en).toMatchObject({ name: "Our İzmir köfte", origin: "user" });
      expect(out.translations?.en?.steps[0]).toBe("Mix everything.");
      expect(out.servings).toBe(6);
      expect(out.lang).toBe("tr");
    } finally {
      setLocale("tr");
    }
  });

  it("an edit in the recipe's own language changes the source and keeps translations", async () => {
    const { draftForEdit, mergeEdit, parseDraft } = await import("@/services/recipeForm");
    const raw = builtinRecipes.find((r) => r.id === "menemen")!;
    const d = draftForEdit(raw, "tr");
    d.name = "Bizim menemen";
    const res = parseDraft(d);
    if (!res.ok) throw new Error(res.error);
    const out = mergeEdit(raw, res.value, "tr");
    expect(out.name).toBe("Bizim menemen");
    expect(out.translations?.en?.name).toBe(raw.translations?.en?.name);
  });

  it("an ingredient typed with its English catalog name is the same ingredient", async () => {
    const { normalizeIngredientName } = await import("@/data/seed/ingredients");
    expect(normalizeIngredientName("minced beef")).toBe("Kıyma");
    expect(normalizeIngredientName("Kıyma")).toBe("Kıyma");
    expect(normalizeIngredientName("dragon fruit")).toBe("Dragon fruit");
  });
});
