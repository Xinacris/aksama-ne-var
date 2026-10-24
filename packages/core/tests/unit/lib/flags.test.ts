import { describe, expect, it } from "vitest";
import { authProvidersUi } from "@/lib/flags";

describe("auth providers UI flag", () => {
  it("is on by default and off only when the env says so", () => {
    expect(authProvidersUi(undefined)).toBe(true);
    expect(authProvidersUi("")).toBe(true);
    expect(authProvidersUi("1")).toBe(true);
    for (const off of ["0", "false", "OFF", " no "]) expect(authProvidersUi(off)).toBe(false);
  });
});
