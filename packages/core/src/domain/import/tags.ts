import type { ImportedIngredient } from "./types";

/**
 * Tags an import may pre-fill, from the app's existing vocabulary (the words
 * the 100 built-in recipes use, so Tarifler's tag filter stays one list).
 * Anything else an LLM returns is dropped.
 */
export const COOKING_METHOD_TAGS = ["Kızartma", "Fırında", "Tencere", "Tavada", "Izgara", "Haşlama", "Buharda", "Pişirmeden"] as const;
export const MAIN_INGREDIENT_TAGS = ["Kıymalı", "Etli", "Tavuklu", "Balık", "Vejetaryen", "Bakliyat"] as const;
export const PREP_TAGS = ["Akşamdan ıslat", "Marine", "Dinlendirme"] as const;
export const IMPORT_TAGS: readonly string[] = [...COOKING_METHOD_TAGS, ...MAIN_INGREDIENT_TAGS, ...PREP_TAGS];

/** Other spellings for the same tag (the built-ins say "Tencere", "Balık", "Bakliyat"). */
const SYNONYMS: Record<string, string> = {
  tencerede: "Tencere",
  balıklı: "Balık",
  baklagil: "Bakliyat",
  baklagiller: "Bakliyat",
  etsiz: "Vejetaryen",
  fırın: "Fırında",
  ızgara: "Izgara",
  kızarmış: "Kızartma",
  marine: "Marine",
  "marine et": "Marine",
  dinlendir: "Dinlendirme",
  "akşamdan ıslatma": "Akşamdan ıslat",
};

const key = (t: string) => t.trim().toLocaleLowerCase("tr");
const CANONICAL = new Map(IMPORT_TAGS.map((t) => [key(t), t]));

/** "tencerede" → "Tencere"; unknown → null. */
export function normalizeTag(t: unknown): string | null {
  if (typeof t !== "string") return null;
  const k = key(t);
  return CANONICAL.get(k) ?? SYNONYMS[k] ?? null;
}

/** Only vocabulary tags, canonical spelling, no duplicates, in order. */
export function filterTags(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const t of list) {
    const n = normalizeTag(t);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/** "Hızlı, Fırında" + ["Fırında", "Balık"] → "Hızlı, Fırında, Balık" (case-insensitive dedupe, existing first). */
export function mergeTags(existing: string, add: string[]): string {
  const out: string[] = [];
  for (const t of [...existing.split(","), ...add].map((x) => x.trim()).filter(Boolean)) {
    if (!out.some((o) => key(o) === key(t))) out.push(t);
  }
  return out.join(", ");
}

const has = (text: string, re: RegExp) => re.test(text);

// Bare "et" only counts in an ingredient name: in sentences it is a verb ("marine et", "servis et").
const MEAT = /kuşbaşı|dana |dana$|kuzu|biftek|bonfile|antrikot|pirzola|kavurma|sucuk|pastırma|ciğer|işkembe|kemikli et|et suyu|etli|kıyma|köfte/u;
const MEAT_ITEM = /(^|· |\s)et($| ·|\s)/u;
const MINCE = /kıyma|köfte/u;
const CHICKEN = /tavuk|piliç|hindi/u;
const FISH = /balık|morina|levrek|çipura|hamsi|somon|uskumru|palamut|lüfer|istavrit|sardalya|alabalık|mezgit|ton balığı|karides|kalamar|midye|ahtapot|\bcod\b|\bfish\b/u;
// Dry legumes only: taze fasulye, bezelye and bakla are vegetables.
const LEGUME = /mercimek|nohut|kuru fasulye|barbunya|börülce|kuru bakla/u;

/**
 * Rule-parser tags from the caption and its ingredients: cooking method, main
 * ingredient, and prep only when the text says so. Conservative: "Vejetaryen"
 * only with a real ingredient list and no meat, chicken or fish anywhere.
 */
export function keywordTags(text: string, ingredients: Pick<ImportedIngredient, "item">[]): string[] {
  const t = text.toLocaleLowerCase("tr");
  const items = ingredients.map((i) => i.item.toLocaleLowerCase("tr")).join(" · ");
  const all = `${t} · ${items}`;
  const out: string[] = [];

  if (has(t, /kızart|kızgın yağ|bol yağda|derin yağ|fritöz|\bfry|frit\b/u)) out.push("Kızartma");
  if (has(t, /fırın|\boven/u)) out.push("Fırında");
  if (has(t, /ızgara|mangal|grill/u)) out.push("Izgara");
  if (has(t, /buharda|buhar/u)) out.push("Buharda");
  if (has(t, /tava(?!k)|tavada|tavaya/u) && !out.includes("Kızartma")) out.push("Tavada");
  if (has(t, /tencere|düdüklü/u)) out.push("Tencere");
  if (has(t, /haşla(?!nmış)/u)) out.push("Haşlama");

  const meat = has(all, MEAT) || has(items, MEAT_ITEM);
  if (has(all, MINCE)) out.push("Kıymalı");
  else if (meat) out.push("Etli");
  if (has(all, CHICKEN)) out.push("Tavuklu");
  if (has(all, FISH)) out.push("Balık");
  if (has(all, LEGUME)) out.push("Bakliyat");
  if (ingredients.length >= 3 && !meat && !has(all, CHICKEN) && !has(all, FISH) && !has(all, /et suyu|tavuk suyu|kemik suyu/u)) out.push("Vejetaryen");

  if (has(t, /(akşamdan|bir gece|gece boyunca).{0,40}ıslat|ıslat.{0,40}(akşamdan|bir gece|gece boyunca)/u)) out.push("Akşamdan ıslat");
  if (has(t, /marine/u)) out.push("Marine");
  if (has(t, /dinlendir|dinlensin|dinlenmeye/u)) out.push("Dinlendirme");

  return filterTags(out);
}
