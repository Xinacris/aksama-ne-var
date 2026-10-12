import { describe, expect, it } from "vitest";
import { resolveTheme, themeBootScript } from "@/lib/theme";

describe("theme", () => {
  it("resolves explicit preferences", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("follows the system when set to system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
  it("boot script sets data-theme from stored preference", () => {
    localStorage.setItem("anv.theme", "dark");
    new Function(themeBootScript)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
