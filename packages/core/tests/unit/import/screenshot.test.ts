import { describe, expect, it } from "vitest";
import { captionFromScreenshots } from "@/domain/import/screenshot";
import { parseRecipeText } from "@/domain/import/parseText";

describe("caption from screenshots", () => {
  it("two overlapping screenshots of one caption become one caption without Instagram's buttons", () => {
    const first = ["aysemutfakta", "Fırında köfte 🍽️\nMalzemeler:\n500 gr kıyma\n1 adet soğan", "Beğen", "1.234 beğenme", "3 g"];
    const second = ["1 adet soğan\n2 diş sarımsak\nTuz, karabiber", "Yapılışı:\nKıymayı soğanla yoğurun.\n200 derecede 25 dakika pişirin.", "Tüm 48 yorumu gör", "Çeviriyi gör"];
    const caption = captionFromScreenshots([first, second]);
    expect(caption).toBe(
      ["aysemutfakta", "Fırında köfte 🍽️", "Malzemeler:", "500 gr kıyma", "1 adet soğan", "2 diş sarımsak", "Tuz, karabiber", "Yapılışı:", "Kıymayı soğanla yoğurun.", "200 derecede 25 dakika pişirin."].join("\n"),
    );
    // the usual parser takes it from there
    const draft = parseRecipeText(caption, null);
    expect(draft.ingredients.map((i) => i.item.toLocaleLowerCase("tr"))).toEqual(expect.arrayContaining(["kıyma", "soğan", "sarımsak"]));
    expect(draft.steps.length).toBeGreaterThanOrEqual(2);
  });

  it("English interface lines go too; nothing recognised gives an empty caption", () => {
    expect(captionFromScreenshots([["Liked by chef and others", "View all 12 comments", "2h", "… more", "2 eggs"]])).toBe("2 eggs");
    expect(captionFromScreenshots([[], ["  "]])).toBe("");
  });
});
