import type { Aisle, Side, Unit } from "../models";
import { ingredientLabel } from "../../domain/recipeText";
import { MORE_INGREDIENTS, PANTRY_KEYS } from "./pantry";

/**
 * Canonical ingredient catalog. Every recipe ingredient must use one of
 * these names, which is what makes the shopping list aggregate cleanly.
 *
 * - `base`: unit the list sums in (g, ml, adet or demet).
 * - `perPiece` / `perCup` / `perTbsp`: approximate grams (or ml) used to
 *   convert kitchen measures into the base unit.
 * - `pack`: how it is bought; the list rounds up to whole packs.
 * - `staple`: salt, oil, spices — assumed at home, never auto-listed.
 */
export interface CatalogEntry {
  /** Pantry key (Round 3.4): the language-neutral id, e.g. "onion", "red-lentil" (seed/pantry.ts). */
  key: string;
  /** Turkish canonical name: what recipes and lists use. */
  name: string;
  /** English name, for entries the i18n `ing.*` table doesn't have. */
  en?: string;
  /** Alcoholic drink: recipes must offer an alcohol-free substitute. */
  alcohol?: boolean;
  side: Side;
  aisle: Aisle;
  base: "g" | "ml" | "adet" | "demet";
  perPiece?: number;
  perCup?: number;
  perTbsp?: number;
  pack?: { size: number; unit: Unit; label?: string };
  staple?: boolean;
}

const e = (
  name: string,
  side: Side,
  aisle: Aisle,
  base: CatalogEntry["base"],
  extra: Omit<CatalogEntry, "key" | "name" | "side" | "aisle" | "base"> = {},
): CatalogEntry => ({ key: "", name, side, aisle, base, ...extra });

const kasap = (name: string, extra: Partial<CatalogEntry> = {}) =>
  e(name, "market", "Kasap", "g", { pack: { size: 250, unit: "g" }, ...extra });
const sut = (name: string, base: CatalogEntry["base"], extra: Partial<CatalogEntry> = {}) =>
  e(name, "market", "Süt ve kahvaltılık", base, extra);
const kuru = (name: string, extra: Partial<CatalogEntry> = {}) =>
  e(name, "market", "Bakliyat ve kuru gıda", "g", { perCup: 180, perTbsp: 12, ...extra });
const sos = (name: string, base: CatalogEntry["base"], extra: Partial<CatalogEntry> = {}) =>
  e(name, "market", "Bakliyat ve kuru gıda", base, extra);
const baharat = (name: string) => e(name, "market", "Baharat", "g", { perTbsp: 6, staple: true });
const sebze = (name: string, extra: Partial<CatalogEntry> = {}) => e(name, "pazar", "Sebze", "g", extra);
const sebzeAdet = (name: string, extra: Partial<CatalogEntry> = {}) => e(name, "pazar", "Sebze", "adet", extra);
const yesil = (name: string) => e(name, "pazar", "Yeşillik", "demet");

