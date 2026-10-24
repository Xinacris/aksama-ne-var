import { getLocale, t } from "../i18n";
import { formatNumber, unitAmount } from "./units";
import {
  AISLE_LABEL,
  MARKET_AISLES,
  PAZAR_AISLES,
  type Aisle,
  type Ingredient,
  type PantryItem,
  type Recipe,
  type ShoppingCheck,
  type ShoppingItem,
  type Side,
  type Unit,
} from "../data/models";
import { catalogEntry, type CatalogEntry } from "../data/seed/ingredients";
import { slugify } from "../lib/text";

/** One measured part of a list row in a single base unit. */
export interface Amount {
  amount: number | null;
  unit: string;
}

export interface ListRow {
  key: string;
  /** Stored (Turkish catalog) name: merging, checks and "evde var" use it. */
  name: string;
  /** Shown name in the current language, when it differs. */
  label?: string;
  side: Side;
  aisle: Aisle;
  amounts: Amount[];
  quantityText: string;
  forRecipeIds: string[];
  forLabel: string;
  manualItemId: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
}

// ───────────────────────── units ─────────────────────────

const MASS: Partial<Record<Unit, number>> = { g: 1, kg: 1000 };
const VOLUME: Partial<Record<Unit, number>> = {
  ml: 1,
  l: 1000,
  "su bardağı": 200,
  "çay bardağı": 100,
  "yemek kaşığı": 15,
  "tatlı kaşığı": 10,
  "çay kaşığı": 5,
};

function spoonOrCup(entry: CatalogEntry, unit: Unit): number | null {
  const cup = entry.perCup ?? (entry.base === "ml" ? 200 : null);
  const tbsp = entry.perTbsp ?? (entry.base === "ml" ? 15 : null);
  switch (unit) {
    case "su bardağı":
      return cup;
    case "çay bardağı":
      return cup === null ? null : cup / 2;
    case "yemek kaşığı":
      return tbsp;
    case "tatlı kaşığı":
      return tbsp === null ? null : tbsp * 0.6;
    case "çay kaşığı":
      return tbsp === null ? null : tbsp / 3;
    default:
      return null;
  }
}

/**
 * Convert a recipe measure to the ingredient's base unit.
 * Returns null when the measure can't be expressed in the base unit;
 * the caller keeps it as a separate part ("1 demet + 50 g").
 */
export function toBase(name: string, quantity: number | null, unit: Unit | null): Amount {
  const entry = catalogEntry(name);
  if (quantity === null) return { amount: null, unit: entry?.base ?? unit ?? "" };
  if (!entry) {
    if (unit && MASS[unit]) return { amount: quantity * MASS[unit]!, unit: "g" };
    if (unit && VOLUME[unit]) return { amount: quantity * VOLUME[unit]!, unit: "ml" };
    return { amount: quantity, unit: unit ?? "" };
  }
  const per = (n: number | null | undefined) => (n === null || n === undefined ? null : quantity * n);
  let converted: number | null = null;
  if (unit === null) converted = entry.base === "adet" ? quantity : null;
  else if (entry.pack && unit === entry.pack.unit && !MASS[unit] && unit !== "adet") converted = quantity * entry.pack.size;
  else if (entry.base === "g") {
    if (MASS[unit]) converted = quantity * MASS[unit]!;
    else if (unit === "ml" || unit === "l") converted = quantity * VOLUME[unit]!;
    else if (unit === "adet") converted = per(entry.perPiece);
    else converted = per(spoonOrCup(entry, unit));
  } else if (entry.base === "ml") {
    if (unit === "ml" || unit === "l") converted = quantity * VOLUME[unit]!;
    else if (MASS[unit]) converted = quantity * MASS[unit]!;
    else converted = per(spoonOrCup(entry, unit));
  } else if (entry.base === "adet") {
    if (unit === "adet" || unit === "diş") converted = quantity;
    else if (MASS[unit] && entry.perPiece) converted = (quantity * MASS[unit]!) / entry.perPiece;
  } else if (entry.base === "demet") {
    if (unit === "demet") converted = quantity;
  }
  if (converted === null) return { amount: quantity, unit: unit ?? "" };
  return { amount: converted, unit: entry.base };
}

// ───────────────────────── formatting ─────────────────────────

export { formatNumber } from "./units";

