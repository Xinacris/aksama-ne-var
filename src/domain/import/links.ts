/**
 * Links inside a caption/description that may lead to a written recipe
 * ("Yazılı tarif için: https://yemek.com/tarif/…"). Social, video and
 * shortener hosts are never recipe pages; shorteners are expanded only when
 * no direct recipe link worked.
 */

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'()]+|\b(?:bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly|buff\.ly|is\.gd|cutt\.ly|rebrand\.ly|shorturl\.at|tiny\.cc)\/[^\s<>"'()]+/giu;

const SOCIAL = /(^|\.)(instagram\.com|instagr\.am|facebook\.com|fb\.com|fb\.me|twitter\.com|x\.com|tiktok\.com|pinterest\.[a-z.]+|pin\.it|linkedin\.com|threads\.net|t\.me|telegram\.me|wa\.me|whatsapp\.com|snapchat\.com|linktr\.ee|discord\.gg|spotify\.com|apple\.com|google\.com|play\.google\.com)$/u;
const VIDEO = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitch\.tv)$/u;
export const SHORTENER = /^(bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly|buff\.ly|is\.gd|cutt\.ly|rebrand\.ly|shorturl\.at|tiny\.cc|amzn\.to|s\.id)$/u;

/** Words near a link that say "this is the written recipe". */
const RECIPE_CONTEXT = /yazılı\s+tarif|tarifin\s+tamamı|tarifin\s+detay|tarif(i|in)?\s+(için|linki|burada|sitemizde)|malzeme\s+listesi|recipe|tarif/iu;
/** Lines whose links are never the recipe: subscribe, sponsor, chef profiles, socials. */
const NOT_RECIPE_CONTEXT = /abone|subscribe|takip|follow|sponsor|ürünler(i|in)|reklam|indirim|kupon|satın|profil|tüm tarifler|sitemizi ziyaret|sosyal medya|instagram|facebook|twitter|tiktok/iu;

export type LinkKind = "social" | "video" | "shortener" | "web";

function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function linkKind(u: string): LinkKind | null {
  const host = hostOf(u);
  if (!host) return null;
  if (SHORTENER.test(host)) return "shortener";
  if (SOCIAL.test(host)) return "social";
  if (VIDEO.test(host)) return "video";
  return "web";
}

/** Every link in the text, with the line it sits on (trailing punctuation trimmed, scheme added). */
export function findLinks(text: string): { url: string; line: string }[] {
  const out: { url: string; line: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    for (const m of line.matchAll(URL_RE)) {
      let u = m[0].replace(/[.,;:!?)\]]+$/u, "");
      if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
      if (hostOf(u) && !out.some((o) => o.url === u)) out.push({ url: u, line });
    }
  }
  return out;
}

export interface RecipeLinkCandidate {
  url: string;
  shortener: boolean;
  score: number;
}

/**
 * Links worth trying for a written recipe, best first: recipe sites (not social, video or
 * shortener hosts), preferring "yazılı tarif"/"tarif"/"recipe" nearby and recipe-looking
 * paths; site home pages and profile pages rank low. Shorteners come last and only from
 * lines that look like a recipe pointer.
 */
export function recipeLinks(text: string): RecipeLinkCandidate[] {
  const out: RecipeLinkCandidate[] = [];
  for (const { url, line } of findLinks(text)) {
    const kind = linkKind(url);
    if (kind === "social" || kind === "video" || !kind) continue;
    const low = line.toLocaleLowerCase("tr"); // /i alone doesn't fold Turkish "İ"
    const near = RECIPE_CONTEXT.test(low);
    const noise = NOT_RECIPE_CONTEXT.test(low.replace(url.toLocaleLowerCase("tr"), ""));
    if (kind === "shortener") {
      if (near && !noise) out.push({ url, shortener: true, score: 1 });
      continue;
    }
    const path = new URL(url).pathname.toLowerCase();
    if (/\/(profil|profile|author|yazar|user|kullanici|uye)\//u.test(path)) continue;
    let score = 10;
    if (/yazılı\s+tarif|recipe/iu.test(low)) score += 20;
    else if (near) score += 10;
    if (/\/(tarif|tarifler|recipe|recipes)\b|-tarifi\b/u.test(path)) score += 10;
    if (path === "/" || path === "") score -= 15;
    if (noise) score -= 15;
    if (score > 0) out.push({ url, shortener: false, score });
  }
  return out.sort((a, b) => Number(a.shortener) - Number(b.shortener) || b.score - a.score);
}
