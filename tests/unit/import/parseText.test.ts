import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanTitle, findPrep, guessRole, hasIngredientLines, parseIngredientLine, parseRecipeText } from "@/domain/import/parseText";
import { matchCatalog, isWater } from "@/domain/import/catalogMatch";
import { normalizeUnit, parseAmount } from "@/domain/import/units";

const fixture = (name: string) => readFileSync(`tests/fixtures/captions/${name}.txt`, "utf8");
const items = (r: ReturnType<typeof parseRecipeText>) => r.ingredients.map((i) => [i.amount, i.unit, matchCatalog(i.item) ?? i.item]);

describe("parseRecipeText on caption fixtures", () => {
  it("01 headings + bullets + numbered steps", () => {
    const r = parseRecipeText(fixture("01-mercimek-basliklar"));
    expect(r.name).toBe("Mercimek çorbası");
    expect(r.role).toBe("corba");
    expect(items(r)).toEqual([
      [1.5, "su bardağı", "Kırmızı mercimek"],
      [1, "adet", "Kuru soğan"],
      [1, "adet", "Havuç"],
      [1, "yemek kaşığı", "Tereyağı"],
      [1, "tatlı kaşığı", "Domates salçası"],
      [7, "su bardağı", "Sıcak su"],
      [null, null, "Tuz"],
      [null, null, "Karabiber"],
    ]);
    expect(r.steps).toHaveLength(4);
    expect(r.steps[2].minutes).toBe(25);
    expect(r.steps.map((s) => s.text).join(" ")).not.toContain("#");
  });

  it("02 emoji bullets, keycap numbers, servings line, freezer prep", () => {
    const r = parseRecipeText(fixture("02-kofte-emoji"));
    expect(r.name).toBe("Fırında patatesli köfte");
    expect(r.servings).toBe(4);
    expect(items(r).slice(0, 3)).toEqual([
      [500, "g", "Kıyma"],
      [2, "dilim", "Bayat ekmek"],
      [1, "adet", "Kuru soğan"],
    ]);
    expect(r.ingredients.map((i) => i.item)).toEqual(expect.arrayContaining(["Tuz", "Karabiber", "Kimyon"]));
    expect(r.ingredients.some((i) => /unutmayın/.test(i.item))).toBe(false);
    expect(r.steps).toHaveLength(4);
    expect(r.steps[0].text).toMatch(/^Kıymaya ekmek içi/);
    expect(r.steps[3].minutes).toBe(40);
    expect(r.prep).toEqual([{ label: "Kıymayı buzluktan çıkar", when: "morning" }]);
  });

  it("03 inline ingredient list and one-paragraph steps", () => {
    const r = parseRecipeText(fixture("03-satir-ici"));
    expect(r.name).toBe("Pratik menemen");
    expect(items(r)).toEqual([
      [4, "adet", "Domates"],
      [3, "adet", "Sivri biber"],
      [3, "adet", "Yumurta"],
      [2, "yemek kaşığı", "Tereyağı"],
      [null, null, "Tuz"],
      [null, null, "Pul biber"],
    ]);
    expect(r.steps.map((s) => s.text)).toEqual([
      "Biberleri tereyağında 3 dakika soteleyin.",
      "Rendelenmiş domatesleri ekleyip suyunu çekene kadar pişirin.",
      "Yumurtaları kırıp hafifçe karıştırın, tuz ve pul biberle servis edin.",
    ]);
  });

  it("04 'Gerekli malzemeler', yk abbreviations, paragraph steps, night-before soak", () => {
    const r = parseRecipeText(fixture("04-kuru-fasulye-gece"));
    expect(r.name).toBe("Annemin kuru fasulyesi");
    expect(r.servings).toBe(2);
    expect(items(r)).toContainEqual([1, "yemek kaşığı", "Biber salçası"]);
    expect(items(r)).toContainEqual([250, "g", "Dana kuşbaşı"]);
    expect(r.steps).toHaveLength(6);
    expect(r.steps[4]).toEqual({ text: "Kısık ateşte 1 saat 15 dakika pişirin.", minutes: 75 });
    expect(r.prep[0]).toEqual({ label: "Fasulyeleri ıslatmaya koy", when: "night-before" });
  });

  it("05 'item: amount' lines and uppercase headings with dotless ı", () => {
    const r = parseRecipeText(fixture("05-trail-format"));
    expect(r.name).toBe("Kremalı mantarlı tavuk");
    expect(items(r)).toEqual([
      [500, "g", "Tavuk göğsü"],
      [1, "paket", "Mantar"],
      [1, "kutu", "Krema"],
      [2, "diş", "Sarımsak"],
      [1, "yemek kaşığı", "Tereyağı"],
      [null, null, "Tuz"],
      [null, null, "Karabiber"],
    ]);
    expect(r.steps[0].minutes).toBe(10);
  });

  it("06 no headings: ingredient lines then a step sentence", () => {
    const r = parseRecipeText(fixture("06-cacik-kisa"));
    expect(r.role).toBe("salata");
    expect(items(r)).toContainEqual([0.5, "su bardağı", "Soğuk su"]);
    expect(items(r)).toContainEqual([1, "çay kaşığı", "Kuru nane"]);
    expect(r.steps).toHaveLength(1);
  });

  it("07 a story without a recipe has nothing ingredient-like", () => {
    const text = fixture("07-sadece-hikaye");
    const r = parseRecipeText(text);
    expect(r.ingredients).toEqual([]);
    expect(r.steps).toEqual([]);
    expect(hasIngredientLines(text)).toBe(false);
    expect(r.name).toBe("Bugün evde çok güzel bir akşam yemeği yaptık");
  });

  it("08 '1 - amount' numbered ingredient lines", () => {
    const r = parseRecipeText(fixture("08-pilav-numarali-tire"));
    expect(r.role).toBe("yaninda");
    expect(items(r)).toEqual([
      [2, "su bardağı", "Baldo pirinç"],
      [2, "yemek kaşığı", "Tereyağı"],
      [3, "su bardağı", "Sıcak tavuk suyu"],
      [1, "tatlı kaşığı", "Tuz"],
    ]);
    expect(r.steps.map((s) => s.minutes)).toEqual([30, null, 15, 15]);
  });

  it("09 ALL CAPS title, porsiyon in parentheses, fractions", () => {
    const r = parseRecipeText(fixture("09-buyuk-harf-kesirler"));
    expect(r.name).toBe("Karnıyarık");
    expect(r.servings).toBe(6);
    expect(items(r)).toContainEqual([0.5, "demet", "Maydanoz"]);
    expect(items(r)).toContainEqual([1.5, "su bardağı", "Sıcak su"]);
    expect(items(r)).toContainEqual([0.5, "çay kaşığı", "Karabiber"]);
    expect(r.ingredients.find((i) => i.item === "Sıvı yağ")?.note).toBe("kızartmak için");
    expect(r.steps).toHaveLength(4);
  });

  it("10 number words as amounts", () => {
    const r = parseRecipeText(fixture("10-yayla-kelimeler"));
    expect(r.name).toBe("Yayla çorbası");
    expect(items(r).slice(0, 4)).toEqual([
      [0.5, "su bardağı", "Baldo pirinç"],
      [2, "su bardağı", "Yoğurt"],
      [1, "adet", "Yumurta"],
      [1, "yemek kaşığı", "Un"],
    ]);
    expect(r.steps).toHaveLength(5);
    expect(r.steps[3].minutes).toBe(5);
  });

  it("11 meta lines (toplam süre, porsiyon) and marinade prep", () => {
    const r = parseRecipeText(fixture("11-tavuk-marine"));
    expect(r.servings).toBe(4);
    expect(r.totalMinutes).toBe(60);
    expect(r.ingredients).toHaveLength(6);
    expect(r.ingredients[0]).toMatchObject({ amount: 8, unit: "adet", item: "Tavuk baget", side: "market" });
    expect(r.prep).toEqual([{ label: "Marine et, dinlensin", when: "hour-before" }]);
  });

  it("12 sub-headings like 'Sosu için:' are skipped", () => {
    const r = parseRecipeText(fixture("12-sos-alt-baslik"));
    expect(r.ingredients.map((i) => i.item)).toEqual(["Hazır mantı", "Süzme yoğurt", "Sarımsak", "Tereyağı", "Pul biber", "Kuru nane"]);
    expect(r.steps).toHaveLength(4);
    expect(r.steps[0].minutes).toBe(12);
  });

  it("uses the platform title when given and caps input at 8k characters", () => {
    const r = parseRecipeText("- 2 adet yumurta\n- 1 adet domates", "Sabah kahvaltısı: Menemen 🍳 #kahvaltı");
    expect(r.name).toBe("Menemen");
    const long = parseRecipeText(`Başlık\n${"a".repeat(20_000)}`);
    expect(long.name).toBe("Başlık");
  });
});

