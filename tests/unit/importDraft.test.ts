import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRecipeText } from "@/domain/import/parseText";
import { toRecipeDraft } from "@/services/importDraft";
import { emptyDraft, parseDraft } from "@/services/recipeForm";

const src = { platform: "tiktok" as const, url: "https://www.tiktok.com/@mutfakdefteri/video/1", author: "@mutfakdefteri", title: null, thumbnailUrl: null, needsPaste: false, hasText: true };

describe("toRecipeDraft", () => {
  it("maps an import onto the form: catalog names, comma decimals, no water, prep, credit", () => {
    const d = toRecipeDraft(parseRecipeText(readFileSync("tests/fixtures/captions/02-kofte-emoji.txt", "utf8")), src);
    expect(d.name).toBe("Fırında patatesli köfte");
    expect(d.course).toBe("ana");
    expect(d.servings).toBe("4");
    expect(d.ingredients[0]).toMatchObject({ name: "Kıyma", quantity: "500", unit: "g", side: "market", aisle: "Kasap" });
    expect(d.ingredients.map((i) => i.name)).toContain("Kuru soğan");
    expect(d.prepItems).toEqual([{ label: "Kıymayı buzluktan çıkar", offset: "morning", freezer: true }]);
    expect(d.freezerItem).toBe("Kıyma");
    expect(d).toMatchObject({ sourceUrl: src.url, sourceAuthor: "@mutfakdefteri", sourcePlatform: "tiktok" });

    const soup = toRecipeDraft(parseRecipeText(readFileSync("tests/fixtures/captions/01-mercimek-basliklar.txt", "utf8")), null);
    expect(soup.course).toBe("corba");
    expect(soup.ingredients[0]).toMatchObject({ name: "Kırmızı mercimek", quantity: "1,5", unit: "su bardağı" });
    expect(soup.ingredients.some((i) => /su$/i.test(i.name))).toBe(false);
    expect(soup.sourceUrl).toBeUndefined();
  });

  it("leftovers are never guessed: imports (rules or LLM shape) and new recipes start as Artmaz", () => {
    for (const f of ["01-mercimek-basliklar", "02-kofte-emoji", "04-kuru-fasulye-gece"]) {
      expect(toRecipeDraft(parseRecipeText(readFileSync(`tests/fixtures/captions/${f}.txt`, "utf8")), src).leftoverPolicy).toBe("none");
    }
    const llmShaped = { name: "Kuru fasulye", servings: 4, role: "ana" as const, totalMinutes: 90, ingredients: [], steps: [], prep: [] };
    expect(toRecipeDraft(llmShaped, src).leftoverPolicy).toBe("none");
    expect(emptyDraft().leftoverPolicy).toBe("none");
  });

  it("produces a draft the existing form validation accepts, keeping the credit", () => {
    const d = toRecipeDraft(parseRecipeText(readFileSync("tests/fixtures/captions/04-kuru-fasulye-gece.txt", "utf8")), src);
    const res = parseDraft(d);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.sourceUrl).toBe(src.url);
      expect(res.value.sourcePlatform).toBe("tiktok");
      expect(res.value.prepItems[0]).toEqual({ label: "Fasulyeleri ıslatmaya koy", offset: "night-before" });
    }
  });

  it("empty imports still open a usable form", () => {
    const d = toRecipeDraft({ name: "Bir şey", servings: null, role: null, totalMinutes: null, ingredients: [], steps: [], prep: [] }, null);
    expect(d.ingredients).toHaveLength(1);
    expect(d.steps).toEqual([""]);
    expect(d.servings).toBe("4");
  });
});

describe("toRecipeDraft timing", () => {
  const base = { name: "X", servings: 2, role: "ana" as const, ingredients: [], prep: [] };
  it("splits a known total into prep (≤15) and cook", () => {
    const d = toRecipeDraft({ ...base, totalMinutes: 20, steps: [{ text: "a", minutes: 3 }] }, null);
    expect([d.prepMinutes, d.cookMinutes]).toEqual(["7", "13"]);
    const long = toRecipeDraft({ ...base, totalMinutes: 90, steps: [] }, null);
    expect([long.prepMinutes, long.cookMinutes]).toEqual(["15", "75"]);
  });
  it("without a total: cooking = step durations, prep 15", () => {
    const d = toRecipeDraft({ ...base, totalMinutes: null, steps: [{ text: "a", minutes: 10 }, { text: "b", minutes: 25 }] }, null);
    expect([d.prepMinutes, d.cookMinutes]).toEqual(["15", "35"]);
    expect(toRecipeDraft({ ...base, totalMinutes: null, steps: [] }, null).cookMinutes).toBe("30");
  });
});

describe("source credit", () => {
  it("names the creator and platform, without repeating the host", async () => {
    const { sourceCredit } = await import("@/components/ImportSourceCard");
    expect(sourceCredit({ platform: "tiktok", author: "@mutfakdefteri", url: "https://www.tiktok.com/@mutfakdefteri/video/1" })).toBe("Kaynak: @mutfakdefteri · TikTok");
    expect(sourceCredit({ platform: "instagram", author: null, url: "https://www.instagram.com/reel/C7x/" })).toBe("Kaynak: Instagram");
    expect(sourceCredit({ platform: "web", author: "Ayşe Mutfakta", url: "https://ornek.com/x" })).toBe("Kaynak: Ayşe Mutfakta");
    expect(sourceCredit({ platform: "web", author: null, url: "https://www.ornek.com/x" })).toBe("Kaynak: ornek.com");
  });
});
