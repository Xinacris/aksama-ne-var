const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** URL-safe id from a Turkish name: "İzmir köfte" → "izmir-kofte". */
export function slugify(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[çğıİöşüâîû]/g, (c) => TR_MAP[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Turkish-aware search key. */
export function searchKey(s: string): string {
  return s.trim().toLocaleLowerCase("tr");
}

export function trCompare(a: string, b: string): number {
  return a.localeCompare(b, "tr");
}

/** "Ali" → "Ali'nin", "Zeynep" → "Zeynep'in" (vowel harmony + buffer n). */
export function genitive(name: string): string {
  return `${name}'${genitiveSuffix(name)}`;
}

const BACK = "aıou";
const FRONT = "eiöü";
const VOWELS = BACK + FRONT + "âîû";

function lastVowel(word: string): string {
  const w = word.toLocaleLowerCase("tr");
  for (let i = w.length - 1; i >= 0; i--) if (VOWELS.includes(w[i])) return w[i];
  return "e";
}

function genitiveSuffix(name: string): string {
  const w = name.toLocaleLowerCase("tr");
  const endsVowel = VOWELS.includes(w[w.length - 1] ?? "");
  const v = lastVowel(name);
  const h = v === "a" || v === "ı" || v === "â" ? "ı" : v === "o" || v === "u" || v === "û" ? "u" : v === "ö" || v === "ü" ? "ü" : "i";
  return endsVowel ? `n${h}n` : `${h}n`;
}

/** Dative: "Salı" → "Salı'ya", "Perşembe" → "Perşembe'ye", "Cuma" → "Cuma'ya". */
export function dative(name: string): string {
  const w = name.toLocaleLowerCase("tr");
  const endsVowel = VOWELS.includes(w[w.length - 1] ?? "");
  const back = BACK.includes(lastVowel(name)) || lastVowel(name) === "â" || lastVowel(name) === "û";
  const a = back ? "a" : "e";
  return `${name}'${endsVowel ? "y" : ""}${a}`;
}

/** Ablative: "Cumartesi" → "Cumartesiden" (no apostrophe for common nouns). */
export function ablativeSuffix(word: string): string {
  const back = BACK.includes(lastVowel(word));
  const last = word.toLocaleLowerCase("tr").slice(-1);
  const hard = "fstkçşhp".includes(last);
  return `${hard ? "t" : "d"}${back ? "a" : "e"}n`;
}

export function capitalizeTr(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase("tr") + s.slice(1) : s;
}

export function lowerFirstTr(s: string): string {
  return s ? s.charAt(0).toLocaleLowerCase("tr") + s.slice(1) : s;
}

/** Number + accusative possessive as read aloud: 8 → "8'ini", 3 → "3'ünü", 6 → "6'sını", 10 → "10'unu". */
export function numberAccusative(n: number): string {
  const tens = n % 100;
  const last = n % 10;
  let suffix: string;
  if (n === 0) suffix = "'ını";
  else if (last === 0) {
    const t = Math.floor(tens / 10);
    suffix = t === 0 ? (n % 1000 === 0 ? "'ini" : "'ünü") : ["", "'unu", "'sini", "'unu", "'ını", "'sini", "'ını", "'ini", "'ini", "'ını"][t];
  } else suffix = ["", "'ini", "'sini", "'ünü", "'ünü", "'ini", "'sını", "'sini", "'ini", "'unu"][last];
  return `${n}${suffix}`;
}