describe("ingredient lines", () => {
  it.each([
    ["500gr kıyma", 500, "g", "Kıyma"],
    ["1 kg patates", 1, "kg", "Patates"],
    ["2-3 diş sarımsak", 3, "diş", "Sarımsak"],
    ["Yarım demet maydanoz", 0.5, "demet", "Maydanoz"],
    ["1 ½ su bardağı un", 1.5, "su bardağı", "Un"],
    ["1 tk pul biber", 1, "tatlı kaşığı", "Pul biber"],
    ["1 çk karabiber", 1, "çay kaşığı", "Karabiber"],
    ["3 tane yumurta", 3, "adet", "Yumurta"],
    ["Kıyma - 250 g", 250, "g", "Kıyma"],
    ["Domates 3 adet", 3, "adet", "Domates"],
    ["1 lt süt", 1, "l", "Süt"],
    ["2 adet orta boy kabak, rendelenmiş", 2, "adet", "Kabak"],
  ])("%s", (line, amount, unit, name) => {
    const [ing] = parseIngredientLine(line)!;
    expect(ing.amount).toBe(amount);
    expect(ing.unit).toBe(unit);
    expect(matchCatalog(ing.item)).toBe(name);
  });

  it("keeps the comma part as a note", () => {
    expect(parseIngredientLine("2 adet orta boy kabak, rendelenmiş")![0].note).toBe("rendelenmiş");
  });

  it("does not read steps or durations as ingredients", () => {
    expect(parseIngredientLine("10 dakika kaynatın")).toBeNull();
    expect(parseIngredientLine("Fırını 180 dereceye ısıtın ve tepsiyi yağlayın")).toBeNull();
  });
});

