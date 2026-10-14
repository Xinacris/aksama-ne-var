import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { palette } from "@/design/tokens";

const css = readFileSync(new URL("../../../../apps/web/src/app/globals.css", import.meta.url), "utf8");
const block = (selector: string) => css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));
const vars = (b: string) => Object.fromEntries([...b.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));
const camel = (k: string) => k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

describe("design tokens", () => {
  it.each([
    ["light", ":root {"],
    ["dark", ':root[data-theme="dark"] {'],
  ] as const)("%s palette equals the web CSS variables", (name, selector) => {
    const web = vars(block(selector));
    expect(Object.keys(web).length).toBeGreaterThan(10);
    for (const [k, v] of Object.entries(web)) expect([k, palette[name][camel(k) as keyof (typeof palette)["light"]]]).toEqual([k, v]);
  });
});
