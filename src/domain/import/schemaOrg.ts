import { keywordTags } from "./tags";
import { parseDurationMinutes } from "@/domain/durations";
import { cleanTitle, findPrep, guessRole, parseIngredientLine } from "./parseText";
import type { ImportedIngredient, ImportedRecipe, ImportedStep } from "./types";

/**
 * schema.org/Recipe JSON-LD reader for ordinary recipe sites. This is the
 * seed for future recipe-site partnerships: a partner feed would produce the
 * same `ImportedRecipe`.
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const isObj = (v: Json | undefined): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: Json | undefined): string | null => (typeof v === "string" ? decode(v).trim() || null : typeof v === "number" ? String(v) : null);

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ");
}

function isRecipe(o: Obj): boolean {
  const t = o["@type"];
  return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
}

function findRecipe(node: Json | undefined, depth = 0): Obj | null {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (!isObj(node)) return null;
  if (isRecipe(node)) return node;
  return findRecipe(node["@graph"], depth + 1) ?? findRecipe(node.mainEntity, depth + 1);
}

/** All JSON-LD blocks of a page. Broken blocks are skipped. */
export function jsonLdBlocks(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1].trim()) as Json);
    } catch {
      // Some sites ship invalid JSON-LD; ignore that block.
    }
  }
  return out;
}

/** ISO 8601 duration ("PT1H30M") → minutes. */
export function isoMinutes(v: Json | undefined): number | null {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+)S)?)?$/i);
  if (!m) return parseDurationMinutes(s);
  const min = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return min > 0 ? Math.round(min) : null;
}

function instructions(v: Json | undefined): string[] {
  if (!v) return [];
  if (typeof v === "string") {
    return decode(v)
      .split(/\n+|(?<=[.!?])\s+(?=\p{Lu})/u)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(v)) return v.flatMap((x) => instructions(x));
  if (isObj(v)) {
    if (v.itemListElement) return instructions(v.itemListElement);
    const t = str(v.text) ?? str(v.name);
    return t ? [t] : [];
  }
  return [];
}

function yieldOf(v: Json | undefined): number | null {
  const all = Array.isArray(v) ? v : [v];
  for (const x of all) {
    const m = str(x)?.match(/\d{1,2}/);
    const n = m ? Number(m[0]) : NaN;
    if (n >= 1 && n <= 20) return n;
  }
  return null;
}

function nameOf(v: Json | undefined): string | null {
  if (Array.isArray(v)) return nameOf(v[0]);
  if (isObj(v)) return str(v.name);
  return str(v);
}

function imageOf(v: Json | undefined): string | null {
  if (Array.isArray(v)) return imageOf(v[0]);
  if (isObj(v)) return str(v.url) ?? str(v.contentUrl);
  const s = str(v);
  return s && /^https?:\/\//.test(s) ? s : null;
}

function roleOf(category: Json | undefined, name: string): ImportedRecipe["role"] {
  const c = (Array.isArray(category) ? category.map((x) => str(x) ?? "").join(" ") : str(category) ?? "").toLocaleLowerCase("tr");
  if (/çorba|soup/.test(c)) return "corba";
  if (/salata|meze|salad/.test(c)) return "salata";
  if (/pilav|garnitür|side/.test(c)) return "yaninda";
  if (/tatlı|dessert/.test(c)) return null;
  if (/ana yemek|main/.test(c)) return "ana";
  return guessRole(name);
}

export interface SchemaOrgRecipe {
  recipe: ImportedRecipe;
  author: string | null;
  image: string | null;
}

export function readSchemaOrgRecipe(html: string): SchemaOrgRecipe | null {
  let node: Obj | null = null;
  for (const block of jsonLdBlocks(html)) {
    node = findRecipe(block);
    if (node) break;
  }
  if (!node) return null;
  const name = cleanTitle(str(node.name) ?? "") || "İçe aktarılan tarif";
  // Some sites group ingredients per sub-recipe as nested arrays (Yemek.com: [["1 adet tavuk", …], ["4 adet biber", …]]).
  const raw = Array.isArray(node.recipeIngredient) ? node.recipeIngredient : Array.isArray(node.ingredients) ? node.ingredients : [];
  const lines = (raw as Json[]).flat(3);
  const ingredients: ImportedIngredient[] = [];
  for (const l of lines) {
    const s = str(l);
    if (!s) continue;
    const parsed = parseIngredientLine(s, true);
    if (parsed) ingredients.push(...parsed);
    else ingredients.push({ amount: null, unit: null, item: s.slice(0, 80), side: null, note: null });
  }
  const stepTexts = instructions(node.recipeInstructions);
  const steps: ImportedStep[] = stepTexts.slice(0, 40).map((t) => ({ text: t.slice(0, 600), minutes: parseDurationMinutes(t) }));
  const total = isoMinutes(node.totalTime) ?? ((isoMinutes(node.prepTime) ?? 0) + (isoMinutes(node.cookTime) ?? 0) || null);
  return {
    recipe: {
      name,
      servings: yieldOf(node.recipeYield),
      role: roleOf(node.recipeCategory, name),
      totalMinutes: total && total <= 1440 ? total : null,
      prepMinutes: isoMinutes(node.prepTime),
      cookMinutes: isoMinutes(node.cookTime),
      ingredients: ingredients.slice(0, 60),
      steps,
      prep: findPrep(stepTexts.join("\n")),
      tags: keywordTags(`${name}\n${stepTexts.join("\n")}`, ingredients),
    },
    author: nameOf(node.author),
    image: imageOf(node.image),
  };
}

/** `<title>` / og:title / og:image for the link card when a page has no recipe data. */
export function pageMeta(html: string): { title: string | null; image: string | null; siteName: string | null } {
  const meta = (prop: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
    const m = html.match(re);
    return m ? decode(m[1] ?? m[2] ?? "").trim() || null : null;
  };
  const title = meta("og:title") ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]).trim() : null);
  return { title, image: meta("og:image"), siteName: meta("og:site_name") };
}
