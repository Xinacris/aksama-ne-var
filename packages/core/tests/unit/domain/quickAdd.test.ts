import { describe, expect, it } from "vitest";
import { importHref, quickAddIntent } from "@/domain/quickAdd";

describe("quickAddIntent: link or name", () => {
  it.each([
    ["https://www.instagram.com/reel/C9x1/?igsh=abc", "https://www.instagram.com/reel/C9x1/?igsh=abc"],
    ["  https://youtu.be/p_mK7_Zi_rk  ", "https://youtu.be/p_mK7_Zi_rk"],
    ["Bu tarife bak https://vm.tiktok.com/ZM123/ 😋", "https://vm.tiktok.com/ZM123/"],
    ["instagram.com/p/abc", "https://instagram.com/p/abc"],
    ["yemek.com/tarif/peri-peri-soslu-tavuk", "https://yemek.com/tarif/peri-peri-soslu-tavuk"],
    ["www.nefisyemektarifleri.com", "https://www.nefisyemektarifleri.com/"],
    ["http://ornek.com.tr/kofte", "http://ornek.com.tr/kofte"],
  ])("%s → import", (input, url) => {
    expect(quickAddIntent(input)).toEqual({ kind: "url", url });
  });

  it.each([
    ["Annemin dolması", "Annemin dolması"],
    ["  karnıyarık ", "karnıyarık"],
    ["Dr.Oetker keki", "Dr.Oetker keki"],
    ["Dr.Oetker", "Dr.Oetker"],
    ["Fırında   tavuk", "Fırında tavuk"],
    ["1.5 kg kuzu incik", "1.5 kg kuzu incik"],
  ])("%s → name", (input, name) => {
    expect(quickAddIntent(input)).toEqual({ kind: "name", name });
  });

  it("empty input does nothing", () => {
    expect(quickAddIntent("   ")).toEqual({ kind: "empty" });
  });

  it("a pasted recipe (several lines or longer than a name) goes to import as text", () => {
    const text = "Mercimek çorbası\n1 su bardağı kırmızı mercimek\n1 soğan";
    expect(quickAddIntent(text)).toEqual({ kind: "text", text });
    expect(quickAddIntent("a".repeat(81)).kind).toBe("text");
    expect(quickAddIntent("a".repeat(80)).kind).toBe("name");
  });

  it("builds the import link", () => {
    expect(importHref({ kind: "url", url: "https://youtu.be/x?a=1&b=2" })).toBe("/tarifler/ice-aktar?url=https%3A%2F%2Fyoutu.be%2Fx%3Fa%3D1%26b%3D2");
    expect(importHref({ kind: "text", text: "a\nb" })).toBe("/tarifler/ice-aktar?text=a%0Ab");
  });
});
