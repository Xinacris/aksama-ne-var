import { addDays as dfAddDays, differenceInCalendarDays, parseISO } from "date-fns";

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

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("tr-TR", opts);
const weekdayLong = fmt({ weekday: "long" });
const weekdayShort = fmt({ weekday: "short" });
const dayMonthLong = fmt({ day: "numeric", month: "long" });
const monthLong = fmt({ month: "long" });
const monthShort = fmt({ month: "short" });
const time = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });

/** "Pazartesi" */
export function dayName(iso: string): string {
  return weekdayLong.format(fromIsoDate(iso));
}

/** "Pzt" */
export function dayShort(iso: string): string {
  return weekdayShort.format(fromIsoDate(iso)).replace(".", "");
}

/** "Pazartesi, 12 Ekim" */
export function longDate(iso: string): string {
  const d = fromIsoDate(iso);
  return `${weekdayLong.format(d)}, ${dayMonthLong.format(d)}`;
}

/** "10 Eki" */
export function shortDayMonth(iso: string): string {
  const d = fromIsoDate(iso);
  return `${d.getDate()} ${monthShort.format(d).replace(".", "")}`;
}

/** "10 – 16 Ekim" or "28 Eylül – 4 Ekim" */
export function rangeLabel(fromIso: string, toIso: string): string {
  const a = fromIsoDate(fromIso);
  const b = fromIsoDate(toIso);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${monthLong.format(b)}`;
  return `${a.getDate()} ${monthLong.format(a)} – ${b.getDate()} ${monthLong.format(b)}`;
}

/** "3 Eylül" */
export function dayMonth(iso: string): string {
  return dayMonthLong.format(fromIsoDate(iso));
}

/** "09:12" */
export function clockTime(d: Date): string {
  return time.format(d);
}

/** 70 → "1 sa 10 dk", 30 → "30 dk", 60 → "1 sa" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

/** Relative day phrase used by rotation memory: "3 hafta önce". */
export function agoDays(days: number): string {
  if (days <= 0) return "bugün";
  if (days === 1) return "dün";
  if (days < 14) return `${days} gün önce`;
  if (days < 56) return `${Math.floor(days / 7)} hafta önce`;
  if (days < 365) return `${Math.max(2, Math.round(days / 30))} ay önce`;
  return `${Math.floor(days / 365)} yıl önce`;
}

/** Activity timestamps: "az önce", "14 dk önce", "3 sa önce", "dün", "4 gün önce". */
export function agoTime(thenIso: string, now: Date): string {
  const then = new Date(thenIso);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);
  const dayDiff = differenceInCalendarDays(now, then);
  if (dayDiff === 0) {
    if (mins < 2) return "az önce";
    if (mins < 60) return `${mins} dk önce`;
    return `${Math.floor(mins / 60)} sa önce`;
  }
  if (dayDiff === 1) return "dün";
  return agoDays(dayDiff);
}

/** "Salı akşamı" (or "Bu akşam" for today). */
export function eveningLabel(date: string, todayIso: string): string {
  return date === todayIso ? "Bu akşam" : `${dayName(date)} akşamı`;
}

/** "Salı akşamına" (or "Bu akşama"). */
export function eveningDative(date: string, todayIso: string): string {
  return date === todayIso ? "Bu akşama" : `${dayName(date)} akşamına`;
}
