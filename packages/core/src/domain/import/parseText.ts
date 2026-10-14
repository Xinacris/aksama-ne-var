import { parseDurationMinutes } from "../durations";
import type { ImportedIngredient, ImportedPrep, ImportedRecipe, ImportedStep } from "./types";
import { normalizeUnit, parseAmount, UNIT_WORDS } from "./units";
import { matchCatalog } from "./catalogMatch";
import { catalogEntry } from "../../data/seed/ingredients";
import { keywordTags } from "./tags";
import { stepMinutes } from "./timing";

/**
 * Rule-based Turkish caption parser. No key, no network: good enough to
 * pre-fill the form, the user reviews everything before saving.
 */

export const MAX_INPUT_CHARS = 8000;

const INGREDIENT_HEAD = /^(?:gerekli\s+)?(?:malzemeler|malzeme\s+listesi|malzemeleri|malzeme|ihtiyacınız\s+olanlar|ihtiyacımız\s+olanlar|içindekiler|ingredients)(?!\p{L})\s*[:：-]?\s*/iu;
const STEP_HEAD = /^(?:yapılışı|yapılış|yapılışı\s+ve\s+püf\s+noktaları|hazırlanışı|hazırlanış|hazırlanması|yapımı|nasıl\s+yapılır|tarifi|adımlar|hazırlama|instructions|directions)(?!\p{L})\s*[:：-]?\s*/iu;
const SUB_HEAD = /^[\p{L}\s]{2,30}\s+için\s*[:：]\s*$/iu; // "Sosu için:", "Köftesi için:"
const META_LINE = /^(?:hazırlık|pişirme|toplam|süre|porsiyon|kaç\s+kişilik)(?!\p{L})[^:]*[:：]|^\d{1,2}\s*(?:kişilik|porsiyon)$/iu;

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu;
const BULLET = /^\s*(?:[1-9]\u{FE0F}?\u{20E3}|[-–—•·*▪▫◦●○►▶➤→✓✔✅☑️]+|\d{1,2}\s*[.)]\s|\d{1,2}\s*[-–]\s|adım\s*\d+\s*[:.)-]?)\s*/iu;
const NUMBERED = /^\s*(?:\d{1,2}\s*[.)]|\d{1,2}\s*[-–](?!\s*\d)|adım\s*\d+\s*[:.)-]?|[1-9]\u{FE0F}?\u{20E3})\s*/iu;

