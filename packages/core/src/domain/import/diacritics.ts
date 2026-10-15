/**
 * Puts Turkish letters back into recipe text that lost them (ş→s, ı→i, ğ→g, ç→c, ö→o, ü→u),
 * as text read from a screenshot can. Used for the rule parser; the LLMs are told instead.
 *
 * Conservative by design: only words from a recipe dictionary are touched, a word that already
 * has a Turkish letter is left alone, and words that are real Turkish words both ways ("sis" /
 * "şiş", "kasık" / "kaşık", "dis" / "diş", "ilik" / "ılık") change only when the words around
 * them make it clear ("yemek kasigi", "ilik su", "2 dis sarimsak"). Unsure → unchanged; it never
 * adds or removes a word, a number or a unit.
 */

/** ASCII-folded form → the correct word. Only words with one recipe meaning. */
const WORDS: Record<string, string> = Object.fromEntries(
  (
    [
      // ingredients
      "kuşbaşı kıyma soğan soğanı soğanlar soğanları sarımsak sarımsağı şeker şekeri yağ yağı yağda yağı zeytinyağı tereyağı tereyağını ayçiçek sıvıyağ",
      "süt sütü yoğurt yoğurdu peynir kaşar kaşarı lor çökelek yumurtayı",
      "pirinç pirinci bulgurlu mercimeği nohudu havuç havucu patlıcan patlıcanı pırasa ıspanak mısır salatalık salatalığı",
      "fındık fıstık fıstığı çikolata çikolatası kırmızı kırmızıbiber salça salçası domatesli köfte köftesi",
      "balık balığı tavuğu göğüs göğsü bonfile pastırma sucuğu sucuk şehriye şehriyeli makarnayı",
      "susamı çörekotu kekik kimyonu tarçın tarçını karanfil zencefil zerdeçal sumak",
      // amounts and tools
      "bardağı bardak tatlı yarım çeyrek küçük büyük kalın tencereye tavaya fırın fırında fırını fırına tepsiye kapağı kapağını kısık ateş ateşte ateşi",
      "kişilik kişi çay",
      // verbs and steps
      "pişir pişirin pişirilir pişmiş pişene pişince pişirdikten doğrayın doğranmış doğra doğrayıp doğradığınız",
      "karıştırın karıştır karıştırarak karıştırıp çırpın çırp çırpılmış yoğurun yoğur yoğurup haşlayın haşla haşlanmış haşlayıp",
      "kızartın kızart kızgın kızaran kızarana ısıtın ısıt ısınan ısıtılmış çıkarın çıkar çıkardıktan soğutun soğusun soğuk soğuyunca",
      "süzün süz süzgeç süzdükten kaynatın kaynat kaynayınca dökün döküp serpin serpiştirin geçirin bölün",
      "içine için içinde üzerine üzerini üzeri üstüne önce önceden yavaşça hafifçe kıvam kıvamı kıvamını kıvama çiğ tüm bütün",
      "sıcak sıcakken sıcaklık ılıyınca dinlendirdikten yapılışı yapılış hazırlanışı hazırlanış hazırlığı malzemeleri süresi",
    ] as const
  )
    .flatMap((line) => line.split(/\s+/))
    .filter(Boolean)
    .map((w) => [fold(w), w] as const)
    .filter(([k, v]) => k !== v),
);

/**
 * Both ways are words: changed only next to a word that settles it. `before` / `after` are
 * folded neighbours; a number before counts as "before: #".
 */
const AMBIGUOUS: Record<string, { to: string; before?: string[]; after?: string[] }> = {
  kasik: { to: "kaşık", before: ["yemek", "tatli", "cay", "#"] },
  kasigi: { to: "kaşığı", before: ["yemek", "tatli", "cay", "#"] },
  kasiklari: { to: "kaşıkları", before: ["yemek", "tatli", "cay"] },
  dis: { to: "diş", before: ["#", "bir", "iki", "uc", "birkac"], after: ["sarimsak", "sarimsagi"] },
  sis: { to: "şiş", after: ["kebap", "kebabi", "kofte", "tavuk", "cubugu", "cubuguna"] },
  ilik: { to: "ılık", after: ["su", "suyla", "suda", "sut", "sutle", "sutu"] },
  acin: { to: "açın", after: ["hamuru", "hamur", "yufka", "oklava", "oklavayla"] },
  sure: { to: "süre", before: ["bu", "pisirme", "kisa", "uzun"] },
};

const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜâ]/;

export function fold(word: string): string {
  return word
    .toLocaleLowerCase("tr")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/â/g, "a");
}

/** The restored word in the original's case: "SOGAN" → "SOĞAN", "Sogan" → "Soğan". */
function withCase(original: string, restored: string): string {
  if (original.length > 1 && original === original.toLocaleUpperCase("tr") && original !== original.toLocaleLowerCase("tr")) return restored.toLocaleUpperCase("tr");
  const first = original[0];
  if (first && first !== first.toLocaleLowerCase("tr")) return restored[0].toLocaleUpperCase("tr") + restored.slice(1);
  return restored;
}

function restoreWord(word: string, prev: string | null, next: string | null): string {
  if (TURKISH_LETTERS.test(word)) return word;
  const key = word.toLocaleLowerCase("tr");
  const known = WORDS[key];
  if (known) return withCase(word, known);
  const amb = AMBIGUOUS[key];
  if (!amb || amb.to === key) return word;
  const prevKey = prev === null ? null : /^\d/.test(prev) ? "#" : fold(prev);
  const nextKey = next === null ? null : fold(next);
  const settled = (prevKey !== null && amb.before?.includes(prevKey)) || (nextKey !== null && amb.after?.includes(nextKey));
  return settled ? withCase(word, amb.to) : word;
}

/**
 * Recipe text with Turkish letters restored where the dictionary is sure; everything else kept
 * as is. Text that still doesn't read as Turkish afterwards (an English caption: "once", "sure")
 * comes back untouched.
 */
export function restoreDiacritics(text: string): string {
  const restored = restoreWords(text);
  return looksTurkishEnough(restored) ? restored : text;
}

/** At least three Turkish letters after restoring: the dictionary found real Turkish recipe words. */
function looksTurkishEnough(text: string): boolean {
  return (text.match(/[çğıöşüÇĞİÖŞÜ]/g) ?? []).length >= 3;
}

function restoreWords(text: string): string {
  return text
    .split(/(\r?\n)/)
    .map((line) => {
      // Words and numbers, with everything between them kept exactly.
      const parts = line.split(/([\p{L}]+|\d+(?:[.,/]\d+)?)/u);
      const tokens = parts.map((p, i) => ({ p, i })).filter(({ p }) => /^[\p{L}\d]/u.test(p));
      for (let k = 0; k < tokens.length; k++) {
        const { p, i } = tokens[k];
        if (!/^\p{L}/u.test(p)) continue;
        parts[i] = restoreWord(p, tokens[k - 1]?.p ?? null, tokens[k + 1]?.p ?? null);
      }
      return parts.join("");
    })
    .join("");
}
