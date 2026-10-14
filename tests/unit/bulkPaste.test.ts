import { describe, expect, it } from "vitest";
import { ingredientsFromLines, stepsFromLines, stripMarker } from "@/services/bulkPaste";

describe("ingredientsFromLines", () => {
  it("reads Turkish amounts and units", () => {
    const rows = ingredientsFromLines("2 su bardağı un\n1 tatlı kaşığı tuz\n500 g kıyma\n1 adet kuru soğan (rendelenmiş)");
    expect(rows.map((r) => [r.name, r.quantity, r.unit])).toEqual([
      ["Un", "2", "su bardağı"],
      ["Tuz", "1", "tatlı kaşığı"],
      ["Kıyma", "500", "g"],
      ["Kuru soğan", "1", "adet"],
    ]);
    expect(rows[2]).toMatchObject({ side: "market", aisle: "Kasap" });
    expect(rows[3].note).toBe("rendelenmiş");
  });

  it("splits 'Tuz, karabiber' into two rows without amounts", () => {
    expect(ingredientsFromLines("Tuz, karabiber").map((r) => [r.name, r.quantity, r.unit])).toEqual([
      ["Tuz", "", ""],
      ["Karabiber", "", ""],
    ]);
  });

  it("ignores blank lines and bullets; keeps a line it can't read as the name", () => {
    const rows = ingredientsFromLines("- 3 yumurta\n\n   \n• Yarım demet maydanoz\nHepsini geniş bir kapta güzelce karıştırıp bekletin");
    expect(rows.map((r) => r.name)).toEqual(["Yumurta", "Maydanoz", "Hepsini geniş bir kapta güzelce karıştırıp bekletin"]);
    expect(rows[0].quantity).toBe("3");
    expect(rows[2]).toMatchObject({ quantity: "", unit: "" });
  });

  it("five lines → five rows", () => {
    expect(ingredientsFromLines("2 su bardağı un\n1 tatlı kaşığı tuz\n3 yumurta\n1 su bardağı süt\n1 paket kabartma tozu")).toHaveLength(5);
  });
});

describe("stepsFromLines", () => {
  it("strips numbering and skips blank lines", () => {
    expect(stepsFromLines("1. Soğanı doğrayın.\n\n2) Kıymayı ekleyip kavurun.\n3 - Salçayı ekleyin.\nAdım 4: Suyunu koyup kaynatın.\n5️⃣ Servis edin.")).toEqual([
      "Soğanı doğrayın.",
      "Kıymayı ekleyip kavurun.",
      "Salçayı ekleyin.",
      "Suyunu koyup kaynatın.",
      "Servis edin.",
    ]);
  });

  it("keeps a leading time range and unnumbered lines", () => {
    expect(stepsFromLines("1-2 dakika kavurun.\nFırını 180 dereceye ısıtın.\n- Tepsiye dizin.")).toEqual([
      "1-2 dakika kavurun.",
      "Fırını 180 dereceye ısıtın.",
      "Tepsiye dizin.",
    ]);
  });

  it("drops lines that are only a number", () => {
    expect(stepsFromLines("1.\nKarıştırın.\n2)")).toEqual(["Karıştırın."]);
    expect(stripMarker("10. Pişirin.")).toBe("Pişirin.");
  });
});
