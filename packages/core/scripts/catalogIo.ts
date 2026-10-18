import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allCatalogFiles } from "../src/recipes/files";
import type { CatalogRecipe, Dish } from "../src/recipes/schema";

/** Reading and writing the catalog files from the scripts (the app imports them through data/recipes/index.ts). */
export const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "recipes");

export function readDishes(): Dish[] {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, "dish-list.json"), "utf8")) as Dish[];
}

export function readCatalogFiles(): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const f of allCatalogFiles()) {
    const p = path.join(DATA_DIR, f);
    out[f] = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as unknown[]) : [];
  }
  return out;
}

/** Writes a file's recipes in dish-list order, one recipe per line block (readable diffs). */
export function writeCatalogFile(file: string, recipes: CatalogRecipe[], dishes: Dish[]): void {
  const order = new Map(dishes.map((d, i) => [d.id, i]));
  const sorted = [...recipes].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  fs.mkdirSync(path.dirname(path.join(DATA_DIR, file)), { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, file), `${JSON.stringify(sorted, null, 1)}\n`);
}

export function readJson<T>(file: string, fallback: T): T {
  const p = path.join(DATA_DIR, file);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as T) : fallback;
}

export function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(path.join(DATA_DIR, file), `${JSON.stringify(value, null, 1)}\n`);
}
