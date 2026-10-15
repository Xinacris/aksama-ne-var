/**
 * Validates the recipe catalog: schema, the exact count matrix, duplicate titles/slugs/ids,
 * timers, TR+EN text, pork, alcohol substitutes, known pantry keys, tags.
 *
 *   npm run recipes:validate              # the full catalog must be complete (exit 1 otherwise)
 *   npm run recipes:validate -- --partial # while generating: existing recipes valid, missing ones counted
 */
import { formatReport, validateCatalog } from "../src/recipes/validate";
import { readCatalogFiles, readDishes } from "./catalogIo";

const partial = process.argv.includes("--partial");
const report = validateCatalog({ dishes: readDishes(), files: readCatalogFiles() }, { partial });
console.log(formatReport(report, { partial }));
process.exit(report.ok ? 0 : 1);