const ORIGINAL_CATALOG: CatalogEntry[] = [
  // Kasap
  kasap("Kıyma"),
  kasap("Dana kuşbaşı"),
  kasap("Kuzu kuşbaşı"),
  kasap("Tavuk but", { pack: { size: 500, unit: "g" } }),
  kasap("Tavuk göğsü", { pack: { size: 500, unit: "g" } }),
  kasap("Tavuk baget", { pack: { size: 500, unit: "g" } }),
  kasap("Sucuk", { pack: { size: 250, unit: "g" } }),
  kasap("Hamsi", { pack: { size: 500, unit: "g" } }),
  e("Levrek", "market", "Kasap", "adet", { perPiece: 350 }),
  kasap("Dana kemik", { pack: { size: 500, unit: "g" } }),

  // Süt ve kahvaltılık
  sut("Süzme yoğurt", "g", { perCup: 220, perTbsp: 25, pack: { size: 1000, unit: "kg", label: "1 kg" } }),
  sut("Yoğurt", "g", { perCup: 220, perTbsp: 25, pack: { size: 1000, unit: "kg", label: "1 kg" } }),
  sut("Tereyağı", "g", { perTbsp: 15, perCup: 200, pack: { size: 250, unit: "g" } }),
  sut("Yumurta", "adet", { pack: { size: 10, unit: "adet" } }),
  sut("Süt", "ml", { pack: { size: 1000, unit: "l", label: "1 l" } }),
  sut("Beyaz peynir", "g", { perCup: 150, pack: { size: 500, unit: "g" } }),
  sut("Kaşar peyniri", "g", { perCup: 100, pack: { size: 250, unit: "g" } }),
  sut("Krema", "ml", { pack: { size: 200, unit: "ml" } }),
  sut("Lor peyniri", "g", { pack: { size: 500, unit: "g" } }),
  sut("Mısır unu", "g", { perCup: 140, perTbsp: 10, pack: { size: 500, unit: "g" } }),

  // Bakliyat ve kuru gıda
  kuru("Kırmızı mercimek", { pack: { size: 500, unit: "g" } }),
  kuru("Yeşil mercimek", { pack: { size: 500, unit: "g" } }),
  kuru("Kuru fasulye", { pack: { size: 500, unit: "g" } }),
  kuru("Nohut", { pack: { size: 500, unit: "g" } }),
  kuru("Haşlanmış nohut", { pack: { size: 400, unit: "g", label: "1 kutu" } }),
  kuru("Kuru barbunya", { pack: { size: 500, unit: "g" } }),
  kuru("Baldo pirinç", { pack: { size: 1000, unit: "kg", label: "1 kg" } }),
  kuru("Pilavlık bulgur", { perCup: 170, pack: { size: 1000, unit: "kg", label: "1 kg" } }),
  kuru("Köftelik bulgur", { perCup: 170, pack: { size: 500, unit: "g" } }),
  kuru("Arpa şehriye", { perCup: 170, pack: { size: 500, unit: "paket", label: "1 paket" } }),
  kuru("Tel şehriye", { perCup: 100, pack: { size: 500, unit: "paket", label: "1 paket" } }),
  kuru("Kalem makarna", { perCup: 100, pack: { size: 500, unit: "paket", label: "1 paket" } }),
  kuru("Spagetti", { pack: { size: 500, unit: "paket", label: "1 paket" } }),
  kuru("Erişte", { perCup: 100, pack: { size: 500, unit: "paket", label: "1 paket" } }),
  kuru("Un", { perCup: 110, perTbsp: 8, staple: true }),
  kuru("İrmik", { perCup: 160, perTbsp: 10, pack: { size: 500, unit: "g" } }),
  kuru("Toz şeker", { perCup: 180, perTbsp: 12, staple: true }),
  kuru("Pirinç unu", { perCup: 120, perTbsp: 9, pack: { size: 500, unit: "g" } }),
  kuru("Nişasta", { perCup: 120, perTbsp: 9, pack: { size: 200, unit: "paket", label: "1 paket" } }),
  kuru("Tarhana", { perCup: 120, perTbsp: 10, pack: { size: 500, unit: "paket", label: "1 paket" } }),
  kuru("Galeta unu", { perCup: 110, perTbsp: 8, pack: { size: 200, unit: "paket", label: "1 paket" } }),
  kuru("Ceviz içi", { perCup: 100, perTbsp: 8, pack: { size: 200, unit: "g" } }),
  kuru("Kuş üzümü", { perTbsp: 10, pack: { size: 100, unit: "paket", label: "1 paket" } }),
  kuru("Dolmalık fıstık", { perTbsp: 10, pack: { size: 50, unit: "paket", label: "1 paket" } }),
  kuru("Kabartma tozu", { perTbsp: 10, pack: { size: 10, unit: "paket", label: "1 paket" } }),
  kuru("Vanilya", { perTbsp: 5, pack: { size: 5, unit: "paket", label: "1 paket" } }),
  kuru("Kuru maya", { perTbsp: 8, pack: { size: 10, unit: "paket", label: "1 paket" } }),
  kuru("Kuru nane", { perTbsp: 2, staple: true }),

  // Yağ, salça ve sos
  sos("Domates salçası", "g", { perTbsp: 20, pack: { size: 700, unit: "kavanoz", label: "1 kavanoz" } }),
  sos("Biber salçası", "g", { perTbsp: 20, pack: { size: 700, unit: "kavanoz", label: "1 kavanoz" } }),
  sos("Nar ekşisi", "ml", { perTbsp: 15, pack: { size: 250, unit: "ml", label: "1 şişe" } }),
  sos("Zeytinyağı", "ml", { perTbsp: 15, perCup: 200, staple: true }),
  sos("Sıvı yağ", "ml", { perTbsp: 15, perCup: 200, staple: true }),
  sos("Sirke", "ml", { perTbsp: 15, staple: true }),
  sos("Mayonez", "g", { perTbsp: 15, pack: { size: 350, unit: "kavanoz", label: "1 kavanoz" } }),
  sos("Kornişon turşu", "adet", { pack: { size: 10, unit: "kavanoz", label: "1 kavanoz" } }),
  sos("Konserve garnitür", "g", { pack: { size: 400, unit: "kutu", label: "1 kutu" } }),
  sos("Domates püresi", "g", { perCup: 220, pack: { size: 500, unit: "kutu", label: "1 kutu" } }),

  // Baharat (staples)
  baharat("Tuz"),
  baharat("Karabiber"),
  baharat("Pul biber"),
  baharat("Kimyon"),
  baharat("Kekik"),
  baharat("Tarçın"),
  baharat("Yenibahar"),
  baharat("Köri"),
  baharat("Toz kırmızı biber"),
  baharat("Sumak"),
  baharat("Defne yaprağı"),

  // Fırın ve hamur
  e("Bayat ekmek", "market", "Fırın ve hamur", "adet", { staple: true }),
  e("Yufka", "market", "Fırın ve hamur", "adet", { pack: { size: 3, unit: "paket", label: "1 paket" } }),
  e("Ekmek", "market", "Fırın ve hamur", "adet"),

  // Dondurulmuş
  e("Hazır mantı", "market", "Dondurulmuş", "g", { perCup: 120, pack: { size: 500, unit: "paket", label: "1 paket" } }),
  e("Dondurulmuş bezelye", "market", "Dondurulmuş", "g", { perCup: 140, pack: { size: 450, unit: "paket", label: "1 paket" } }),

  // Sebze (pazar)
  sebze("Domates", { perPiece: 150, perCup: 200 }),
  sebzeAdet("Sivri biber", { perPiece: 25 }),
  sebzeAdet("Kemer patlıcan", { perPiece: 180 }),
  sebze("Patlıcan", { perPiece: 300 }),
  sebze("Patates", { perPiece: 200 }),
  sebze("Kuru soğan", { perPiece: 120 }),
  sebze("Kırmızı soğan", { perPiece: 120 }),
  sebzeAdet("Sarımsak", { perPiece: 1, pack: { size: 10, unit: "adet", label: "1 baş" } }),
  sebze("Havuç", { perPiece: 100 }),
  sebze("Kabak", { perPiece: 200 }),
  sebzeAdet("Salatalık", { perPiece: 150 }),
  sebze("Taze fasulye", { perCup: 120 }),
  sebzeAdet("Dolmalık biber", { perPiece: 60 }),
  sebzeAdet("Kapya biber", { perPiece: 120 }),
  sebzeAdet("Çarliston biber", { perPiece: 40 }),
  sebze("Pırasa", { perPiece: 250 }),
  sebze("Ispanak"),
  sebze("Beyaz lahana", { perPiece: 1500 }),
  sebze("Bamya"),
  sebzeAdet("Enginar", { perPiece: 200 }),
  sebze("Bezelye", { perCup: 140 }),
  sebze("Mantar", { pack: { size: 250, unit: "paket", label: "1 paket" } }),
  sebze("Karnabahar", { perPiece: 900 }),
  sebze("Brokoli", { perPiece: 500 }),
  sebze("Kereviz", { perPiece: 500 }),
  sebze("Bal kabağı"),
  sebze("Marul", { perPiece: 400 }),
  sebze("Semizotu"),
  sebze("Turp", { perPiece: 150 }),
  sebzeAdet("Yeşil biber", { perPiece: 30 }),

  // Yeşillik (pazar)
  yesil("Maydanoz"),
  yesil("Dereotu"),
  yesil("Taze nane"),
  yesil("Yeşil soğan"),
  yesil("Roka"),

  // Meyve (pazar)
  e("Limon", "pazar", "Meyve", "adet", { perPiece: 1 }),
];

