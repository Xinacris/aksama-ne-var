import type { CookLog } from "../data/models";
import { t } from "../i18n";
import { agoDays, daysBetween } from "./dates";

/** Most recent cook date per recipe. */
export function lastCookedMap(log: CookLog[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of log) {
    const prev = m.get(c.recipeId);
    if (!prev || c.date > prev) m.set(c.recipeId, c.date);
  }
  return m;
}

export function daysSinceCooked(recipeId: string, last: Map<string, string>, todayIso: string): number | null {
  const d = last.get(recipeId);
  return d ? daysBetween(d, todayIso) : null;
}

/** "En son 3 hafta önce yaptınız" / "Henüz birlikte yapmadınız" */
export function rotationLabel(days: number | null, solo = false): string {
  if (days === null) return t(solo ? "rotation.neverSolo" : "rotation.never");
  if (days <= 0) return t(solo ? "rotation.todaySolo" : "rotation.today");
  return t(solo ? "rotation.lastSolo" : "rotation.last", { ago: agoDays(days) });
}

/** Short form for match cards: "en son 3 hafta önce". */
export function rotationShort(days: number | null): string {
  if (days === null) return t("rotation.shortNever");
  if (days <= 0) return t("rotation.shortToday");
  return t("rotation.shortLast", { ago: agoDays(days) });
}
