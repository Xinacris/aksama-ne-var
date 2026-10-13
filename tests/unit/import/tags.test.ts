import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRecipeText } from "@/domain/import/parseText";
import { filterTags, keywordTags, mergeTags, normalizeTag } from "@/domain/import/tags";
import { cookTimeLooksLong, isWaitingStep } from "@/domain/import/timing";
import { validateDraft } from "@/server/llm/validate";
import { draftTimes, toRecipeDraft } from "@/services/importDraft";

const fixture = (n: string) => readFileSync(`tests/fixtures/captions/${n}.txt`, "utf8");
const ing = (...items: string[]) => items.map((item) => ({ item }));

describe("tag vocabulary", () => {
  it("keeps only vocabulary values, in the app's spelling, without duplicates", () => {
    expect(filterTags(["Kızartma", "tencerede", "Balıklı", "Etsiz", "Baklagil", "Lezzetli", "Kızartma", 42, "Fit", "Marine"])).toEqual([
      "Kızartma",
      "Tencere",
      "Balık",
      "Vejetaryen",
      "Bakliyat",
      "Marine",
    ]);
    expect(normalizeTag("ızgara")).toBe("Izgara");
    expect(normalizeTag("Akşamdan ıslat")).toBe("Akşamdan ıslat");
    expect(normalizeTag("Hızlı")).toBeNull(); // existing tag, but not one an import may guess
    expect(filterTags("Kızartma")).toEqual([]);
  });

  it("merges with existing tags, case-insensitive, existing first", () => {
    expect(mergeTags("Hızlı, fırında", ["Fırında", "Tavuklu"])).toBe("Hızlı, fırında, Tavuklu");
    expect(mergeTags("", ["Kızartma"])).toBe("Kızartma");
    expect(mergeTags(" , ", [])).toBe("");
  });

  it("LLM output: tag fields filtered through the same validator for Gemini and Claude", () => {
    const d = validateDraft({
      name: "Fish and chips",
      servings: 4,
      role: "ana",
      totalMinutes: null,
      prepMinutes: 20,
      cookMinutes: 15,
      waitMinutes: 90,
      ingredients: [{ amount: 600, unit: "g", item: "morina", side: "market" }],
      steps: [{ text: "Kızartın.", minutes: 7 }],
      prep: [],
      cookingMethods: ["Kızartma", "Deep fry"],
      mainIngredients: ["Balıklı", "Seafood"],
      prepTags: ["Dinlendirme", "Akşamdan ıslat ama değil"],
    })!;
    expect(d.tags).toEqual(["Kızartma", "Balık", "Dinlendirme"]);
    expect(d).toMatchObject({ prepMinutes: 20, cookMinutes: 15, waitMinutes: 90 });
    expect(d).not.toHaveProperty("cookingMethods");
  });
});

describe("rule keywords", () => {
  it("cooking methods", () => {
    expect(keywordTags("Kızgın yağda kızartın.", [])).toContain("Kızartma");
    expect(keywordTags("200 derece fırında 40 dakika pişirin.", [])).toEqual(["Fırında"]);
    expect(keywordTags("Izgarada iki yüzünü pişirin.", [])).toContain("Izgara");
    expect(keywordTags("Tencereye alıp kısık ateşte pişirin.", [])).toContain("Tencere");
    expect(keywordTags("Tavada sotele.", [])).toContain("Tavada");
    expect(keywordTags("Tavuğu tavada sotele.", [])).toContain("Tavada");
    // a hot-oil temperature is not an oven
    expect(keywordTags("180 derece kızgın yağda kızartın.", [])).not.toContain("Fırında");
    // "haşlanmış nohut" in the ingredients is not boiling
    expect(keywordTags("1 su bardağı haşlanmış nohut", ing("nohut"))).not.toContain("Haşlama");
  });

  it("main ingredient", () => {
    expect(keywordTags("Morina balığını una bulayın.", ing("morina balığı"))).toContain("Balık");
    expect(keywordTags("", ing("kıyma", "soğan", "ekmek"))).toEqual(["Kıymalı"]);
    expect(keywordTags("", ing("tavuk but", "patates", "biber"))).toEqual(["Tavuklu"]);
    expect(keywordTags("", ing("dana kuşbaşı", "soğan", "salça"))).toEqual(["Etli"]);
    expect(keywordTags("", ing("kırmızı mercimek", "soğan", "havuç"))).toEqual(["Bakliyat", "Vejetaryen"]);
    expect(keywordTags("", ing("patlıcan", "biber", "yoğurt"))).toEqual(["Vejetaryen"]);
    // "marine et", "servis et": the verb is not meat; taze fasulye is not a legume
    expect(keywordTags("Marine edin ve servis et.", ing("taze fasulye", "domates", "soğan"))).toEqual(["Vejetaryen", "Marine"]);
    // too few ingredients to call it vegetarian
    expect(keywordTags("", ing("yumurta"))).toEqual([]);
  });

  it("prep only when the text says so", () => {
    expect(keywordTags("Nohutları akşamdan ıslatın.", [])).toContain("Akşamdan ıslat");
    expect(keywordTags("Hamuru 1 saat dinlendirin.", [])).toContain("Dinlendirme");
    expect(keywordTags("Hamuru yoğurun.", [])).not.toContain("Dinlendirme");
  });
});

