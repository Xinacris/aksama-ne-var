import type { Unit } from "../data/models";
import { getLocale, intlTag, t } from "../i18n";
import { slugify } from "../lib/text";

/**
 * Turkish kitchen measures with a fixed metric size. In English they are shown
 * as "1 cup (200 ml)" so the amount means the same thing everywhere; other
 * units get a translated name ("2 cloves", "1 pack").
 */
export const METRIC_ML: Partial<Record<Unit, number>> = {
  "su bardağı": 200,
  "çay bardağı": 100,
  "yemek kaşığı": 15,
  "tatlı kaşığı": 10,
  "çay kaşığı": 5,
};

const formatters = new Map<string, Intl.NumberFormat>();
/** "1,5" in Turkish, "1.5" in English. */
export function formatNumber(n: number): string {
  const tag = intlTag();
  let f = formatters.get(tag);
  if (!f) {
    f = new Intl.NumberFormat(tag, { maximumFractionDigits: 2 });
    formatters.set(tag, f);
  }
  return f.format(n);
}

/** "2 su bardağı" / "2 cups (400 ml)"; "3 diş" / "3 cloves"; "500 g" either way. */
export function unitAmount(n: number, unit: string): string {
  const num = formatNumber(n);
  if (!unit) return num;
  if (getLocale() === "tr") return `${num} ${unit}`;
  const label = t(`unitCount.${slugify(unit)}`, { count: n, n: num, defaultValue: `${num} ${unit}` });
  const ml = METRIC_ML[unit as Unit];
  return ml ? `${label} (${formatNumber(Math.round(n * ml))} ml)` : label;
}