/** Every ingredient the app knows: the original entries (keys from seed/pantry.ts) and the catalog's additions. */
export const INGREDIENT_CATALOG: CatalogEntry[] = [
  ...ORIGINAL_CATALOG.map((c) => {
    const key = PANTRY_KEYS[c.name];
    if (!key) throw new Error(`No pantry key for "${c.name}" — add it to seed/pantry.ts`);
    return { ...c, key };
  }),
  ...MORE_INGREDIENTS,
];

const byName = new Map(INGREDIENT_CATALOG.map((c) => [c.name, c]));
const byKey = new Map(INGREDIENT_CATALOG.map((c) => [c.key, c]));

export function catalogEntry(name: string): CatalogEntry | undefined {
  return byName.get(name);
}

/** The catalog entry for a pantry key ("red-lentil"). */
export function pantryEntry(key: string): CatalogEntry | undefined {
  return byKey.get(key);
}

/** Case/diacritic-insensitive lookup to normalize free-text names (manual list items, custom recipes). */
export function normalizeIngredientName(raw: string): string {
  const key = raw.trim().toLocaleLowerCase("tr");
  for (const c of INGREDIENT_CATALOG) {
    if (c.name.toLocaleLowerCase("tr") === key) return c.name;
  }
  // An English catalog name ("Minced beef") is the same ingredient: lists merge across languages.
  const en = raw.trim().toLowerCase();
  for (const c of INGREDIENT_CATALOG) {
    if (ingredientLabel(c.name, "en").toLowerCase() === en) return c.name;
  }
  const t = raw.trim();
  return t ? t.charAt(0).toLocaleUpperCase("tr") + t.slice(1) : t;
}
