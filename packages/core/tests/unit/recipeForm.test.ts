import { describe, expect, it } from "vitest";
import { builtinRecipes } from "@/data/seed/recipes";
import { draftFromRecipe, emptyDraft, genelSummary, initialOpen, parseDraft, prepSummary, sourceSummary } from "@/services/recipeForm";

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

describe("Ayrıntılar sections", () => {
  it("a blank new recipe starts with every section closed, even with the default times", () => {
    expect(initialOpen(emptyDraft("Annemin dolması"), false)).toEqual({ genel: false, prep: false, source: false });
  });

  it("edits open the sections that hold values", () => {
    const kofte = draftFromRecipe(builtinRecipes.find((x) => x.name === "İzmir köfte")!);
    expect(initialOpen(kofte, true)).toEqual({ genel: true, prep: true, source: false });
    const stub = emptyDraft("Annemin dolması");
    stub.prepMinutes = "0";
    stub.cookMinutes = "0";
    expect(initialOpen(stub, true)).toEqual({ genel: false, prep: false, source: false });
    const kept = { ...stub, leftoverPolicy: "store" as const, source: "Annemin defteri" };
    expect(initialOpen(kept, true).source).toBe(true);
  });

  it("closed sections show what they hold", () => {
    const d = emptyDraft("x");
    expect(genelSummary(d)).toBe("15 dk hazırlık · 30 dk pişirme · 4 kişilik");
    d.waitMinutes = "90";
    d.cookMinutes = "120";
    d.tags = "Fırında, Kıymalı, Akşamdan ıslat";
    expect(genelSummary(d)).toBe("15 dk hazırlık · 2 sa pişirme · 1 sa 30 dk bekleme · 4 kişilik · Fırında, Kıymalı +1");
    expect(prepSummary(d)).toBe("Yok");
    d.prepItems = [{ label: "Kıymayı buzluktan çıkar", offset: "morning", freezer: true }];
    d.freezerItem = "Kıyma";
    expect(prepSummary(d)).toBe("1 hatırlatma · buzluktan: kıyma");
    expect(sourceSummary(d)).toBe("Artmaz");
    d.leftoverPolicy = "store";
    d.leftoverDays = "3";
    d.source = "Annemin defteri";
    expect(sourceSummary(d)).toBe("Annemin defteri · 3 gün saklanır");
  });
});
