import i18next from "i18next";
import { enUS as dfEn, tr as dfTr, type Locale as DateFnsLocale } from "date-fns/locale";
import en from "../../i18n/en.json";
import tr from "../../i18n/tr.json";

/**
 * One i18next instance for the whole app, framework-free: core's sentence
 * builders (dates, reminders, activity lines, errors) call `t` directly; web
 * and mobile hand the same instance to react-i18next's provider. Turkish is
 * the source of truth and the fallback.
 */
export const LOCALES = ["tr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "tr";

/** Device-level storage key, like the theme's (`anv.theme`). */
export const LOCALE_STORAGE_KEY = "anv.locale";

export const i18n = i18next.createInstance();
void i18n.init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...LOCALES],
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options as never) as unknown as string;
}

export function isLocale(v: unknown): v is Locale {
  return v === "tr" || v === "en";
}

export function getLocale(): Locale {
  return isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
}

export function setLocale(l: Locale): void {
  if (i18n.language !== l) void i18n.changeLanguage(l);
}

/** First run: Turkish for a Turkish device/browser, English for anything else. */
export function detectLocale(languageTags: readonly (string | null | undefined)[]): Locale {
  const first = languageTags.find((x) => !!x);
  return first && first.toLowerCase().startsWith("tr") ? "tr" : "en";
}

/** date-fns locale for the current language (week starts on Monday in both). */
export function dateFnsLocale(l: Locale = getLocale()): DateFnsLocale {
  return l === "tr" ? dfTr : { ...dfEn, options: { ...dfEn.options, weekStartsOn: 1 } };
}

/** BCP-47 tag for Intl formatters. */
export function intlTag(l: Locale = getLocale()): string {
  return l === "tr" ? "tr-TR" : "en-GB";
}

/**
 * A `Record<K, string>` whose values are read from the catalog when accessed,
 * so `COURSE_LABEL[c]`-style maps follow the current language without each
 * caller changing. Keys live under `${prefix}.${k}`.
 */
export function labelRecord<K extends string>(prefix: string, keys: readonly K[], keyOf: (k: K) => string = (k) => k): Readonly<Record<K, string>> {
  const out = {} as Record<K, string>;
  for (const k of keys) Object.defineProperty(out, k, { get: () => t(`${prefix}.${keyOf(k)}`), enumerable: true });
  return out;
}

/** "Ali ve Zeynep" / "Ali and Zeynep" (Intl list formatting, current language). */
export function listJoin(items: readonly string[]): string {
  if (items.length < 2) return items.join("");
  try {
    return new Intl.ListFormat(intlTag(), { style: "long", type: "conjunction" }).format(items);
  } catch {
    return items.slice(0, -1).join(", ") + ` ${t("common.and")} ` + items[items.length - 1];
  }
}

/** Recipe tags are stored in Turkish ("Fırında"); shown through `tag.<slug>` when the catalog has it. */
export function tagLabel(tag: string): string {
  const slug = tag
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return t(`tag.${slug}`, { defaultValue: tag });
}
