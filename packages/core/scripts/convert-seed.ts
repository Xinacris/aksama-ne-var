/**
 * Converts the app's original 100 built-in recipes (packages/core/src/data/seed) into catalog files.
 * Dishes marked `existing` in dish-list.json; idempotent (rewrites only those recipes, keeps a
 * description the generator already added).
 *
 *   npm run recipes:convert
 */
import { builtinRecipes } from "../src/data/seed/recipes";
import { convertBuiltin } from "../src/recipes/convert";
import { fileByDishId } from "../src/recipes/files";
import type { CatalogRecipe } from "../src/recipes/schema";
import { readCatalogFiles, readDishes, writeCatalogFile } from "./catalogIo";

const dishes = readDishes();
const fileOf = fileByDishId(dishes);
const files = readCatalogFiles() as Record<string, CatalogRecipe[]>;
const bySlug = new Map(dishes.filter((d) => d.existing).map((d) => [d.slug, d]));
let converted = 0;
for (const r of builtinRecipes) {
  const dish = bySlug.get(r.id);
  if (!dish) throw new Error(`built-in "${r.id}" has no existing dish in dish-list.json`);
  const file = fileOf.get(dish.id)!;
  const prev = files[file].find((x) => x.id === dish.id);
  const next = { ...convertBuiltin(r, dish), ...(prev?.description ? { description: prev.description } : {}) };
  files[file] = [...files[file].filter((x) => x.id !== dish.id), next];
  converted++;
}
const missing = [...bySlug.keys()].filter((slug) => !builtinRecipes.some((r) => r.id === slug));
if (missing.length) throw new Error(`existing dishes without a built-in: ${missing.join(", ")}`);
for (const [file, rows] of Object.entries(files)) if (rows.length) writeCatalogFile(file, rows, dishes);
console.log(`converted ${converted} built-ins`);
