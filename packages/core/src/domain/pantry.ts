import { AISLES, type Aisle, type PantryAnswer, type PantryItem, type Recipe } from "../data/models";
import { INGREDIENT_CATALOG, catalogEntry } from "../data/seed/ingredients";
import { ingredientLabel } from "./recipeText";
import { searchKey } from "../lib/text";

/**
 * "Evde ne var?" (Round 3.5): what the household has at home. Pure helpers shared by the web and
 * the phone: grouping, coverage for ranking, the onboarding chips, search.
 */

export type PantryStatus = NonNullable<PantryItem["status"]>;

export function pantryStatus(p: Pick<PantryItem, "status">): PantryStatus {
  return p.status ?? "have";
}

/** Names at home (have or az kaldı), by canonical name. */
export function pantryNames(pantry: readonly PantryItem[]): Set<string> {
  return new Set(pantry.map((p) => p.name));
}

/** Where an item sits: its catalog aisle, "Diğer" for free text. */
export function pantryAisle(name: string): Aisle {
  return catalogEntry(name)?.aisle ?? "Diğer";
}

/** Items grouped by category (catalog aisle), in the list's aisle order; names sorted within a group. */
export function groupPantry(pantry: readonly PantryItem[]): { aisle: Aisle; items: PantryItem[] }[] {
  const groups = new Map<Aisle, PantryItem[]>();
  for (const p of pantry) {
    const a = pantryAisle(p.name);
    groups.set(a, [...(groups.get(a) ?? []), p]);
  }
  return AISLES.filter((a) => groups.has(a)).map((aisle) => ({
    aisle,
    items: groups.get(aisle)!.sort((x, y) => ingredientLabel(x.name).localeCompare(ingredientLabel(y.name), "tr")),
  }));
}

/** "Son güncelleme": the latest change to the pantry or its checks; null when it was never filled. */
export function pantryUpdatedAt(pantry: readonly PantryItem[], answers: readonly PantryAnswer[] = []): string | null {
  let last: string | null = null;
  for (const t of [...pantry.map((p) => p.checkedAt ?? p.updatedAt), ...pantry.map((p) => p.updatedAt), ...answers.map((a) => a.answeredAt)]) {
    if (t && (!last || t > last)) last = t;
  }
  return last;
}

/** How much of a recipe is at home: non-staple ingredients found in the pantry. */
export function pantryCoverage(recipe: Pick<Recipe, "ingredients">, have: ReadonlySet<string>): { have: number; total: number; ratio: number } {
  const needed = [...new Set(recipe.ingredients.filter((i) => !i.staple).map((i) => i.name))];
  const n = needed.filter((name) => have.has(name)).length;
  return { have: n, total: needed.length, ratio: needed.length ? n / needed.length : 0 };
}

/**
 * Ranking bucket for decks and pickers: 0 (nothing at home) … 4 (all of it). Coarse on purpose, so
 * the rotation ("not made lately first") still orders dishes within a bucket.
 */
export function coverageRank(recipe: Pick<Recipe, "ingredients">, have: ReadonlySet<string>): number {
  if (have.size === 0) return 0;
  return Math.floor(pantryCoverage(recipe, have).ratio * 4);
}

/** Sort recipes with the best-covered first (stable otherwise). */
export function byPantryCoverage<T extends Pick<Recipe, "ingredients">>(recipes: readonly T[], have: ReadonlySet<string>): T[] {
  if (have.size === 0) return [...recipes];
  return recipes
    .map((r, i) => ({ r, i, c: pantryCoverage(r, have).ratio }))
    .sort((a, b) => b.c - a.c || a.i - b.i)
    .map((x) => x.r);
}

/** Onboarding's quick chips: common things a kitchen has, by category. Canonical catalog names. */
export const COMMON_PANTRY: { aisle: Aisle; names: string[] }[] = [
  { aisle: "Sebze", names: ["Kuru soğan", "Sarımsak", "Domates", "Patates", "Sivri biber", "Havuç", "Patlıcan", "Kabak"] },
  { aisle: "Yeşillik", names: ["Maydanoz", "Dereotu"] },
  { aisle: "Meyve", names: ["Limon"] },
  { aisle: "Süt ve kahvaltılık", names: ["Yumurta", "Süt", "Yoğurt", "Tereyağı", "Beyaz peynir", "Kaşar peyniri"] },
  { aisle: "Bakliyat ve kuru gıda", names: ["Baldo pirinç", "Pilavlık bulgur", "Kırmızı mercimek", "Kalem makarna", "Un", "Nohut", "Kuru fasulye", "Domates salçası", "Biber salçası", "Tel şehriye"] },
  { aisle: "Kasap", names: ["Kıyma", "Tavuk göğsü"] },
  { aisle: "Fırın ve hamur", names: ["Ekmek", "Yufka"] },
  { aisle: "Dondurulmuş", names: ["Dondurulmuş bezelye"] },
];

/** Catalog ingredients matching a search (either language), staples left out; at most `limit`. */
export function searchIngredients(q: string, limit = 8): string[] {
  const k = searchKey(q);
  if (!k) return [];
  const out: string[] = [];
  for (const c of INGREDIENT_CATALOG) {
    if (c.staple) continue;
    if (searchKey(c.name).includes(k) || searchKey(ingredientLabel(c.name, "en")).includes(k)) out.push(c.name);
    if (out.length >= limit) break;
  }
  return out;
}