function formatMass(g: number): string {
  return g >= 1000 ? `${formatNumber(g / 1000)} kg` : `${formatNumber(g)} g`;
}
function formatVolume(ml: number): string {
  return ml >= 1000 ? `${formatNumber(ml / 1000)} l` : `${formatNumber(ml)} ml`;
}

/** Human quantity for what to buy, rounded to how it is sold. */
export function formatAmount(name: string, a: Amount): string {
  if (a.amount === null) return "";
  const entry = catalogEntry(name);
  const amt = a.amount;
  if (entry && a.unit === entry.base && entry.pack) {
    const n = Math.max(1, Math.ceil(amt / entry.pack.size - 1e-9));
    if (entry.pack.label) {
      const [num, ...rest] = entry.pack.label.split(" ");
      return unitAmount(n * Number(num.replace(",", ".")), rest.join(" "));
    }
    const total = n * entry.pack.size;
    if (entry.base === "g") return formatMass(total);
    if (entry.base === "ml") return formatVolume(total);
    return unitAmount(total, entry.base);
  }
  switch (a.unit) {
    case "g": {
      const step = entry?.side === "pazar" && amt > 250 ? 500 : 50;
      return formatMass(Math.ceil(amt / step - 1e-9) * step);
    }
    case "ml":
      return formatVolume(Math.ceil(amt / 50 - 1e-9) * 50);
    case "adet":
    case "demet":
      return unitAmount(Math.ceil(amt - 1e-9), a.unit);
    default:
      return unitAmount(Math.round(amt * 100) / 100, a.unit ?? "");
  }
}

export function formatAmounts(name: string, amounts: Amount[]): string {
  return amounts
    .map((a) => formatAmount(name, a))
    .filter(Boolean)
    .join(" + ");
}

/** Recipe-side quantity: "500 g", "1 yemek kaşığı", "3" (pieces show bare numbers as in the design). */
export function formatIngredientQuantity(ing: Pick<Ingredient, "quantity" | "unit">, factor = 1): string {
  if (ing.quantity === null) return "";
  const q = ing.quantity * factor;
  const rounded = ing.unit === "adet" ? Math.round(q * 2) / 2 : Math.round(q * 100) / 100;
  if (!ing.unit || ing.unit === "adet") return formatNumber(rounded);
  return unitAmount(rounded, ing.unit);
}

// ───────────────────────── aggregation ─────────────────────────

function addAmount(list: Amount[], a: Amount) {
  if (a.amount === null) {
    if (list.length === 0) list.push({ amount: null, unit: a.unit });
    return;
  }
  const same = list.find((x) => x.unit === a.unit && x.amount !== null);
  if (same) same.amount = (same.amount ?? 0) + a.amount;
  else {
    const nullIdx = list.findIndex((x) => x.amount === null);
    if (nullIdx !== -1) list.splice(nullIdx, 1);
    list.push({ ...a });
  }
}

export function ingredientKey(name: string): string {
  return `i:${slugify(name)}`;
}

export interface ListInput {
  /** Recipes planned in the list window, once per occurrence, in date order. */
  planned: Recipe[];
  pantry: PantryItem[];
  manualItems: ShoppingItem[];
  checks: ShoppingCheck[];
  recipesById: Map<string, Recipe>;
  /** Household setting: alcoholic ingredients go on the list as their alcohol-free substitute. */
  alcoholFree?: boolean;
}

/** What to buy for an ingredient: the alcohol-free substitute when the household chose so (the recipe still shows both). */
export function ingredientToBuy(ing: Recipe["ingredients"][number], alcoholFree: boolean | undefined): Recipe["ingredients"][number] {
  if (!alcoholFree || !ing.substitute) return ing;
  const s = ing.substitute;
  return { name: s.name, quantity: s.quantity, unit: s.unit, side: s.side, aisle: s.aisle };
}

/** "İzmir köfte · Karnıyarık", capped at three names: "A · B · C +2". */
export function forLabel(ids: string[], recipesById: Map<string, Recipe>): string {
  const names = ids
    .map((id) => recipesById.get(id))
    .filter((r): r is Recipe => !!r)
    .map(recipeLabel);
  if (names.length <= 3) return names.join(" · ");
  return `${names.slice(0, 3).join(" · ")} +${names.length - 3}`;
}