const AMOUNT = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔⅛]|yarım|çeyrek|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)(?:\s*(?:-|–|ila|ya da|veya)\s*(?:\d+(?:[.,]\d+)?|bir|iki|üç|dört|beş|altı))?(?:\s+buçuk)?`;
const UNIT = `(?:${UNIT_WORDS.join("|")})`;
const LEAD = new RegExp(`^(${AMOUNT})\\s*(${UNIT})?(?![\\p{L}])\\s*(.*)$`, "iu");
const TRAIL = new RegExp(`^(.+?)\\s*(?:[:：–—-]|\\()\\s*(${AMOUNT})\\s*(${UNIT})?(?![\\p{L}])\\s*\\)?\\s*$`, "iu");
const TRAIL_PLAIN = new RegExp(`^(\\p{L}[\\p{L}\\s]{1,30}?)\\s+(${AMOUNT})\\s*(${UNIT})(?![\\p{L}])\\s*$`, "iu");

const STAPLE_WORDS = /^(tuz|karabiber|pul biber|kimyon|kekik|nane|kuru nane|sumak|yağ|sıvı yağ|zeytinyağı|tereyağı|su|limon suyu|maydanoz|dereotu|toz biber|kırmızı biber|tarçın)$/iu;

function clean(line: string): string {
  return line
    .replace(EMOJI, " ")
    .replace(/(^|\s)[#@][\p{L}\d_.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripBullet(line: string): string {
  return line.replace(BULLET, "").trim();
}

function isHashtagLine(raw: string): boolean {
  const t = raw.replace(EMOJI, "").trim();
  return t.length > 0 && /^([#@][\p{L}\d_.]+[\s,]*)+$/u.test(t);
}

function sentenceCase(s: string): string {
  const letters = s.replace(/[^\p{L}]/gu, "");
  const upper = letters && letters === letters.toLocaleUpperCase("tr") && letters.length > 3;
  const words = s.split(/\s+/).filter(Boolean);
  const titleCase = words.length > 1 && words.every((w) => /^\p{Lu}/u.test(w));
  const t = upper || titleCase ? s.toLocaleLowerCase("tr") : s;
  return t.charAt(0).toLocaleUpperCase("tr") + t.slice(1);
}

/** "FIRINDA KÖFTE TARİFİ 😍 #köfte" → "Fırında köfte". */
export function cleanTitle(raw: string): string {
  // The title is what comes before the first emoji run ("FIRINDA KÖFTE 😍 Kaydet!").
  const segments = raw.split(/(?:[\p{Extended_Pictographic}\u{FE0F}]\s*)+/u).map((x) => x.trim());
  const first = segments.find((x) => x.replace(/[^\p{L}]/gu, "").length >= 3) ?? raw;
  let t = clean(first)
    .replace(/[|:–—-]\s*$/, "")
    .replace(/\s*[(\[].*?[)\]]\s*/g, " ")
    .trim();
  t = t.split(/\s[|•·]\s|[.!?]\s/)[0].trim();
  // "Kış akşamlarının vazgeçilmezi: Mercimek Çorbası" → the dish after the colon.
  const colon = t.match(/^[^:]{3,}:\s*(.{3,})$/);
  if (colon && colon[1].split(" ").length <= 5) t = colon[1];
  const suffix = t.toLocaleLowerCase("tr").match(/\s+(tarifi|tarif|nasıl yapılır|yapımı|tarifim)$/u);
  if (suffix) t = t.slice(0, t.length - suffix[0].length);
  const prefix = t.toLocaleLowerCase("tr").match(/^(tarif|tarifi)\s*[:：-]\s*/u);
  if (prefix) t = t.slice(prefix[0].length);
  t = sentenceCase(t.replace(/\s+/g, " ").trim());
  return t.length > 80 ? `${t.slice(0, 77).trim()}…` : t;
}

/** One caption line → ingredient, or null when the line does not look like one. */
export function parseIngredientLine(raw: string, inSection = false): ImportedIngredient[] | null {
  const hadBullet = BULLET.test(raw);
  let line = clean(stripBullet(raw)).replace(/[.;]$/, "").trim();
  if (!line || line.length > 90) return null;
  if (/^(ve|veya|ya da)\s/i.test(line)) line = line.replace(/^(ve|veya|ya da)\s+/i, "");

  let note: string | null = null;
  const paren = line.match(/\(([^)]*)\)/);
  const make = (amountRaw: string | null, unitRaw: string | null, itemRaw: string): ImportedIngredient | null => {
    let item = itemRaw.replace(/\(([^)]*)\)/g, (_, inner: string) => {
      if (!new RegExp(`^${AMOUNT}`, "iu").test(inner.trim())) note = inner.trim();
      return " ";
    });
    const comma = item.indexOf(",");
    if (comma > 0 && !STAPLE_WORDS.test(item.slice(comma + 1).trim())) {
      note = note ?? item.slice(comma + 1).trim();
      item = item.slice(0, comma);
    }
    item = item.replace(/\s+/g, " ").replace(/^(adet|tane)\s+/i, "").trim();
    if (!item || item.length < 2 || /^\d/.test(item)) return null;
    const unit = normalizeUnit(unitRaw);
    const amount = amountRaw ? parseAmount(amountRaw) : null;
    if (unitRaw && !unit) return null;
    const canonical = matchCatalog(item);
    const side = canonical ? catalogEntry(canonical)?.side ?? null : null;
    return { amount, unit: amount === null ? null : unit ?? (amountRaw ? "adet" : null), item: sentenceCase(item), side, note: note ? note.slice(0, 80) : null };
  };

  const lead = line.match(LEAD);
  if (lead && lead[3] && /\p{L}/u.test(lead[3])) {
    // Avoid reading "2 dakika pişir" or a step sentence as an ingredient.
    if (/\b(dakika|dk|saat|derece)\b/iu.test(lead[2] ?? lead[3].split(" ")[0])) return null;
    if (lead[3].split(" ").length > 7) return null;
    const ing = make(lead[1], lead[2] ?? null, lead[3]);
    return ing ? [ing] : null;
  }
  const trail = line.match(TRAIL) ?? line.match(TRAIL_PLAIN);
  if (trail) {
    const ing = make(trail[2], trail[3] ?? null, trail[1]);
    return ing ? [ing] : null;
  }
  void paren;
  // No amount: "Tuz, karabiber" or a bulleted item inside the ingredients section.
  const parts = line.split(/\s*,\s*|\s+ve\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => p.split(" ").length <= 3 && (STAPLE_WORDS.test(p) || matchCatalog(p)))) {
    return parts.map((p) => make(null, null, p)).filter((x): x is ImportedIngredient => !!x);
  }
  const lastWord = line.split(" ").pop() ?? "";
  const imperative = line.includes(" ") && lastWord.length >= 6 && /(ın|in|un|ün|ınız|iniz|unuz|ünüz)$/u.test(lastWord) && !matchCatalog(lastWord);
  if ((inSection || hadBullet) && !imperative && line.split(" ").length <= 5 && !/[.!?]/.test(line) && (inSection || matchCatalog(line) || STAPLE_WORDS.test(line))) {
    const ing = make(null, null, line.replace(/\s*(göz kararı|isteğe bağlı|yeterince|yeteri kadar|az miktar)\s*$/i, ""));
    return ing ? [ing] : null;
  }
  return null;
}

function servingsOf(input: string): number | null {
  const text = input.toLocaleLowerCase("tr");
  const m = text.match(/(\d{1,2})\s*(?:-\s*\d{1,2}\s*)?(?:kişilik|kişi için|porsiyon)/iu) ?? text.match(/porsiyon\s*(?:sayısı)?\s*[:：]\s*(\d{1,2})/iu);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 20 ? n : null;
}

/** "Hazırlık: 20 dk" / "Pişirme süresi: 1 saat" / "Bekleme: 30 dk" meta lines. */
function metaMinutes(text: string, word: string): number | null {
  const m = text.match(new RegExp(`${word}(?:\\s+süresi)?\\s*[:：]\\s*([^\\n]+)`, "iu"));
  return m ? parseDurationMinutes(m[1]) : null;
}

function totalOf(text: string): number | null {
  const total = text.match(/toplam(?:\s+süre)?\s*[:：]\s*([^\n]+)/iu);
  if (total) return parseDurationMinutes(total[1]);
  const prep = text.match(/hazırlık(?:\s+süresi)?\s*[:：]\s*([^\n]+)/iu);
  const cook = text.match(/pişirme(?:\s+süresi)?\s*[:：]\s*([^\n]+)/iu);
  const sum = (prep ? parseDurationMinutes(prep[1]) ?? 0 : 0) + (cook ? parseDurationMinutes(cook[1]) ?? 0 : 0);
  return sum || null;
}

export function guessRole(name: string): ImportedRecipe["role"] {
  const n = name.toLocaleLowerCase("tr");
  if (/çorba/.test(n)) return "corba";
  if (/salata|cacık|piyaz|ezme|haydari|meze|söğüş/.test(n)) return "salata";
  if (/pilav|püre|erişte|bulgur|garnitür/.test(n)) return "yaninda";
  if (/tatlı|kek|kurabiye|sütlaç|revani|baklava|muhallebi|puding|tiramisu|brownie|cheesecake|helva|lokma/.test(n)) return null;
  return "ana";
}

/** Prep-ahead hints hidden in the text: "akşamdan ıslatın", "kıymayı dondurucudan çıkarın". */
export function findPrep(text: string): ImportedPrep[] {
  const out: ImportedPrep[] = [];
  const sentences = text.split(/(?<=[.!?])\s+|\n/).map((s) => clean(stripBullet(s))).filter(Boolean);
  for (const s of sentences) {
    const low = s.toLocaleLowerCase("tr");
    if (/(akşamdan|bir gece (önce|önceden)|gece boyunca|önceki (gün|akşam)).*(ıslat|bekle|marine)|ıslat.*(akşamdan|bir gece|gece boyunca)/.test(low)) {
      const what = low.match(/(\p{L}+(?:ı|i|u|ü|yı|yi|yu|yü))\s+(?:\p{L}+\s+){0,4}?ıslat/u);
      out.push({ label: what ? `${sentenceCase(what[1])} ıslatmaya koy` : "Akşamdan ıslatmaya koy", when: "night-before" });
    } else if (/(dondurucu|buzluk|derin dondurucu)\p{L}*\s+(?:\p{L}+\s+){0,2}?çıkar/u.test(low)) {
      const what = low.match(/(\p{L}+)\s+(?:\p{L}+\s+){0,2}?(dondurucu|buzluk)/u);
      out.push({ label: what ? `${sentenceCase(what[1])} buzluktan çıkar` : "Buzluktan çıkar", when: "morning" });
    } else if (/marine/.test(low) && /(en az|1 saat|bir saat|30 dakika|yarım saat)/.test(low)) {
      out.push({ label: "Marine et, dinlensin", when: "hour-before" });
    }
    if (out.length >= 3) break;
  }
  return out.filter((p, i) => out.findIndex((q) => q.label === p.label) === i);
}

function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+(?=\p{Lu})/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function toStep(text: string): ImportedStep | null {
  const t = clean(text).replace(/^[:：-]\s*/, "").trim();
  if (t.length < 4 || /^\d{1,2}\s*(kişilik|porsiyon)\b/iu.test(t)) return null;
  return { text: t.charAt(0).toLocaleUpperCase("tr") + t.slice(1), minutes: parseDurationMinutes(t) };
}

/**
 * Parse a caption/description. `titleHint` is the platform title (TikTok
 * caption's first line, YouTube video title) when there is one.
 */
export function parseRecipeText(input: string, titleHint?: string | null): ImportedRecipe {
  const text = input.slice(0, MAX_INPUT_CHARS).replace(/\r\n?/g, "\n");
  const rawLines = text.split("\n");
  const lines = rawLines.map((l) => l.trim()).filter((l) => l && !isHashtagLine(l));

  // Inline "Malzemeler: a, b, c" on one line becomes one line per item.
  const expanded: string[] = [];
  for (const l of lines) {
    const c = clean(l);
    const head = c.toLocaleLowerCase("tr").match(INGREDIENT_HEAD);
    if (head && c.length > head[0].length + 3 && c.includes(",")) {
      expanded.push("Malzemeler:");
      expanded.push(...c.slice(head[0].length).split(/\s*,\s*/).map((p) => `- ${p}`));
      continue;
    }
    const stepHead = c.toLocaleLowerCase("tr").match(STEP_HEAD);
    if (stepHead && c.length > stepHead[0].length + 10) {
      expanded.push("Yapılışı:");
      expanded.push(c.slice(stepHead[0].length));
      continue;
    }
    expanded.push(l);
  }

  let section: "intro" | "ing" | "steps" = "intro";
  let sawIngredientHead = false;
  let sawStepHead = false;
  const ingredients: ImportedIngredient[] = [];
  const steps: ImportedStep[] = [];
  const intro: string[] = [];

  for (const raw of expanded) {
    const c = clean(raw);
    if (!c) continue;
    const low = c.toLocaleLowerCase("tr");
    if (INGREDIENT_HEAD.test(low) && low.replace(INGREDIENT_HEAD, "").length < 3) {
      section = "ing";
      sawIngredientHead = true;
      continue;
    }
    if (STEP_HEAD.test(low) && low.replace(STEP_HEAD, "").length < 3) {
      section = "steps";
      sawStepHead = true;
      continue;
    }
    if (SUB_HEAD.test(low) || META_LINE.test(low)) continue;
    // "Kıymayı sabahtan çıkarmayı unutmayın": a reminder, kept as prep, not a step.
    if (/unutma/u.test(low) && findPrep(c).length) continue;

    if (section === "steps") {
      if (NUMBERED.test(raw)) {
        const st = toStep(stripBullet(raw));
        if (st) steps.push(st);
      } else {
        for (const s of splitSentences(c)) {
          const st = toStep(s);
          if (st) steps.push(st);
        }
      }
      continue;
    }

    const ing = parseIngredientLine(raw, section === "ing");
    if (ing && ing.length) {
      ingredients.push(...ing);
      if (section === "intro" && ingredients.length >= 2) section = "ing";
      continue;
    }
    if (section === "ing" && !sawStepHead && (NUMBERED.test(raw) || c.length > 40)) {
      // Ingredients ended without a "Yapılışı" heading: the rest are steps.
      section = "steps";
      const st = toStep(stripBullet(raw));
      if (st) steps.push(st);
      continue;
    }
    if (section === "intro") intro.push(raw);
  }

  // No headings and nothing ingredient-like: numbered lines in the intro are steps.
  if (!steps.length) {
    for (const raw of expanded) {
      if (NUMBERED.test(raw) && !parseIngredientLine(raw)) {
        const st = toStep(stripBullet(raw));
        if (st) steps.push(st);
      }
    }
  }

  const titleSource = titleHint?.trim() || intro[0] || lines[0] || "";
  const name = cleanTitle(titleSource) || "İçe aktarılan tarif";
  void sawIngredientHead;

  const finalSteps = steps.slice(0, 40);
  const finalIngredients = dedupe(ingredients).slice(0, 60);
  const fromSteps = stepMinutes(finalSteps);
  return {
    name,
    servings: servingsOf(text),
    role: guessRole(name),
    totalMinutes: totalOf(text),
    prepMinutes: metaMinutes(text, "hazırlık"),
    cookMinutes: metaMinutes(text, "pişirme"),
    waitMinutes: metaMinutes(text, "bekleme") ?? (fromSteps.wait || null),
    ingredients: finalIngredients,
    steps: finalSteps,
    prep: findPrep(text),
    tags: keywordTags(text, finalIngredients),
  };
}

function dedupe(list: ImportedIngredient[]): ImportedIngredient[] {
  const seen = new Set<string>();
  return list.filter((i) => {
    const k = i.item.toLocaleLowerCase("tr");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Does the text contain anything that looks like an ingredient list? */
export function hasIngredientLines(text: string | null | undefined): boolean {
  if (!text) return false;
  const r = parseRecipeText(text);
  return r.ingredients.filter((i) => i.amount !== null).length >= 2 || r.ingredients.length >= 3;
}