describe("times: Pişirme is heat only", () => {
  it("waiting steps are told apart from cooking", () => {
    expect(isWaitingStep("Hamuru buzdolabında 1 saat dinlendirin.")).toBe(true);
    expect(isWaitingStep("Tavukları marine edip 30 dakika bekletin.")).toBe(true);
    expect(isWaitingStep("200 derece fırında 45 dakika pişirin.")).toBe(false);
    expect(isWaitingStep("Kapağını kapatıp 10 dakika demlenmeye bırakın, sonra ateşten alın.")).toBe(false);
  });

  it("'Süre uzun görünüyor' only without a long simmer or roast", () => {
    expect(cookTimeLooksLong(120, ["Balıkları 7 dakika kızartın."])).toBe(true);
    expect(cookTimeLooksLong(120, ["Kısık ateşte 2 saat pişirin."])).toBe(false);
    expect(cookTimeLooksLong(150, ["Fırında 1 saat 30 dakika pişirin."])).toBe(false);
    expect(cookTimeLooksLong(90, ["Kızartın."])).toBe(false);
  });
});

describe("fixtures", () => {
  it("fish and chips: Kızartma + Balık, Pişirme 15 not 120, waiting 90", () => {
    const r = parseRecipeText(fixture("13-fish-and-chips"));
    expect(r.tags).toEqual(expect.arrayContaining(["Kızartma", "Balık", "Dinlendirme"]));
    expect(r.tags).not.toContain("Fırında");
    expect(r.tags).not.toContain("Vejetaryen");
    const t = draftTimes(r);
    expect(t).toEqual({ prep: 15, cook: 15, wait: 90 });
    expect(cookTimeLooksLong(t.cook, r.steps.map((s) => s.text))).toBe(false);
    const d = toRecipeDraft(r, { platform: "youtube", url: "https://www.youtube.com/watch?v=abc", author: "Yemek.com", title: null, thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg", needsPaste: false, hasText: true });
    expect(d).toMatchObject({ source: "YouTube · Yemek.com", cookMinutes: "15", waitMinutes: "90", leftoverPolicy: "none", sourceThumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg" });
    expect(d.tags).toContain("Kızartma");
  });

  it("patlıcan kızartması: Kızartma, Vejetaryen; the salt-water soak is waiting", () => {
    const r = parseRecipeText(fixture("14-patlican-kizartmasi"));
    expect(r.tags).toEqual(expect.arrayContaining(["Kızartma", "Vejetaryen"]));
    expect(r.tags).not.toContain("Balık");
    expect(draftTimes(r)).toMatchObject({ cook: 10, wait: 20 });
  });

  it("fırında tavuk: Fırında, Tavuklu, Marine; 45 min in the oven, 30 waiting", () => {
    const r = parseRecipeText(fixture("15-firinda-tavuk"));
    expect(r.tags).toEqual(expect.arrayContaining(["Fırında", "Tavuklu", "Marine"]));
    expect(r.tags).not.toContain("Vejetaryen");
    expect(draftTimes(r)).toMatchObject({ cook: 45, wait: 30 });
  });
});