export function recipeLabel(r: Pick<Recipe, "name" | "shortName">): string {
  return r.shortName ?? r.name;
}

/** Name for tight places (board tiles, lunch lines): English names carry a hint in brackets, so the short name fits better there. */
export function tileName(r: Pick<Recipe, "name" | "shortName">): string {
  return getLocale() === "en" && r.shortName ? r.shortName : r.name;
}

/**
 * Build the household shopping list: aggregate every non-staple ingredient
 * of planned recipes by canonical name, subtract "evde var" pantry items,
 * append manual items, and attach check state.
 */
export function generateList(input: ListInput): ListRow[] {
  const rows = new Map<string, ListRow>();
  for (const recipe of input.planned) {
    for (const original of recipe.ingredients) {
      const ing = ingredientToBuy(original, input.alcoholFree);
      if (ing.staple) continue;
      const key = ingredientKey(ing.name);
      let row = rows.get(key);
      if (!row) {
        row = {
          key,
          name: ing.name,
          side: ing.side,
          aisle: ing.aisle,
          amounts: [],
          quantityText: "",
          forRecipeIds: [],
          forLabel: "",
          manualItemId: null,
          checkedBy: null,
          checkedAt: null,
        };
        rows.set(key, row);
      }
      addAmount(row.amounts, toBase(ing.name, ing.quantity, ing.unit));
      if (!row.forRecipeIds.includes(recipe.id)) row.forRecipeIds.push(recipe.id);
    }
  }

  // Subtract pantry ("evde var"). "Az kaldı" is at home but running out: it stays on the list.
  for (const p of input.pantry) {
    if (p.status === "low") continue;
    const row = rows.get(ingredientKey(p.name));
    if (!row) continue;
    if (p.quantity === null) {
      rows.delete(row.key);
      continue;
    }
    const have = toBase(p.name, p.quantity, p.unit);
    const part = row.amounts.find((a) => a.unit === have.unit && a.amount !== null);
    if (part && have.amount !== null) {
      part.amount = (part.amount ?? 0) - have.amount;
      if (part.amount <= 1e-9) row.amounts.splice(row.amounts.indexOf(part), 1);
      if (row.amounts.length === 0) rows.delete(row.key);
    }
  }

  const checksByKey = new Map(input.checks.map((c) => [c.itemKey, c]));
  const out: ListRow[] = [];
  for (const row of rows.values()) {
    row.quantityText = formatAmounts(row.name, row.amounts);
    row.forLabel = forLabel(row.forRecipeIds, input.recipesById);
    out.push(row);
  }
  for (const m of input.manualItems) {
    const forRecipe = m.forRecipeId ? input.recipesById.get(m.forRecipeId) : undefined;
    const amounts = m.quantity === null ? [] : [toBase(m.name, m.quantity, m.unit)];
    out.push({
      key: `m:${m.id}`,
      name: m.name,
      side: m.side,
      aisle: m.aisle,
      amounts,
      quantityText: formatAmounts(m.name, amounts),
      forRecipeIds: forRecipe ? [forRecipe.id] : [],
      forLabel: forRecipe ? recipeLabel(forRecipe) : t("liste.manual"),
      manualItemId: m.id,
      checkedBy: null,
      checkedAt: null,
    });
  }
  for (const row of out) {
    const c = checksByKey.get(row.key);
    if (c) {
      row.checkedBy = c.checkedBy;
      row.checkedAt = c.updatedAt;
    }
  }
  return out;
}

// ───────────────────────── grouping & counts ─────────────────────────

export interface ListGroup {
  aisle: Aisle;
  /** Shown name of the aisle (current language). */
  title: string;
  items: ListRow[];
  left: number;
  note: string;
}

export function groupList(rows: ListRow[], side: Side): ListGroup[] {
  const order: readonly Aisle[] = side === "pazar" ? PAZAR_AISLES : MARKET_AISLES;
  const groups: ListGroup[] = [];
  for (const aisle of order) {
    const items = rows
      .filter((r) => r.side === side && r.aisle === aisle)
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
    if (items.length === 0) continue;
    const left = items.filter((i) => !i.checkedBy).length;
    groups.push({ aisle, title: AISLE_LABEL[aisle], items, left, note: left === 0 ? t("list.groupDone") : t("list.groupLeft", { count: left }) });
  }
  return groups;
}

