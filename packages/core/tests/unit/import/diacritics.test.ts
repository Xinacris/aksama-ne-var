import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { restoreDiacritics } from "@/domain/import/diacritics";
import { parseRecipeText } from "@/domain/import/parseText";
import { runImport } from "@/domain/import/pipeline";

const fixture = (n: string) => readFileSync(`tests/fixtures/ocr/${n}.txt`, "utf8");

describe("Turkish letters back in OCR text", () => {
  it("a plain-ASCII caption gets its dictionary words back; unknown inflections stay as read", () => {
    // "tereyaginda", "cekene", "Salcayi" aren't in the dictionary: left alone, never guessed
    expect(restoreDiacritics(fixture("01-kuru-fasulye-ascii"))).toBe(fixture("01-kuru-fasulye-expected"));
  });

  it("words that are real both ways change only in a clear context", () => {
    expect(restoreDiacritics("1 yemek kasigi seker ve 2 kasigi sogan")).toBe("1 yemek kaşığı şeker ve 2 kaşığı soğan");
    expect(restoreDiacritics("sis kebap için sogan, seker; sis gibi bir sis")).toBe("şiş kebap için soğan, şeker; sis gibi bir sis");
    expect(restoreDiacritics("3 dis sarimsak, disi sogan ve seker")).toBe("3 diş sarımsak, disi soğan ve şeker");
    expect(restoreDiacritics("ilik su, ilik ve sogan, seker")).toBe("ılık su, ilik ve soğan, şeker");
  });

  it("keeps case, numbers, units and punctuation; words already with Turkish letters are untouched", () => {
    expect(restoreDiacritics("SOGAN: 1,5 kg; Seker 200 gr. Pisirin!")).toBe("SOĞAN: 1,5 kg; Şeker 200 gr. Pişirin!");
    expect(restoreDiacritics("Soğan ve seker, yag")).toBe("Soğan ve şeker, yağ");
  });

  it("English (or anything that doesn't turn Turkish) comes back exactly as it was", () => {
    const en = "Once the onions are soft, make sure to add 2 cups of rice.";
    expect(restoreDiacritics(en)).toBe(en);
    expect(restoreDiacritics("")).toBe("");
  });

  it("the rule parser reads the restored caption with the right names", () => {
    const draft = parseRecipeText(restoreDiacritics(fixture("01-kuru-fasulye-ascii")), null);
    const items = draft.ingredients.map((i) => i.item.toLocaleLowerCase("tr"));
    expect(items).toEqual(expect.arrayContaining(["soğan", "sarımsak", "salça", "tereyağı", "şeker"]));
    expect(draft.ingredients.find((i) => i.item.toLocaleLowerCase("tr") === "şeker")).toMatchObject({ amount: 1, unit: "çay kaşığı" });
    expect(draft.steps.map((s) => s.text).join(" ")).toContain("pişirin");
  });
});

describe("import pipeline with screenshot text", () => {
  const ascii = fixture("01-kuru-fasulye-ascii");
  const fetch = (async () => {
    throw new TypeError("no network in this test");
  }) as unknown as typeof globalThis.fetch;

  it("textOrigin ocr: the rule parser gets the restored text, and an LLM is told it's OCR", async () => {
    const { result } = await runImport({ text: ascii, textOrigin: "ocr" }, { fetch, env: {} });
    expect(result.provider).toBe("rules");
    expect(result.draft?.ingredients.map((i) => i.item.toLocaleLowerCase("tr"))).toEqual(expect.arrayContaining(["soğan", "şeker"]));
    let meta: unknown = null;
    await runImport({ text: ascii, textOrigin: "ocr" }, { fetch, env: {}, structure: async (_t, m) => ((meta = m), Promise.reject(new Error("down"))) });
    expect(meta).toMatchObject({ ocr: true });
  });

  it("a normal paste is parsed as typed, and the LLM isn't told anything", async () => {
    const { result } = await runImport({ text: ascii }, { fetch, env: {} });
    expect(result.draft?.ingredients.map((i) => i.item.toLocaleLowerCase("tr"))).not.toContain("soğan");
    let meta: Record<string, unknown> = {};
    await runImport({ text: ascii }, { fetch, env: {}, structure: async (_t, m) => ((meta = m), Promise.reject(new Error("down"))) });
    expect(meta).not.toHaveProperty("ocr");
  });
});
