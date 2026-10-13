import { UNITS } from "@/data/models";
import { findDurations } from "@/domain/durations";
import { importedRecipeSchema, type ImportedRecipe } from "@/domain/import/types";
import { filterTags } from "@/domain/import/tags";
import { normalizeUnit } from "@/domain/import/units";

/** Light cleanup before validation: spoken units, zero amounts, stray fields. */
function tidy(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const r = input as Record<string, unknown>;
  const ingredients = Array.isArray(r.ingredients)
    ? (r.ingredients as Record<string, unknown>[]).map((i) => {
        const unit = typeof i.unit === "string" ? ((UNITS as readonly string[]).includes(i.unit) ? i.unit : normalizeUnit(i.unit)) : null;
        const amount = typeof i.amount === "number" && i.amount > 0 ? i.amount : null;
        return { amount, unit: amount === null ? null : unit, item: i.item, side: i.side ?? null, note: typeof i.note === "string" && i.note.trim() ? i.note : null };
      })
    : r.ingredients;
  const steps = Array.isArray(r.steps)
    ? (r.steps as Record<string, unknown>[]).map((s) => ({ text: s.text, minutes: typeof s.minutes === "number" && s.minutes > 0 ? s.minutes : null }))
    : r.steps;
  // Tag fields: only vocabulary values survive (anything else the model invents is dropped).
  const { cookingMethods, mainIngredients, prepTags, ...rest } = r;
  const tags = filterTags([cookingMethods, mainIngredients, prepTags].flatMap((x) => (Array.isArray(x) ? x : [])));
  const minutes = (v: unknown) => (typeof v === "number" && v > 0 ? Math.min(Math.round(v), 24 * 60) : null);
  return {
    ...rest,
    totalMinutes: minutes(r.totalMinutes),
    prepMinutes: minutes(r.prepMinutes),
    cookMinutes: minutes(r.cookMinutes),
    waitMinutes: minutes(r.waitMinutes),
    ingredients,
    steps,
    prep: r.prep ?? [],
    tags,
  };
}

/** Steps whose text lacks the duration the model found get "(20 dk)", so cooking-mode timers see it. */
function withDurations(r: ImportedRecipe): ImportedRecipe {
  return {
    ...r,
    steps: r.steps.map((s) => (s.minutes && !findDurations(s.text).length ? { ...s, text: `${s.text.replace(/\s+$/, "")} (${Math.round(s.minutes)} dk)` } : s)),
  };
}

/** The one validator for every provider's output: tidy → zod → durations into step text. Null when invalid. */
export function validateDraft(raw: unknown): ImportedRecipe | null {
  const parsed = importedRecipeSchema.safeParse(tidy(raw));
  return parsed.success ? withDurations(parsed.data) : null;
}
