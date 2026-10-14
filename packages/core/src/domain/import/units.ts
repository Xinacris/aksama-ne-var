import type { Unit } from "../../data/models";
import { wordNumber } from "../durations";

/** Spoken/abbreviated kitchen units → the app's unit list. Longest first. */
const UNIT_ALIASES: [RegExp, Unit][] = [
  [/^(yemek|çorba)\s*kaşı(ğı|k)$|^y\.?\s?k\.?$|^yk$/i, "yemek kaşığı"],
  [/^tatlı\s*kaşı(ğı|k)$|^t\.?\s?k\.?$|^tk$/i, "tatlı kaşığı"],
  [/^çay\s*kaşı(ğı|k)$|^ç\.?\s?k\.?$|^çk$/i, "çay kaşığı"],
  [/^su\s*bardağı$|^s\.?\s?b\.?$|^sb$|^bardak$/i, "su bardağı"],
  [/^çay\s*bardağı$|^ç\.?\s?b\.?$|^çb$/i, "çay bardağı"],
  [/^(g|gr|gr\.|gram|gramlık)$/i, "g"],
  [/^(kg|kilo|kilogram|kiloluk)$/i, "kg"],
  [/^(ml|mililitre)$/i, "ml"],
  [/^(l|lt|litre|litrelik)$/i, "l"],
  [/^(adet|tane|ad\.)$/i, "adet"],
  [/^(demet|bağ)$/i, "demet"],
  [/^diş$/i, "diş"],
  [/^dilim$/i, "dilim"],
  [/^(paket|pk|paketlik)$/i, "paket"],
  [/^kavanoz$/i, "kavanoz"],
  [/^(kutu|konserve)$/i, "kutu"],
  [/^tutam$/i, "tutam"],
];

/** Unit words as a regex alternation, longest first, for line parsing. */
export const UNIT_WORDS = [
  "yemek kaşığı",
  "çorba kaşığı",
  "tatlı kaşığı",
  "çay kaşığı",
  "su bardağı",
  "çay bardağı",
  "yemek kaşık",
  "tatlı kaşık",
  "çay kaşık",
  "y\\.k\\.",
  "t\\.k\\.",
  "ç\\.k\\.",
  "s\\.b\\.",
  "yk",
  "tk",
  "çk",
  "sb",
  "çb",
  "bardak",
  "gramlık",
  "gram",
  "gr\\.?",
  "g",
  "kilogram",
  "kiloluk",
  "kilo",
  "kg",
  "mililitre",
  "ml",
  "litrelik",
  "litre",
  "lt",
  "l",
  "adet",
  "tane",
  "demet",
  "bağ",
  "diş",
  "dilim",
  "paketlik",
  "paket",
  "pk",
  "kavanoz",
  "kutu",
  "konserve",
  "tutam",
];

export function normalizeUnit(raw: string | null | undefined): Unit | null {
  if (!raw) return null;
  const t = raw.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
  for (const [re, unit] of UNIT_ALIASES) if (re.test(t)) return unit;
  return null;
}

const VULGAR: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

/** "1,5" · "1/2" · "1 1/2" · "1½" · "yarım" · "iki" · "2-3" (upper bound). */
export function parseAmount(raw: string): number | null {
  let t = raw.trim().toLocaleLowerCase("tr");
  if (!t) return null;
  const range = t.split(/\s*(?:-|–|—|ila|ya da|veya)\s*/);
  if (range.length === 2 && range[1]) t = range[1];
  t = t.replace(/(\d)\s*([½¼¾⅓⅔⅛])/, (_, d: string, f: string) => String(Number(d) + VULGAR[f]));
  if (t in VULGAR) return VULGAR[t];
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  if (/^\d+(?:[.,]\d+)?$/.test(t)) {
    // "1.000" is a thousand in Turkish; "1.5" is one and a half.
    if (/^\d{1,3}\.\d{3}$/.test(t)) return Number(t.replace(".", ""));
    return Number(t.replace(",", "."));
  }
  const buçuk = t.match(/^(.+?)\s+buçuk$/);
  if (buçuk) {
    const n = wordNumber(buçuk[1]) ?? parseAmount(buçuk[1]);
    return n === null ? null : n + 0.5;
  }
  const w = wordNumber(t);
  return w && w > 0 ? w : null;
}
