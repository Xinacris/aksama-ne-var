import { pantryEntry } from "../data/seed/ingredients";
import { fileByDishId } from "./files";
import {
  CATEGORIES,
  CUISINES,
  MATRIX,
  TAG_VOCABULARY,
  catalogRecipeSchema,
  dishSchema,
  normalizeDishName,
  type CatalogRecipe,
  type Category,
  type Cuisine,
  type Dish,
} from "./schema";

/**
 * Everything the catalog must satisfy (the spec's validator), as a pure function so the CLI
 * (scripts/validate-recipes.ts), the generator and a unit test all run the same checks.
 *
 * `partial`: the catalog is still being generated — recipes that exist must be valid and the
 * dish list must match the matrix exactly, but missing recipes are only counted. Without it, the
 * count matrix of the recipes themselves must be exact too.
 */

export interface RecipeProblem {
  slug: string;
  file?: string;
  problems: string[];
}

export interface CellCount {
  cuisine: Cuisine;
  category: Category;
  expected: number;
  dishes: number;
  recipes: number;
}

export interface CatalogReport {
  ok: boolean;
  /** Converted built-ins still waiting for generated fields (description): fine while partial. */
  pendingFill: string[];
  dishErrors: string[];
  recipeErrors: RecipeProblem[];
  cells: CellCount[];
  totals: { expected: number; dishes: number; recipes: number; existing: number };
}

const PORK_WORDS = /(?<!(?:beef|turkey|chicken|veal|dana|hindi|tavuk)\s)\b(pork|bacon|lard|prosciutto|pancetta|guanciale|chorizo|ham|domuz|jambon)\b/i;

function porkIn(text: string): boolean {
  return PORK_WORDS.test(text);
}

