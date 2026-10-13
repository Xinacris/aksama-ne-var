import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isBoilerplateLine, stripBoilerplate } from "@/domain/import/boilerplate";
import { findLinks, linkKind, recipeLinks } from "@/domain/import/links";
import { parseRecipeText } from "@/domain/import/parseText";

const fixture = (n: string) => readFileSync(`tests/fixtures/captions/${n}.txt`, "utf8");

describe("recipe links in a description", () => {
  it("finds links with and without a scheme, trims punctuation", () => {
    expect(findLinks("Tarif: https://ornek.com/tarif/x/. Kısa: bit.ly/abc ve www.site.com/a").map((l) => l.url)).toEqual([
      "https://ornek.com/tarif/x/",
      "https://bit.ly/abc",
      "https://www.site.com/a",
    ]);
  });

  it("classifies hosts", () => {
    expect(linkKind("https://www.instagram.com/x")).toBe("social");
    expect(linkKind("https://youtu.be/abc")).toBe("video");
    expect(linkKind("https://m.youtube.com/watch?v=1")).toBe("video");
    expect(linkKind("http://bit.ly/3AbCdEf")).toBe("shortener");
    expect(linkKind("https://yemek.com/tarif/x/")).toBe("web");
  });

  it("prefers the 'yazılı tarif' link; ignores social, video, profile pages, subscribe and sponsor shorteners", () => {
    const links = recipeLinks(fixture("16-kanal-aciklamasi"));
    expect(links[0]).toMatchObject({ url: "https://ornek-mutfak.com/tarif/limonlu-kekikli-tavuk/", shortener: false });
    const urls = links.map((l) => l.url);
    expect(urls.some((u) => /instagram|facebook|tiktok|profil|bit\.ly/.test(u))).toBe(false);
    // the site's home page may stay as a weak candidate, never ahead of the recipe
    expect(urls.indexOf("https://www.ornek-mutfak.com")).not.toBe(0);
  });

  it("a recipe link on a 'recipe' line beats a plain one; shorteners only from recipe lines and last", () => {
    const text = [
      "Blog: https://blog.ornek.com/hakkimda",
      "Recipe: https://cooking.ornek.com/fish-and-chips",
      "Tarifin tamamı: bit.ly/tarif123",
      "Abone ol: bit.ly/abone",
      "Video: https://www.youtube.com/watch?v=abc",
    ].join("\n");
    expect(recipeLinks(text).map((l) => l.url)).toEqual(["https://cooking.ornek.com/fish-and-chips", "https://blog.ornek.com/hakkimda", "https://bit.ly/tarif123"]);
  });

  it("no links, or only social ones: nothing to follow", () => {
    expect(recipeLinks("Menemen\n3 yumurta")).toEqual([]);
    expect(recipeLinks("Instagram: https://instagram.com/a\nhttps://youtu.be/x")).toEqual([]);
  });
});

describe("boilerplate cleaner", () => {
  it("drops link lists, subscribe calls, socials, sponsor and chef promos; keeps the recipe", () => {
    const clean = stripBoilerplate(fixture("16-kanal-aciklamasi"));
    expect(clean).not.toMatch(/https?:|bit\.ly|abone|SOSYAL MEDYA|Instagram|sponsor|tüm tariflerine|Sitemizi|#tavuk/i);
    for (const keep of ["HAFTA SONU MENÜSÜ", "6 adet tavuk but", "1 adet limonun suyu", "Patates için:", "1 çay kaşığı tuz"]) expect(clean).toContain(keep);
  });

  it("boilerplate-only text becomes almost nothing", () => {
    expect(stripBoilerplate(fixture("17-sadece-kanal"))).toBe("Yeni videolar her salı ve cuma!");
  });

  it("line rules", () => {
    for (const junk of [
      "Yazılı tarif için: https://yemek.com/tarif/x/",
      "• Twitter: http://www.twitter.com/ornek",
      "SOSYAL MEDYA HESAPLARIMIZ",
      "Bizi takip etmeyi unutmayın!",
      "Bildirimleri açın 🔔",
      "@ornekmutfak",
      "#tavuk #pratik",
      "Bu video Örnek Marka işbirliğiyle hazırlandı.",
      "İndirim kodu: MUTFAK10",
    ])
      expect(isBoilerplateLine(junk), junk).toBe(true);
    for (const real of [
      "Tavukları limonlu sosla marine edin.",
      "200 derece fırında 40 dakika pişirin.",
      "2 yemek kaşığı zeytinyağı",
      "Sosu için: 1 çay kaşığı pul biber",
    ])
      expect(isBoilerplateLine(real), real).toBe(false);
  });

  it("the rule parser on the cleaned text: real ingredients, no junk steps", () => {
    const r = parseRecipeText(stripBoilerplate(fixture("16-kanal-aciklamasi")));
    expect(r.ingredients.map((i) => i.item.toLocaleLowerCase("tr"))).toEqual(expect.arrayContaining(["tavuk but", "patates"]));
    expect(r.steps).toEqual([]);
  });
});
