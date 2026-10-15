import { CATEGORIES, CUISINES, MATRIX, type Category, type Cuisine, type Dish } from "./schema";

/** Recipes per catalog file: small files keep diffs and generator rewrites cheap. */
export const FILE_SIZE = 100;

/** `turkish/main-2.json`: cells with more than 100 dishes are split, in dish-list order. */
export function catalogFile(cuisine: Cuisine, category: Category, indexInCell: number): string {
  const chunks = Math.ceil(MATRIX[cuisine][category] / FILE_SIZE);
  const n = Math.floor(indexInCell / FILE_SIZE) + 1;
  return `${cuisine}/${category}${chunks > 1 ? `-${n}` : ""}.json`;
}

/** Every catalog file, in a stable order. */
export function allCatalogFiles(): string[] {
  const out: string[] = [];
  for (const c of CUISINES)
    for (const cat of CATEGORIES) {
      const chunks = Math.ceil(MATRIX[c][cat] / FILE_SIZE);
      for (let i = 0; i < chunks; i++) out.push(catalogFile(c, cat, i * FILE_SIZE));
    }
  return out;
}

/** Which file each dish of the dish list belongs in. */
export function fileByDishId(dishes: Dish[]): Map<string, string> {
  const counters = new Map<string, number>();
  const out = new Map<string, string>();
  for (const d of dishes) {
    const cell = `${d.cuisine}/${d.category}`;
    const i = counters.get(cell) ?? 0;
    counters.set(cell, i + 1);
    out.set(d.id, catalogFile(d.cuisine, d.category, i));
  }
  return out;
}
