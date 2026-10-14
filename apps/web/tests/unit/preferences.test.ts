import { describe, expect, it } from "vitest";
import { preferences } from "@/data/preferences";

describe("preferences", () => {
  it("defaults to system", () => {
    expect(preferences.getTheme()).toBe("system");
  });
  it("persists the theme", () => {
    preferences.setTheme("dark");
    expect(preferences.getTheme()).toBe("dark");
  });
  it("ignores garbage values", () => {
    localStorage.setItem("anv.theme", "neon");
    expect(preferences.getTheme()).toBe("system");
  });
});
