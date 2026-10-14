import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../i18n/en.json";
import tr from "../../i18n/tr.json";
import { detectLocale, i18n, setLocale, t } from "@/i18n";

type Tree = { [k: string]: string | Tree };
function flatten(o: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}
const plural = /_(zero|one|two|few|many|other)$/;
const base = (k: string) => k.replace(plural, "");
const vars = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);

describe("message catalogs", () => {
  const T = flatten(tr as Tree);
  const E = flatten(en as Tree);

  it("every key exists in both languages (plural forms compared by base key)", () => {
    const tb = new Set([...T.keys()].map(base));
    const eb = new Set([...E.keys()].map(base));
    expect([...tb].filter((k) => !eb.has(k)), "missing in en").toEqual([]);
    expect([...eb].filter((k) => !tb.has(k)), "missing in tr").toEqual([]);
  });

  it("English plural keys have both _one and _other", () => {
    const bases = new Set([...E.keys()].filter((k) => plural.test(k)).map(base));
    for (const b of bases) expect([b, E.has(`${b}_one`) && E.has(`${b}_other`)]).toEqual([b, true]);
  });

  it("no empty strings", () => {
    for (const [k, v] of [...T, ...E]) expect([k, v.trim().length > 0]).toEqual([k, true]);
  });

  it("English never uses a Turkish-only interpolation (…Tr, …Dat, …Gen)", () => {
    for (const [k, v] of E) expect([k, vars(v).filter((x) => /(Tr|Dat|Gen)$/.test(x))]).toEqual([k, []]);
  });

  it("switches language at runtime", () => {
    setLocale("en");
    expect(t("nav.bugun")).toBe("Today");
    setLocale("tr");
    expect(t("nav.bugun")).toBe("Bugün");
    expect(i18n.language).toBe("tr");
  });

  it("detects the first-run language: tr → Turkish, anything else → English", () => {
    expect(detectLocale(["tr-TR", "en"])).toBe("tr");
    expect(detectLocale(["de-DE", "tr"])).toBe("en");
    expect(detectLocale([])).toBe("en");
    expect(detectLocale([undefined, "TR"])).toBe("tr");
  });
});

// ───────── no hard-coded Turkish in app components ─────────

const ROOT = join(__dirname, "../../../..");
const SCAN = ["apps/web/src", "apps/mobile/src"];
/** Files that legitimately hold Turkish text: server prompts, Turkish-only parsing, metadata, brand. */
const ALLOW_FILES = new Set([
  "apps/web/src/server/llm/prompt.ts",
  "apps/web/src/server/llm/claude.ts",
  "apps/web/src/server/llm/translate.ts",
  "apps/web/src/server/import/handler.ts",
  "apps/web/src/app/manifest.ts",
  "apps/web/src/app/layout.tsx",
]);
/** Literal strings allowed anywhere (brand, demo names, tr locale tag). */
const ALLOW_TEXT = [/^Akşama ne var\??$/, /^Örnek evle dene · Ali ve Zeynep$/];
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;

function files(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(tsx?|mts)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}

export function hardCodedTurkish(src: string): string[] {
  const code = stripComments(src);
  const hits: string[] = [];
  // String and template literals
  for (const m of code.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
    const s = m[1] ?? m[2] ?? m[3] ?? "";
    if (TURKISH.test(s) && !ALLOW_TEXT.some((r) => r.test(s))) hits.push(s.slice(0, 80));
  }
  // JSX text between tags
  for (const m of code.matchAll(/>([^<>{}]*[A-Za-zçğıöşüÇĞİÖŞÜ][^<>{}]*)</g)) {
    const s = m[1].trim();
    if (s && TURKISH.test(s) && !ALLOW_TEXT.some((r) => r.test(s)) && !/=>|&&|\|\|/.test(s)) hits.push(s.slice(0, 80));
  }
  return hits;
}

describe("no hard-coded Turkish in app components", () => {
  it("finds Turkish in a component (the check itself works)", () => {
    expect(hardCodedTurkish(`export const A = () => <p>Kaydedildi, ayrıntılar sonra</p>;`)).toEqual(["Kaydedildi, ayrıntılar sonra"]);
    expect(hardCodedTurkish(`<b aria-label="Şimdi ekle" />`)).toEqual(["Şimdi ekle"]);
    expect(hardCodedTurkish(`// yorum: çok güzel\nconst x = t("a.b");`)).toEqual([]);
  });

  it("apps/web and apps/mobile read every user-facing Turkish string from the catalogs", () => {
    const found: string[] = [];
    for (const dir of SCAN)
      for (const f of files(join(ROOT, dir))) {
        const rel = relative(ROOT, f);
        if (ALLOW_FILES.has(rel)) continue;
        for (const h of hardCodedTurkish(readFileSync(f, "utf8"))) found.push(`${rel}: ${h}`);
      }
    expect(found).toEqual([]);
  });
});