/** Tab count from the design: "3/8" once something is checked, otherwise "8". */
export function sideCount(rows: ListRow[], side: Side): string {
  const all = rows.filter((r) => r.side === side);
  const got = all.filter((r) => r.checkedBy).length;
  return got ? `${got}/${all.length}` : String(all.length);
}

export function remainingNote(rows: ListRow[]): string {
  const remaining = rows.filter((r) => !r.checkedBy).length;
  if (rows.length === 0) return t("list.empty");
  if (remaining === 0) return t("list.allGot");
  return t("list.remaining", { count: remaining });
}

// ───────────────────────── finishing ─────────────────────────

export interface FinishPlan {
  pantryAdds: { name: string; quantity: number | null; unit: Unit | null }[];
  manualToRemove: string[];
  boughtCount: number;
}

const BASE_TO_UNIT: Record<string, Unit | null> = { g: "g", ml: "ml", adet: "adet", demet: "demet" };

/** "Alışverişi bitir": checked rows move to the pantry; unchecked stay on the list. */
export function planFinish(rows: ListRow[]): FinishPlan {
  const bought = rows.filter((r) => r.checkedBy);
  const pantryAdds: FinishPlan["pantryAdds"] = [];
  for (const r of bought) {
    if (r.manualItemId) continue;
    if (r.amounts.length === 0 || r.amounts.every((a) => a.amount === null)) {
      pantryAdds.push({ name: r.name, quantity: null, unit: null });
      continue;
    }
    for (const a of r.amounts) {
      const unit = BASE_TO_UNIT[a.unit] ?? null;
      pantryAdds.push({ name: r.name, quantity: a.amount !== null && unit ? roundUpBought(r.name, a) : null, unit });
    }
  }
  return {
    pantryAdds,
    manualToRemove: bought.filter((r) => r.manualItemId).map((r) => r.manualItemId!),
    boughtCount: bought.length,
  };
}

/** What was actually bought is the rounded-up pack amount, not the exact need. */
function roundUpBought(name: string, a: Amount): number {
  const entry = catalogEntry(name);
  const amt = a.amount ?? 0;
  if (entry?.pack && a.unit === entry.base) return Math.ceil(amt / entry.pack.size - 1e-9) * entry.pack.size;
  return amt;
}

// ───────────────────────── pantry consumption ─────────────────────────

/** Cooking a recipe uses up measured pantry stock; unmeasured "evde var" stays. */
export function consumePantry(pantry: PantryItem[], recipe: Recipe): { update: PantryItem[]; remove: string[] } {
  const update: PantryItem[] = [];
  const remove: string[] = [];
  const stock = pantry.map((p) => ({ ...p }));
  for (const ing of recipe.ingredients) {
    if (ing.staple || ing.quantity === null) continue;
    const need = toBase(ing.name, ing.quantity, ing.unit);
    if (need.amount === null) continue;
    for (const p of stock) {
      if (p.name !== ing.name || p.quantity === null || remove.includes(p.id)) continue;
      const have = toBase(p.name, p.quantity, p.unit);
      if (have.unit !== need.unit || have.amount === null) continue;
      const left = have.amount - need.amount;
      if (left <= 1e-9) remove.push(p.id);
      else {
        p.quantity = left;
        p.unit = (BASE_TO_UNIT[have.unit] ?? p.unit) as Unit | null;
        update.push(p);
      }
      break;
    }
  }
  return { update: update.filter((u) => !remove.includes(u.id)), remove };
}

/** Status of a recipe ingredient on the detail page. */
export type IngredientStatus = "evde" | "listede" | "eksik";

export function ingredientStatus(
  ing: Ingredient,
  rows: ListRow[],
  pantry: PantryItem[],
): IngredientStatus {
  if (ing.staple) return "evde";
  if (pantry.some((p) => p.name === ing.name)) {
    const row = rows.find((r) => r.key === ingredientKey(ing.name));
    if (!row) return "evde";
  }
  const onList = rows.some((r) => (r.key === ingredientKey(ing.name) || r.name === ing.name) && !r.checkedBy);
  if (onList) return "listede";
  if (rows.some((r) => r.name === ing.name && r.checkedBy)) return "evde";
  return "eksik";
}
