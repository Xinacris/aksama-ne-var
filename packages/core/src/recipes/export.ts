import { INGREDIENT_CATALOG } from "../data/seed/ingredients";
import type { CatalogRecipe } from "./schema";

/**
 * The catalog as Supabase seed rows (next round): one table per concern, flat, no computed
 * columns. `toSql` writes CREATE TABLE IF NOT EXISTS + INSERTs (idempotent with ON CONFLICT DO
 * NOTHING); `toCsv` the same rows for the dashboard's CSV import. Nothing here talks to Supabase.
 */

type Row = Record<string, string | number | boolean | null>;

export interface SeedTables {
  pantry_items: Row[];
  recipes: Row[];
  recipe_ingredients: Row[];
  recipe_steps: Row[];
  recipe_tags: Row[];
  recipe_prep: Row[];
}

export function seedTables(recipes: CatalogRecipe[]): SeedTables {
  const t: SeedTables = { pantry_items: [], recipes: [], recipe_ingredients: [], recipe_steps: [], recipe_tags: [], recipe_prep: [] };
  for (const c of INGREDIENT_CATALOG)
    t.pantry_items.push({ key: c.key, name_tr: c.name, name_en: c.en ?? null, side: c.side, aisle: c.aisle, base_unit: c.base, staple: c.staple ?? false, alcohol: c.alcohol ?? false });
  for (const r of recipes) {
    t.recipes.push({
      id: r.id,
      slug: r.slug,
      cuisine: r.cuisine,
      category: r.category,
      region: r.region ?? null,
      title_tr: r.title.tr,
      title_en: r.title.en,
      short_title_tr: r.shortTitle?.tr ?? null,
      short_title_en: r.shortTitle?.en ?? null,
      description_tr: r.description?.tr ?? null,
      description_en: r.description?.en ?? null,
      servings: r.servings,
      prep_minutes: r.prepMinutes,
      cook_minutes: r.cookMinutes,
      wait_minutes: r.waitMinutes ?? null,
      time_note_tr: r.timeNote?.tr ?? null,
      time_note_en: r.timeNote?.en ?? null,
      difficulty: r.difficulty,
      meal_slots: r.mealSlots.join(","),
      leftover_likelihood: r.leftover.likelihood,
      leftover_keeps_days: r.leftover.keepsDays,
      leftover_reheatable: r.leftover.reheatable,
      freezer_item: r.freezerItem ?? null,
      source: r.source,
      version: r.version,
    });
    r.ingredients.forEach((i, n) =>
      t.recipe_ingredients.push({
        recipe_id: r.id,
        position: n + 1,
        pantry_key: i.pantryKey,
        name_tr: i.name.tr,
        name_en: i.name.en,
        amount: i.amount ?? null,
        unit: i.unit ?? null,
        note_tr: i.note?.tr ?? null,
        note_en: i.note?.en ?? null,
        substitute_pantry_key: i.substitute?.pantryKey ?? null,
        substitute_name_tr: i.substitute?.name.tr ?? null,
        substitute_name_en: i.substitute?.name.en ?? null,
        substitute_amount: i.substitute?.amount ?? null,
        substitute_unit: i.substitute?.unit ?? null,
        substitute_note_tr: i.substitute?.note.tr ?? null,
        substitute_note_en: i.substitute?.note.en ?? null,
        substitute_reason: i.substitute?.reason ?? null,
      }),
    );
    r.steps.forEach((s, n) => t.recipe_steps.push({ recipe_id: r.id, position: n + 1, text_tr: s.text.tr, text_en: s.text.en, timer_seconds: s.timerSeconds ?? null }));
    for (const tag of r.tags) t.recipe_tags.push({ recipe_id: r.id, tag });
    (r.prepAhead ?? []).forEach((p, n) => t.recipe_prep.push({ recipe_id: r.id, position: n + 1, text_tr: p.text.tr, text_en: p.text.en, prep_when: p.when, freezer: p.freezer ?? false }));
  }
  return t;
}

const DDL: Record<keyof SeedTables, string> = {
  pantry_items: `create table if not exists pantry_items (key text primary key, name_tr text not null, name_en text, side text not null check (side in ('pazar','market')), aisle text not null, base_unit text not null, staple boolean not null default false, alcohol boolean not null default false);`,
  recipes: `create table if not exists recipes (id uuid primary key, slug text not null unique, cuisine text not null, category text not null check (category in ('main','soup','salad','side','dessert')), region text, title_tr text not null, title_en text not null, short_title_tr text, short_title_en text, description_tr text, description_en text, servings int not null, prep_minutes int not null, cook_minutes int not null, wait_minutes int, time_note_tr text, time_note_en text, difficulty smallint not null check (difficulty between 1 and 3), meal_slots text not null, leftover_likelihood text not null, leftover_keeps_days smallint not null, leftover_reheatable boolean not null, freezer_item text references pantry_items(key), source text not null, version int not null);`,
  recipe_ingredients: `create table if not exists recipe_ingredients (recipe_id uuid not null references recipes(id) on delete cascade, position int not null, pantry_key text not null references pantry_items(key), name_tr text not null, name_en text not null, amount numeric, unit text, note_tr text, note_en text, substitute_pantry_key text references pantry_items(key), substitute_name_tr text, substitute_name_en text, substitute_amount numeric, substitute_unit text, substitute_note_tr text, substitute_note_en text, substitute_reason text check (substitute_reason in ('alcoholFree')), primary key (recipe_id, position));`,
  recipe_steps: `create table if not exists recipe_steps (recipe_id uuid not null references recipes(id) on delete cascade, position int not null, text_tr text not null, text_en text not null, timer_seconds int check (timer_seconds > 0), primary key (recipe_id, position));`,
  recipe_tags: `create table if not exists recipe_tags (recipe_id uuid not null references recipes(id) on delete cascade, tag text not null, primary key (recipe_id, tag));`,
  recipe_prep: `create table if not exists recipe_prep (recipe_id uuid not null references recipes(id) on delete cascade, position int not null, text_tr text not null, text_en text not null, prep_when text not null, freezer boolean not null default false, primary key (recipe_id, position));`,
};

const ORDER: (keyof SeedTables)[] = ["pantry_items", "recipes", "recipe_ingredients", "recipe_steps", "recipe_tags", "recipe_prep"];

function sqlValue(v: Row[string]): string {
  if (v === null) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}

export function toSql(t: SeedTables): string {
  const out = ["-- Akşama ne var? recipe catalog seed (generated by scripts/export-supabase-seed.ts; do not edit)", "begin;"];
  for (const name of ORDER) out.push(DDL[name]);
  for (const name of ORDER) {
    const rows = t[name];
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      out.push(`insert into ${name} (${cols.join(", ")}) values\n${chunk.map((r) => `(${cols.map((c) => sqlValue(r[c])).join(", ")})`).join(",\n")}\non conflict do nothing;`);
    }
  }
  out.push("commit;");
  return `${out.join("\n\n")}\n`;
}

function csvValue(v: Row[string]): string {
  if (v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  return `${[cols.join(","), ...rows.map((r) => cols.map((c) => csvValue(r[c])).join(","))].join("\n")}\n`;
}