/** Problems with one recipe on its own (schema, pantry keys, pork, alcohol, tags). */
export function recipeProblems(raw: unknown): { recipe: CatalogRecipe | null; problems: string[] } {
  const parsed = catalogRecipeSchema.safeParse(raw);
  if (!parsed.success) {
    return { recipe: null, problems: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  const r = parsed.data;
  const problems: string[] = [];
  let hasAlcohol = false;
  for (const [n, ing] of r.ingredients.entries()) {
    const where = `ingredients.${n} (${ing.name.tr})`;
    const entry = pantryEntry(ing.pantryKey);
    if (!entry) problems.push(`${where}: unknown pantryKey "${ing.pantryKey}" (add it to the ingredient catalog)`);
    if (porkIn(`${ing.name.tr} ${ing.name.en}`)) problems.push(`${where}: pork is not allowed`);
    if (entry?.alcohol) {
      hasAlcohol = true;
      if (!ing.substitute) problems.push(`${where}: alcoholic ingredient needs an alcohol-free substitute`);
    }
    if (ing.substitute) {
      const sub = pantryEntry(ing.substitute.pantryKey);
      if (!entry?.alcohol) problems.push(`${where}: only alcoholic ingredients take a substitute`);
      if (!sub) problems.push(`${where}: unknown substitute pantryKey "${ing.substitute.pantryKey}"`);
      if (sub?.alcohol) problems.push(`${where}: the substitute must be alcohol-free`);
    }
  }
  if (hasAlcohol && !r.tags.includes("containsAlcohol")) problems.push(`tags: has an alcoholic ingredient but no "containsAlcohol" tag`);
  if (!hasAlcohol && r.tags.includes("containsAlcohol")) problems.push(`tags: "containsAlcohol" without an alcoholic ingredient`);
  for (const t of r.tags) if (!TAG_VOCABULARY.includes(t)) problems.push(`tags: "${t}" is not in the tag vocabulary`);
  if (new Set(r.tags).size !== r.tags.length) problems.push("tags: duplicates");
  if (r.freezerItem && !r.ingredients.some((i) => i.pantryKey === r.freezerItem)) problems.push(`freezerItem: "${r.freezerItem}" is not one of the ingredients`);
  for (const s of r.steps) if (porkIn(`${s.text.tr} ${s.text.en}`)) problems.push(`steps: mention pork ("${s.text.en.slice(0, 40)}…")`);
  if (porkIn(`${r.title.tr} ${r.title.en}`)) problems.push("title: pork is not allowed");
  return { recipe: r, problems };
}

/** Check the dish list and every catalog file against each other and the matrix. */
export function validateCatalog(input: { dishes: unknown[]; files: Record<string, unknown[]> }, opts: { partial?: boolean } = {}): CatalogReport {
  const dishErrors: string[] = [];
  const dishes: Dish[] = [];
  for (const [n, raw] of input.dishes.entries()) {
    const d = dishSchema.safeParse(raw);
    if (d.success) dishes.push(d.data);
    else dishErrors.push(`dish #${n}: ${d.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  const seen = new Map<string, string>();
  for (const d of dishes) {
    for (const [key, label] of [
      [`id:${d.id}`, "id"],
      [`slug:${d.slug}`, "slug"],
      [`tr:${normalizeDishName(d.title.tr)}`, "Turkish title"],
      [`en:${normalizeDishName(d.title.en)}`, "English title"],
    ] as const) {
      const other = seen.get(key);
      if (other) dishErrors.push(`duplicate ${label}: "${d.title.tr}" and "${other}"`);
      else seen.set(key, d.title.tr);
    }
  }

  const dishById = new Map(dishes.map((d) => [d.id, d]));
  const fileOf = fileByDishId(dishes);
  const recipeErrors: RecipeProblem[] = [];
  const pendingFill: string[] = [];
  const present = new Map<string, CatalogRecipe>();
  const recipeSeen = new Map<string, string>();
  for (const [file, rows] of Object.entries(input.files)) {
    for (const raw of rows) {
      const slug = (raw as { slug?: string })?.slug ?? "(no slug)";
      const { recipe, problems } = recipeProblems(raw);
      if (recipe) {
        const dish = dishById.get(recipe.id);
        if (!dish) problems.push(`id ${recipe.id} is not in dish-list.json`);
        else {
          if (dish.slug !== recipe.slug) problems.push(`slug "${recipe.slug}" ≠ dish list "${dish.slug}"`);
          if (dish.cuisine !== recipe.cuisine || dish.category !== recipe.category)
            problems.push(`${recipe.cuisine}/${recipe.category} ≠ dish list ${dish.cuisine}/${dish.category}`);
          if (fileOf.get(dish.id) !== file) problems.push(`belongs in ${fileOf.get(dish.id)}, found in ${file}`);
          if (!recipe.description) {
            if (dish.existing && opts.partial) pendingFill.push(recipe.slug);
            else problems.push("description: missing (TR + EN)");
          }
        }
        for (const key of [`id:${recipe.id}`, `slug:${recipe.slug}`, `title:${normalizeDishName(recipe.title.tr)}`]) {
          const other = recipeSeen.get(key);
          if (other) problems.push(`duplicate ${key.split(":")[0]} (also ${other})`);
          else recipeSeen.set(key, `${file}:${recipe.slug}`);
        }
        if (!problems.length) present.set(recipe.id, recipe);
      }
      if (problems.length) recipeErrors.push({ slug, file, problems });
    }
  }

  const cells: CellCount[] = [];
  for (const cuisine of CUISINES)
    for (const category of CATEGORIES) {
      const expected = MATRIX[cuisine][category];
      const inCell = (x: { cuisine: string; category: string }) => x.cuisine === cuisine && x.category === category;
      const nDishes = dishes.filter(inCell).length;
      const nRecipes = [...present.values()].filter(inCell).length;
      cells.push({ cuisine, category, expected, dishes: nDishes, recipes: nRecipes });
      if (nDishes !== expected) dishErrors.push(`dish list ${cuisine}/${category}: ${nDishes}, expected ${expected}`);
    }
  const totals = {
    expected: cells.reduce((a, c) => a + c.expected, 0),
    dishes: dishes.length,
    recipes: present.size,
    existing: dishes.filter((d) => d.existing && present.has(d.id)).length,
  };
  const matrixOk = opts.partial || cells.every((c) => c.recipes === c.expected);
  return { ok: !dishErrors.length && !recipeErrors.length && matrixOk, pendingFill, dishErrors, recipeErrors, cells, totals };
}

/** A readable report: the matrix (expected / dish list / recipes) and every failing recipe. */
export function formatReport(r: CatalogReport, opts: { partial?: boolean } = {}): string {
  const lines: string[] = [];
  lines.push(`Recipes: ${r.totals.recipes} / ${r.totals.expected} (dish list ${r.totals.dishes}, of which ${r.totals.existing} converted built-ins present)`);
  lines.push("");
  lines.push("cuisine     category   expected  dishes  recipes");
  for (const c of r.cells) {
    if (!c.expected && !c.dishes && !c.recipes) continue;
    const flag = c.dishes !== c.expected ? "  ← dish list off" : !opts.partial && c.recipes !== c.expected ? `  ← ${c.recipes - c.expected}` : "";
    lines.push(`${c.cuisine.padEnd(11)} ${c.category.padEnd(9)} ${String(c.expected).padStart(8)}  ${String(c.dishes).padStart(6)}  ${String(c.recipes).padStart(7)}${flag}`);
  }
  if (r.pendingFill.length) lines.push("", `Converted built-ins waiting for a description (generate-recipes --fill): ${r.pendingFill.length}`);
  if (r.dishErrors.length) {
    lines.push("", "Dish list problems:");
    for (const e of r.dishErrors) lines.push(`  - ${e}`);
  }
  if (r.recipeErrors.length) {
    lines.push("", `Failing recipes (${r.recipeErrors.length}):`);
    for (const e of r.recipeErrors) lines.push(`  ${e.file ?? ""} ${e.slug}`, ...e.problems.map((p) => `      ${p}`));
  }
  lines.push("", r.ok ? "OK" : "FAILED");
  return lines.join("\n");
}
