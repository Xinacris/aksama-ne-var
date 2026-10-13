/**
 * Durations in Turkish recipe text: "20 dakika", "yarım saat", "10-15 dk"
 * (upper bound), "1 saat 15 dakika", "bir buçuk saat", "45 saniye".
 * Used by the cooking mode timers and the import parser.
 */

const ONES: Record<string, number> = { bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9 };
const TENS: Record<string, number> = { on: 10, yirmi: 20, otuz: 30, kırk: 40, elli: 50, altmış: 60, yetmiş: 70, seksen: 80, doksan: 90 };
const FRACTIONS: Record<string, number> = { yarım: 0.5, çeyrek: 0.25 };

const WORD = `(?:(?:${Object.keys(TENS).join("|")})(?:\\s+(?:${Object.keys(ONES).join("|")}))?|${Object.keys(ONES).join("|")}|${Object.keys(FRACTIONS).join("|")})`;
const NUM = `(?:\\d+(?:[.,]\\d+)?|${WORD})`;
const RANGE = `\\s*(?:-|–|—|ila|ile|ya\\s+da|veya|\\/)\\s*`;
const UNIT = `(saat\\p{L}*|sa\\.?(?!\\p{L})|dakika\\p{L}*|dk\\.?(?!\\p{L})|saniye\\p{L}*|sn\\.?(?!\\p{L}))`;
const PATTERN = new RegExp(`(?<![\\p{L}\\d])(${NUM})(?:${RANGE}(${NUM}))?(\\s*buçuk)?\\s*${UNIT}`, "giu");
const TAIL = new RegExp(`^\\s*(?:ve\\s+)?(${NUM})\\s*(dakika\\p{L}*|dk\\.?(?!\\p{L}))`, "iu");

export function wordNumber(raw: string): number | null {
  const t = raw.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
  if (/^\d+(?:[.,]\d+)?$/.test(t)) return Number(t.replace(",", "."));
  if (t in FRACTIONS) return FRACTIONS[t];
  if (t in ONES) return ONES[t];
  const [a, b] = t.split(" ");
  if (a in TENS) return TENS[a] + (b ? ONES[b] ?? NaN : 0) || null;
  return null;
}

function unitSeconds(unit: string): number {
  const u = unit.toLocaleLowerCase("tr");
  if (u.startsWith("sa") && !u.startsWith("san")) return 3600;
  if (u.startsWith("san") || u.startsWith("sn")) return 1;
  return 60;
}

export interface FoundDuration {
  /** Seconds; ranges use the upper bound. */
  seconds: number;
  /** The words as written, e.g. "10-15 dk". */
  text: string;
  index: number;
}

/** Every duration mentioned in a step, in order. Longer than 12 hours ("bir gece") is ignored. */
export function findDurations(text: string): FoundDuration[] {
  const out: FoundDuration[] = [];
  PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PATTERN.exec(text))) {
    const [, a, b, half, unit] = m;
    const lo = wordNumber(a);
    const hi = b ? wordNumber(b) : null;
    let value = Math.max(lo ?? 0, hi ?? 0);
    if (!value) continue;
    if (half) value += 0.5;
    let seconds = Math.round(value * unitSeconds(unit));
    let end = m.index + m[0].length;
    if (unitSeconds(unit) === 3600) {
      const tail = TAIL.exec(text.slice(end));
      const extra = tail ? wordNumber(tail[1]) : null;
      if (tail && extra) {
        seconds += Math.round(extra * 60);
        end += tail[0].length;
        PATTERN.lastIndex = end;
      }
    }
    if (seconds <= 0 || seconds > 12 * 3600) continue;
    out.push({ seconds, text: text.slice(m.index, end).trim(), index: m.index });
  }
  return out;
}

/** First duration in minutes (rounded up), or null. */
export function parseDurationMinutes(text: string): number | null {
  const d = findDurations(text)[0];
  return d ? Math.max(1, Math.ceil(d.seconds / 60)) : null;
}

/** "12:05" / "1:02:30" for a countdown. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** "20 dk", "1 sa 15 dk", "45 sn" for timer buttons. */
export function formatTimerLength(seconds: number): string {
  if (seconds < 60) return `${seconds} sn`;
  const min = Math.round(seconds / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} dk`;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}