describe("helpers", () => {
  it("normalizes unit spellings", () => {
    expect(normalizeUnit("yk")).toBe("yemek kaşığı");
    expect(normalizeUnit("Y.K.")).toBe("yemek kaşığı");
    expect(normalizeUnit("çorba kaşığı")).toBe("yemek kaşığı");
    expect(normalizeUnit("gr")).toBe("g");
    expect(normalizeUnit("sb")).toBe("su bardağı");
    expect(normalizeUnit("tane")).toBe("adet");
    expect(normalizeUnit("avuç")).toBeNull();
  });

  it("parses amounts", () => {
    expect(parseAmount("1,5")).toBe(1.5);
    expect(parseAmount("1/2")).toBe(0.5);
    expect(parseAmount("1 1/2")).toBe(1.5);
    expect(parseAmount("½")).toBe(0.5);
    expect(parseAmount("1½")).toBe(1.5);
    expect(parseAmount("bir buçuk")).toBe(1.5);
    expect(parseAmount("2-3")).toBe(3);
    expect(parseAmount("1.000")).toBe(1000);
    expect(parseAmount("biraz")).toBeNull();
  });

  it("matches catalog names through everyday words", () => {
    expect(matchCatalog("orta boy kuru soğan")).toBe("Kuru soğan");
    expect(matchCatalog("soğan")).toBe("Kuru soğan");
    expect(matchCatalog("mor soğan")).toBe("Kırmızı soğan");
    expect(matchCatalog("salça")).toBe("Domates salçası");
    expect(matchCatalog("ayçiçek yağı")).toBe("Sıvı yağ");
    expect(matchCatalog("yeşil mercimek")).toBe("Yeşil mercimek");
    expect(matchCatalog("taze fasulye")).toBe("Taze fasulye");
    expect(matchCatalog("ejder meyvesi")).toBeNull();
    expect(isWater("Sıcak su")).toBe(true);
    expect(isWater("Limon suyu")).toBe(false);
  });

  it("cleans titles", () => {
    expect(cleanTitle("FIRINDA KÖFTE TARİFİ 😍 #köfte")).toBe("Fırında köfte");
    expect(cleanTitle("Ev Yapımı Mantı | Kolay")).toBe("Ev yapımı mantı");
    expect(cleanTitle("İzmir köfte")).toBe("İzmir köfte");
  });

  it("guesses the menu role", () => {
    expect(guessRole("Ezogelin çorbası")).toBe("corba");
    expect(guessRole("Çoban salatası")).toBe("salata");
    expect(guessRole("Bulgur pilavı")).toBe("yaninda");
    expect(guessRole("Islak kek")).toBeNull();
    expect(guessRole("Tavuk sote")).toBe("ana");
  });

  it("finds prep-ahead hints", () => {
    expect(findPrep("Nohutları akşamdan ıslatın. Sonra haşlayın.")[0]).toEqual({ label: "Nohutları ıslatmaya koy", when: "night-before" });
    expect(findPrep("Tavukları buzluktan sabah çıkarın.")).toEqual([{ label: "Tavukları buzluktan çıkar", when: "morning" }]);
    expect(findPrep("Soğanı doğrayın.")).toEqual([]);
  });
});
