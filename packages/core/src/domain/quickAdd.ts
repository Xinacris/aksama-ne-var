import { t } from "../i18n";
import { extractUrl, parseUrl } from "./import/detect";

/** What the quick-add box was given: a link to import, a dish name to save, or a pasted recipe text. */
export type QuickAdd = { kind: "empty" } | { kind: "url"; url: string } | { kind: "name"; name: string } | { kind: "text"; text: string };

/** A recipe name fits the form's limit; anything longer is a pasted recipe, not a name. */
export const QUICK_NAME_MAX = 80;

/** Bare domains count as links only with a real-looking ending ("Dr.Oetker" is a name, "yemek.com/x" a link). */
const TLD = /\.(com|net|org|tr|io|co|me|tv|app|blog|info|de|uk|be|ly|gl|gg|to|sh)$/i;

export function quickAddIntent(raw: string): QuickAdd {
  const t = raw.trim();
  if (!t) return { kind: "empty" };
  // A link anywhere ("Bu tarife bak https://…", the share sheet's usual shape).
  const inside = extractUrl(t);
  if (inside) return { kind: "url", url: inside };
  if (!/\s/.test(t)) {
    const u = parseUrl(t);
    if (u && TLD.test(u.hostname)) return { kind: "url", url: u.href };
  }
  if (/\n/.test(t) || t.length > QUICK_NAME_MAX) return { kind: "text", text: t };
  return { kind: "name", name: t.replace(/\s+/g, " ") };
}

/** Where a link or a pasted text goes: the existing import flow (it starts on its own). */
export function importHref(q: Extract<QuickAdd, { kind: "url" | "text" }>): string {
  return q.kind === "url" ? `/tarifler/ice-aktar?url=${encodeURIComponent(q.url)}` : `/tarifler/ice-aktar?text=${encodeURIComponent(q.text)}`;
}

/** The sheet's button: what one tap will do. */
export function quickAddAction(q: QuickAdd, known: boolean): string {
  if (q.kind === "url") return t("quickAdd.importLink");
  if (q.kind === "text") return t("quickAdd.importText");
  if (known) return t("quickAdd.openRecipe");
  return t("quickAdd.save");
}

/** The line under the field: what the input was read as. */
export function quickAddHint(q: QuickAdd, knownName: string | null): string {
  if (q.kind === "url") return t("quickAdd.hintLink");
  if (q.kind === "text") return t("quickAdd.hintText");
  if (knownName) return t("quickAdd.hintKnown", { name: knownName });
  if (q.kind === "name") return t("quickAdd.hintName");
  return t("quickAdd.hintEmpty");
}
