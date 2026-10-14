import { addDays as dfAddDays, differenceInCalendarDays, parseISO } from "date-fns";
import { intlTag, t } from "../i18n";

/** Local calendar date as YYYY-MM-DD (never UTC-shifted). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local date at midnight. */
export function fromIsoDate(s: string): Date {
  return parseISO(s);
}

export function addDays(iso: string, n: number): string {
  return toIsoDate(dfAddDays(fromIsoDate(iso), n));
}

export function daysBetween(fromIso: string, toIso: string): number {
  return differenceInCalendarDays(fromIsoDate(toIso), fromIsoDate(fromIso));
}

/** Board window from the design: "Son iki gün ve önümüzdeki beş gün". */
export function boardWindow(anchorIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(anchorIso, i - 2));
}

/** Days whose dinners feed the shopping list: today and the next six. */
export function listWindow(todayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(todayIso, i));
}

// Formatters per locale, built on first use (Intl construction is not free).
const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(name: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const tag = intlTag();
  const key = `${tag}|${name}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(tag, opts);
    cache.set(key, f);
  }
  return f;
}
const weekdayLong = () => fmt("wl", { weekday: "long" });
const weekdayShort = () => fmt("ws", { weekday: "short" });
const dayMonthLong = () => fmt("dml", { day: "numeric", month: "long" });
const monthLong = () => fmt("ml", { month: "long" });
const monthShort = () => fmt("ms", { month: "short" });
const time = () => fmt("t", { hour: "2-digit", minute: "2-digit", hour12: false });

/** "Pazartesi" */
export function dayName(iso: string): string {
  return weekdayLong().format(fromIsoDate(iso));
}

/** "Pzt" */
export function dayShort(iso: string): string {
  return weekdayShort().format(fromIsoDate(iso)).replace(".", "");
}

/** "Pazartesi, 12 Ekim" */
export function longDate(iso: string): string {
  const d = fromIsoDate(iso);
  return `${weekdayLong().format(d)}, ${dayMonthLong().format(d)}`;
}

/** "10 Eki" */
export function shortDayMonth(iso: string): string {
  const d = fromIsoDate(iso);
  return `${d.getDate()} ${monthShort().format(d).replace(".", "")}`;
}

/** "10 – 16 Ekim" or "28 Eylül – 4 Ekim" */
export function rangeLabel(fromIso: string, toIso: string): string {
  const a = fromIsoDate(fromIso);
  const b = fromIsoDate(toIso);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${monthLong().format(b)}`;
  return `${a.getDate()} ${monthLong().format(a)} – ${b.getDate()} ${monthLong().format(b)}`;
}

/** "3 Eylül" */
export function dayMonth(iso: string): string {
  return dayMonthLong().format(fromIsoDate(iso));
}

/** "09:12" */
export function clockTime(d: Date): string {
  return time().format(d);
}

/** 70 → "1 sa 10 dk", 30 → "30 dk", 60 → "1 sa" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return t("time.min", { m: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? t("time.hourMin", { h, m }) : t("time.hour", { h });
}

/** Relative day phrase used by rotation memory: "3 hafta önce". */
export function agoDays(days: number): string {
  if (days <= 0) return t("time.today");
  if (days === 1) return t("time.yesterday");
  if (days < 14) return t("time.daysAgo", { count: days });
  if (days < 56) return t("time.weeksAgo", { count: Math.floor(days / 7) });
  if (days < 365) return t("time.monthsAgo", { count: Math.max(2, Math.round(days / 30)) });
  return t("time.yearsAgo", { count: Math.floor(days / 365) });
}

/** Activity timestamps: "az önce", "14 dk önce", "3 sa önce", "dün", "4 gün önce". */
export function agoTime(thenIso: string, now: Date): string {
  const then = new Date(thenIso);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);
  const dayDiff = differenceInCalendarDays(now, then);
  if (dayDiff === 0) {
    if (mins < 2) return t("time.justNow");
    if (mins < 60) return t("time.minsAgo", { count: mins });
    return t("time.hoursAgo", { count: Math.floor(mins / 60) });
  }
  if (dayDiff === 1) return t("time.yesterday");
  return agoDays(dayDiff);
}

/** "Salı akşamı" (or "Bu akşam" for today). */
export function eveningLabel(date: string, todayIso: string): string {
  return date === todayIso ? t("time.tonight") : t("time.eveningOf", { day: dayName(date) });
}

/** "Salı akşamına" (or "Bu akşama"). */
export function eveningDative(date: string, todayIso: string): string {
  return date === todayIso ? t("time.toTonight") : t("time.toEveningOf", { day: dayName(date) });
}

/** Weekday name for a JS day index (0 = Sunday): "Pzt"/"Mon", "Pazartesi"/"Monday". */
export function weekdayName(dow: number, style: "short" | "long" = "long"): string {
  // 2026-10-11 was a Sunday.
  const d = new Date(2026, 9, 11 + dow);
  return (style === "short" ? weekdayShort() : weekdayLong()).format(d).replace(".", "");
}
