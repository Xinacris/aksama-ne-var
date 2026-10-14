/**
 * Channel boilerplate in captions and descriptions: link lists, subscribe and
 * follow calls, "SOSYAL MEDYA HESAPLARIMIZ", sponsor/affiliate lines, chef
 * profile promos, hashtag-only lines. Removed before structuring (LLM and
 * rules) and never allowed as a step.
 */

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b(?:bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly|cutt\.ly|is\.gd)\/\S+/giu;
const BULLET = /^[\s•·*▪◦●○►▶➤→\-–—]+/u;
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{20E3}]/gu;

const PROMO = new RegExp(
  [
    // subscribe / follow / notifications
    String.raw`abone\s+ol`,
    String.raw`kanal(ım|ımız)a\s+abone`,
    String.raw`takip\s+et(in|meyi|meyi\s+unutma)?\b`,
    String.raw`takipte\s+kal`,
    String.raw`bildirim(leri)?\s+aç`,
    String.raw`zil(e|i)\s+bas`,
    String.raw`beğenmeyi\s+unutma`,
    String.raw`yeni\s+videolar(ım|ımız)?dan\s+(hemen\s+)?haberdar`,
    String.raw`subscribe`,
    String.raw`follow\s+(us|me)`,
    // socials
    String.raw`sosyal\s+medya`,
    String.raw`^(instagram|facebook|twitter|x|tiktok|pinterest|youtube|threads|telegram)\s*[:：]`,
    // site / chef / profile promos
    String.raw`sitemizi\s+ziyaret`,
    String.raw`web\s+sitemiz`,
    String.raw`tüm\s+tarifler(i|in)e\s+ulaş`,
    String.raw`tariflerine\s+ulaşmak`,
    String.raw`profil(ine|imize)`,
    // sponsor / affiliate
    String.raw`sponsor`,
    String.raw`işbirliği`,
    String.raw`reklam(dır)?\b`,
    String.raw`indirim\s+kod`,
    String.raw`kupon\s+kod`,
    String.raw`affiliate`,
    String.raw`ürünlerine\s+ulaşmak`,
    String.raw`satın\s+al`,
    String.raw`linkler(i)?\s+(aşağıda|bio)`,
  ].join("|"),
  "iu",
);

const HASHTAGS_ONLY = /^([#@][\p{L}\d_.]+[\s,]*)+$/u;

/** A line that is boilerplate, not recipe content. */
export function isBoilerplateLine(raw: string): boolean {
  const line = raw.replace(EMOJI, " ").replace(BULLET, "").trim();
  if (!line) return false;
  if (HASHTAGS_ONLY.test(line)) return true;
  // Turkish lower-casing first: /i alone doesn't fold "İ" ("İndirim kodu", "İnstagram").
  if (PROMO.test(line.toLocaleLowerCase("tr"))) return true;
  const urls = line.match(URL_RE) ?? [];
  if (urls.length) {
    const rest = line.replace(URL_RE, "").replace(/[\s:：\-–—|•·,.]+/gu, " ").trim();
    // mostly a link: what is left is a short label ("Yazılı tarif için", "Instagram")
    if (rest.length <= 30 || urls.join("").length >= line.length / 2) return true;
  }
  // a bare handle line ("@yemekcom")
  if (/^@[\p{L}\d_.]+$/u.test(line)) return true;
  return false;
}

/** Drop boilerplate lines; collapse the blank lines they leave behind. */
export function stripBoilerplate(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((l) => !isBoilerplateLine(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
