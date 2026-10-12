import { describe, expect, it } from "vitest";
import { builtinRecipes } from "@/data/seed/recipes";
import { draftFromRecipe, emptyDraft, parseDraft } from "@/services/recipeForm";

describe("recipe form", () => {
  it("round-trips a built-in recipe", () => {
    const r = builtinRecipes.find((x) => x.name === "İzmir köfte")!;
    const res = parseDraft(draftFromRecipe(r));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.ingredients).toEqual(r.ingredients);
      expect(res.value.prepItems).toEqual(r.prepItems);
      expect(res.value.freezerItem).toBe("Kıyma");
    }
  });

  it("normalizes names, parses Turkish decimals and skips empty rows", () => {
    const d = emptyDraft("Annemin dolması");
    d.ingredients = [
      { name: "kıyma", quantity: "0,5", unit: "kg", side: "market", aisle: "Kasap" },
      { name: "", quantity: "", unit: "adet", side: "market", aisle: "Diğer" },
    ];
    d.steps = ["Doldur.", "  "];
    d.tags = "fırında, kıymalı";
    const res = parseDraft(d);
    expect(res.ok && res.value.ingredients).toEqual([{ name: "Kıyma", quantity: 0.5, unit: "kg", side: "market", aisle: "Kasap" }]);
    expect(res.ok && res.value.steps).toEqual(["Doldur."]);
    expect(res.ok && res.value.tags).toEqual(["Fırında", "Kıymalı"]);
  });

  it("returns calm errors", () => {
    expect(parseDraft(emptyDraft(""))).toEqual({ ok: false, error: "Tarifin adını yazar mısın?" });
    const d = emptyDraft("X");
    d.servings = "0";
    expect(parseDraft(d)).toMatchObject({ ok: false, error: expect.stringMatching(/Kişi sayısı/) });
    const e = emptyDraft("X");
    e.ingredients = [{ name: "Domates", quantity: "çok", unit: "adet", side: "pazar", aisle: "Sebze" }];
    expect(parseDraft(e)).toMatchObject({ ok: false, error: expect.stringMatching(/Domates/) });
    const f = emptyDraft("X");
    f.freezerItem = "Kıyma";
    expect(parseDraft(f)).toMatchObject({ ok: false, error: expect.stringMatching(/Buzluktan/) });
  });
});
