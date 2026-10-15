/**
 * Writes the catalog as a Supabase seed: data/recipes/export/seed.sql (tables + inserts) and one
 * CSV per table. Does not connect to Supabase (the next round runs it).
 *
 *   npm run recipes:export
 */
import fs from "node:fs";
import path from "node:path";
import { seedTables, toCsv, toSql } from "../src/recipes/export";
import type { CatalogRecipe } from "../src/recipes/schema";
import { DATA_DIR, readCatalogFiles } from "./catalogIo";

const recipes = Object.values(readCatalogFiles()).flat() as CatalogRecipe[];
const tables = seedTables(recipes);
const dir = path.join(DATA_DIR, "export");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "seed.sql"), toSql(tables));
for (const [name, rows] of Object.entries(tables)) fs.writeFileSync(path.join(dir, `${name}.csv`), toCsv(rows));
console.log(`${recipes.length} recipes → ${path.relative(process.cwd(), dir)}/ (${Object.entries(tables).map(([n, r]) => `${n} ${r.length}`).join(", ")})`);
