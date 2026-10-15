import { BASE_CATALOG, catalogEntry } from "../../data/seed/ingredients";

/**
 * Free-text ingredient ("orta boy kuru soğan, ince doğranmış") → catalog name
 * ("Kuru soğan") so imported recipes feed the shopping list like built-ins.
 * Returns null when nothing in the catalog fits; the item then stays free text.
 */

/** Everyday words people use for catalog items. Checked after exact catalog names. */
const ALIASES: [RegExp, string][] = [
  [/\b(dana |kuzu )?kıyma/, "Kıyma"],
  [/tavuk göğ(üs|sü)/, "Tavuk göğsü"],
  [/tavuk (but|pirzola)/, "Tavuk but"],
  [/(baget|tavuk incik)/, "Tavuk baget"],
  [/(kuşbaşı|kuş başı)/, "Dana kuşbaşı"],
  [/yeşil mercimek/, "Yeşil mercimek"],
  [/mercimek/, "Kırmızı mercimek"],
  [/taze fasulye|çalı fasulye/, "Taze fasulye"],
  [/barbunya/, "Kuru barbunya"],
  [/fasulye/, "Kuru fasulye"],
  [/haşlanmış nohut|konserve nohut/, "Haşlanmış nohut"],
  [/nohut/, "Nohut"],
  [/köftelik bulgur|ince bulgur/, "Köftelik bulgur"],
  [/bulgur/, "Pilavlık bulgur"],
  [/pirinç unu/, "Pirinç unu"],
  [/pirinç/, "Baldo pirinç"],
  [/tel şehriye/, "Tel şehriye"],
  [/şehriye/, "Arpa şehriye"],
  [/spagetti/, "Spagetti"],
  [/makarna|penne|fiyonk/, "Kalem makarna"],
  [/biber salça/, "Biber salçası"],
  [/salça/, "Domates salçası"],
  [/zeytin ?yağ/, "Zeytinyağı"],
  [/tere ?yağ/, "Tereyağı"],
  [/(ayçiçek|sıvı|kızartma)\s*yağ|^yağ$|^yağı$/, "Sıvı yağ"],
  [/taze nane/, "Taze nane"],
  [/nane/, "Kuru nane"],
  [/pul biber|kırmızı pul/, "Pul biber"],
  [/kara ?biber/, "Karabiber"],
  [/toz (kırmızı )?biber|kırmızı toz biber/, "Toz kırmızı biber"],
  [/kapya/, "Kapya biber"],
  [/çarliston/, "Çarliston biber"],
  [/dolmalık biber/, "Dolmalık biber"],
  [/sivri biber|sivri/, "Sivri biber"],
  [/yeşil biber|biber/, "Yeşil biber"],
  [/kırmızı soğan|mor soğan/, "Kırmızı soğan"],
  [/yeşil soğan|taze soğan/, "Yeşil soğan"],
  [/soğan/, "Kuru soğan"],
  [/sarımsak/, "Sarımsak"],
  [/kemer patlıcan/, "Kemer patlıcan"],
  [/patlıcan/, "Patlıcan"],
  [/domates püre/, "Domates püresi"],
  [/domates/, "Domates"],
  [/salatalık|hıyar/, "Salatalık"],
  [/maydanoz/, "Maydanoz"],
  [/dereotu|dere otu/, "Dereotu"],
  [/limon/, "Limon"],
  [/süzme yoğurt/, "Süzme yoğurt"],
  [/yoğurt/, "Yoğurt"],
  [/kaşar/, "Kaşar peyniri"],
  [/lor/, "Lor peyniri"],
  [/peynir/, "Beyaz peynir"],
  [/krema|krema/, "Krema"],
  [/yumurta/, "Yumurta"],
  [/^süt$|\bsüt\b/, "Süt"],
  [/(toz )?şeker/, "Toz şeker"],
  [/kabartma tozu/, "Kabartma tozu"],
  [/maya/, "Kuru maya"],
  [/galeta/, "Galeta unu"],
  [/mısır unu/, "Mısır unu"],
  [/irmik/, "İrmik"],
  [/nişasta/, "Nişasta"],
  [/\bun\b|^un$/, "Un"],
  [/ceviz/, "Ceviz içi"],
  [/tuz/, "Tuz"],
  [/kimyon/, "Kimyon"],
  [/kekik/, "Kekik"],
  [/sumak/, "Sumak"],
  [/tarçın/, "Tarçın"],
  [/defne/, "Defne yaprağı"],
  [/nar ekşi/, "Nar ekşisi"],
  [/sirke/, "Sirke"],
  [/patates/, "Patates"],
  [/havuç/, "Havuç"],
  [/kabak/, "Kabak"],
  [/ıspanak|ispanak/, "Ispanak"],
  [/pırasa/, "Pırasa"],
  [/mantar/, "Mantar"],
  [/lahana/, "Beyaz lahana"],
  [/bezelye/, "Bezelye"],
  [/yufka/, "Yufka"],
  [/bayat ekmek|ekmek içi/, "Bayat ekmek"],
];

const BY_LENGTH = [...BASE_CATALOG].sort((a, b) => b.name.length - a.name.length);

/** Water is never bought; it belongs in the steps, not the list. */
export function isWater(item: string): boolean {
  return /^(\p{L}+\s+)?(su|suyu)$/u.test(item.trim().toLocaleLowerCase("tr")) && !/limon|domates|portakal|nar/.test(item.toLocaleLowerCase("tr"));
}

export function matchCatalog(item: string): string | null {
  const t = item.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
  if (!t) return null;
  for (const c of BY_LENGTH) {
    const n = c.name.toLocaleLowerCase("tr");
    const i = t.indexOf(n);
    const after = t[i + n.length];
    // Short names ("un") must be whole words; longer ones may carry a suffix ("domatesleri").
    const endOk = !after || !/\p{L}/u.test(after) || n.length >= 4;
    if (i >= 0 && (i === 0 || /[\s,(]/.test(t[i - 1])) && endOk) return c.name;
  }
  for (const [re, name] of ALIASES) if (re.test(t) && catalogEntry(name)) return name;
  return null;
}
