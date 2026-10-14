import { formatDuration } from "../domain/dates";
import { ingredientLabel, localizeRecipe } from "../domain/recipeText";
import type { Locale } from "../i18n";
import { intlTag, t } from "../i18n";
import { z } from "zod";
import { aisleSchema, courseSchema, leftoverPolicySchema, prepOffsetSchema, sideSchema, unitSchema, type Recipe, type RecipeTranslation } from "../data/models";
import { catalogEntry, normalizeIngredientName } from "../data/seed/ingredients";
import type { RecipeInput } from "../store/app";

/** Editable draft: everything as strings so inputs stay controlled. */
export interface IngredientDraft {
  /** As shown in the form (current language). */
  name: string;
  /** Stored name the row came from (catalog id); kept when the shown name is unchanged. */
  key?: string;
  quantity: string;
  unit: string;
  side: "pazar" | "market";
  aisle: string;
  note?: string;
}
export interface PrepDraft {
  label: string;
  offset: string;
  freezer: boolean;
}
export interface RecipeDraft {
  name: string;
  course: string;
  prepMinutes: string;
  cookMinutes: string;
  /** "Bekleme (dk)": marinating, resting, soaking — "" when none. */
  waitMinutes: string;
  servings: string;
  tags: string;
  ingredients: IngredientDraft[];
  prepItems: PrepDraft[];
  steps: string[];
  leftoverPolicy: "none" | "lunch" | "store";
  /** "1"–"4"; used when the policy is `store`. */
  leftoverDays: string;
  freezerItem: string;
  source: string;
  /** Imported/linked recipe credit; not editable in the form, carried through. */
  sourceUrl?: string;
  sourceAuthor?: string;
  sourcePlatform?: Recipe["sourcePlatform"];
  sourceThumbnailUrl?: string;
  /** "Yazılı tarif": the written recipe a video linked to. */
  writtenRecipeUrl?: string;
  /** Import: the caption's language and original text, carried into the saved recipe. */
  sourceLang?: string;
  sourceText?: string;
}

export const emptyIngredient = (): IngredientDraft => ({ name: "", quantity: "", unit: "adet", side: "market", aisle: "Diğer" });

export function emptyDraft(name = ""): RecipeDraft {
  return {
    name,
    course: "ana",
    prepMinutes: "15",
    cookMinutes: "30",
    waitMinutes: "",
    servings: "4",
    tags: "",
    ingredients: [emptyIngredient()],
    prepItems: [],
    steps: [""],
    leftoverPolicy: "none",
    leftoverDays: "2",
    freezerItem: "",
    source: "",
  };
}

export function draftFromRecipe(r: Recipe, copy = false): RecipeDraft {
  return {
    name: copy ? `${r.name} (bizim usul)` : r.name,
    course: r.course,
    prepMinutes: String(r.prepMinutes),
    cookMinutes: String(r.cookMinutes),
    waitMinutes: r.waitMinutes ? String(r.waitMinutes) : "",
    servings: String(r.servings),
    tags: r.tags.join(", "),
    ingredients: r.ingredients.length
      ? r.ingredients.map((i) => ({
          name: i.label ?? i.name,
          ...(i.label && i.label !== i.name ? { key: i.name } : {}),
          quantity: i.quantity === null ? "" : String(i.quantity).replace(".", ","),
          unit: i.unit ?? "",
          side: i.side,
          aisle: i.aisle,
          ...(i.note ? { note: i.note } : {}),
        }))
      : [emptyIngredient()],
    prepItems: r.prepItems.map((p) => ({ label: p.label, offset: p.offset, freezer: !!p.freezer })),
    steps: r.steps.length ? [...r.steps] : [""],
    leftoverPolicy: r.leftoverPolicy,
    leftoverDays: String(r.leftoverDays),
    freezerItem: r.freezerItem ?? "",
    source: r.source ?? "",
    ...(r.sourceUrl ? { sourceUrl: r.sourceUrl } : {}),
    ...(r.sourceAuthor ? { sourceAuthor: r.sourceAuthor } : {}),
    ...(r.sourcePlatform ? { sourcePlatform: r.sourcePlatform } : {}),
    ...(r.sourceThumbnailUrl ? { sourceThumbnailUrl: r.sourceThumbnailUrl } : {}),
    ...(r.writtenRecipeUrl ? { writtenRecipeUrl: r.writtenRecipeUrl } : {}),
  };
}

const num = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v >= min && v <= max, { error: () => t("form.err.range", { label: t(label), min, max }) });

const inputSchema = z.object({
  name: z.string().trim().min(1, { error: () => t("form.err.name") }).max(80, { error: () => t("form.err.nameLong") }),
  course: courseSchema,
  prepMinutes: num("form.label.prep", 0, 1440).pipe(z.number().int({ error: () => t("form.err.prepInt") })),
  cookMinutes: num("form.label.cook", 0, 1440).pipe(z.number().int({ error: () => t("form.err.cookInt") })),
  servings: num("form.label.servings", 1, 20).pipe(z.number().int({ error: () => t("form.err.servingsInt") })),
  waitMinutes: z.preprocess((v) => (typeof v === "string" && !v.trim() ? "0" : v), num("form.label.wait", 0, 1440).pipe(z.number().int({ error: () => t("form.err.waitInt") }))),
});

/** Validate a draft and turn it into store input; returns the first calm error message. */
export function parseDraft(d: RecipeDraft): { ok: true; value: RecipeInput } | { ok: false; error: string } {
  const head = inputSchema.safeParse(d);
  if (!head.success) return { ok: false, error: head.error.issues[0].message };
  const ingredients = [];
  for (const [idx, i] of d.ingredients.entries()) {
    if (!i.name.trim()) {
      if (i.quantity.trim()) return { ok: false, error: t("form.err.ingredientName", { n: idx + 1 }) };
      continue;
    }
    const name = i.key && (i.name.trim() === i.key || i.name.trim() === ingredientLabel(i.key)) ? i.key : normalizeIngredientName(i.name);
    const q = i.quantity.trim() ? Number(i.quantity.replace(",", ".")) : null;
    if (q !== null && (!Number.isFinite(q) || q <= 0)) return { ok: false, error: t("form.err.quantity", { name }) };
    const unit = i.unit ? unitSchema.safeParse(i.unit) : null;
    if (unit && !unit.success) return { ok: false, error: t("form.err.unit", { name }) };
    const entry = catalogEntry(name);
    const side = sideSchema.parse(i.side);
    const aisle = aisleSchema.safeParse(i.aisle).success ? aisleSchema.parse(i.aisle) : side === "pazar" ? "Sebze" : "Diğer";
    ingredients.push({
      name,
      quantity: q,
      unit: unit && unit.success ? unit.data : null,
      side,
      aisle,
      ...(entry?.staple ? { staple: true } : {}),
      ...(i.note?.trim() ? { note: i.note.trim() } : {}),
    });
  }
  const prepItems = [];
  for (const p of d.prepItems) {
    if (!p.label.trim()) continue;
    const off = prepOffsetSchema.safeParse(p.offset);
    if (!off.success) return { ok: false, error: t("form.err.prepWhen", { label: p.label }) };
    prepItems.push({ label: p.label.trim(), offset: off.data, ...(p.freezer ? { freezer: true } : {}) });
  }
  const steps = d.steps.map((x) => x.trim()).filter(Boolean);
  const freezer = d.freezerItem.trim() ? normalizeIngredientName(d.freezerItem) : null;
  if (freezer && !ingredients.some((i) => i.name === freezer)) {
    return { ok: false, error: t("form.err.freezer") };
  }
  const { waitMinutes, ...headRest } = head.data;
  return {
    ok: true,
    value: {
      ...headRest,
      waitMinutes: waitMinutes > 0 ? waitMinutes : undefined,
      tags: d.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => t.charAt(0).toLocaleUpperCase("tr") + t.slice(1)),
      ingredients,
      prepItems,
      steps,
      leftoverPolicy: leftoverPolicySchema.catch("none").parse(d.leftoverPolicy),
      leftoverDays: Math.min(4, Math.max(1, Math.round(Number(d.leftoverDays)) || 2)),
      freezerItem: freezer,
      ...(d.source.trim() ? { source: d.source.trim() } : {}),
      ...(d.sourceUrl ? { sourceUrl: d.sourceUrl } : {}),
      ...(d.sourceAuthor ? { sourceAuthor: d.sourceAuthor } : {}),
      ...(d.sourcePlatform ? { sourcePlatform: d.sourcePlatform } : {}),
      ...(d.sourceThumbnailUrl ? { sourceThumbnailUrl: d.sourceThumbnailUrl } : {}),
      ...(d.writtenRecipeUrl ? { writtenRecipeUrl: d.writtenRecipeUrl } : {}),
      ...(d.sourceLang && /^[a-z]{2,3}$/.test(d.sourceLang) ? { sourceLang: d.sourceLang } : {}),
      ...(d.sourceText ? { sourceText: d.sourceText.slice(0, 20_000) } : {}),
    },
  };
}

// ───────── "Ayrıntılar": the collapsible parts of the form ─────────

export type DetailSection = "genel" | "prep" | "source";

const minutes = (v: string) => Number(v.replace(",", ".")) || 0;

/** Which collapsible sections hold something the user (or an import) filled in. */
export function filledSections(d: RecipeDraft): Record<DetailSection, boolean> {
  return {
    genel:
      minutes(d.prepMinutes) > 0 ||
      minutes(d.cookMinutes) > 0 ||
      minutes(d.waitMinutes) > 0 ||
      !!d.tags.trim(),
    prep: d.prepItems.some((p) => p.label.trim()) || !!d.freezerItem.trim(),
    source: !!d.source.trim() || d.leftoverPolicy !== "none",
  };
}

/** New blank recipes start with every section closed; edits, copies and imports open the ones with values. */
export function initialOpen(d: RecipeDraft, openFilled: boolean): Record<DetailSection, boolean> {
  const f = filledSections(d);
  return { genel: openFilled && f.genel, prep: openFilled && f.prep, source: openFilled && f.source };
}

const dk = (v: string) => {
  const n = minutes(v);
  return formatDuration(n);
};

/** One line under a closed section's title, so its defaults are visible without opening it. */
export function genelSummary(d: RecipeDraft): string {
  const parts = [t("form.summary.prep", { t: dk(d.prepMinutes) }), t("form.summary.cook", { t: dk(d.cookMinutes) })];
  if (minutes(d.waitMinutes) > 0) parts.push(t("form.summary.wait", { t: dk(d.waitMinutes) }));
  parts.push(t("form.summary.servings", { n: d.servings.trim() || "?" }));
  const tags = d.tags
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (tags.length) parts.push(tags.slice(0, 2).join(", ") + (tags.length > 2 ? ` +${tags.length - 2}` : ""));
  return parts.join(" · ");
}

export function prepSummary(d: RecipeDraft): string {
  const n = d.prepItems.filter((p) => p.label.trim()).length;
  const parts = [n ? t("form.summary.reminders", { count: n }) : t("form.summary.none")];
  if (d.freezerItem.trim()) parts.push(t("form.summary.freezer", { item: d.freezerItem.trim().toLocaleLowerCase(intlTag()) }));
  return parts.join(" · ");
}


export function sourceSummary(d: RecipeDraft): string {
  const policy =
    d.leftoverPolicy === "store" ? t("form.summary.policy.store", { count: Number(d.leftoverDays) || 2 }) : t(`form.summary.policy.${d.leftoverPolicy}`);
  return [d.source.trim(), policy].filter(Boolean).join(" · ");
}

// ───────── editing in two languages ─────────

/** What an edit in `locale` changes: the recipe's own text, or its saved translation for `locale`. */
export function editTarget(raw: Recipe, locale: Locale): "source" | "translation" {
  return (raw.lang ?? "tr") === locale || !raw.translations?.[locale] ? "source" : "translation";
}

/** The form's starting draft: the recipe as it reads in `locale` (ingredient rows keep their stored name as `key`). */
export function draftForEdit(raw: Recipe, locale: Locale): RecipeDraft {
  return draftFromRecipe(localizeRecipe(raw, locale));
}

/**
 * Turn the saved form back into a recipe update. Editing the source language
 * replaces the text; editing a translated language writes `translations[locale]`
 * (origin "user") and leaves the source text alone. Times, servings, tags,
 * amounts and leftovers are language-neutral and always update.
 */
export function mergeEdit(raw: Recipe, input: RecipeInput, locale: Locale): RecipeInput {
  const lang = raw.lang ?? "tr";
  if (editTarget(raw, locale) === "source") return { ...input, lang, ...(raw.translations ? { translations: raw.translations } : {}) };
  const prev = raw.translations?.[locale];
  const notes = Object.fromEntries(input.ingredients.filter((i) => i.note).map((i) => [i.name, i.note!]));
  const translation: RecipeTranslation = {
    ...(prev ?? {}),
    name: input.name,
    steps: input.steps,
    prepItems: input.prepItems.map((p) => p.label),
    ...(Object.keys(notes).length ? { notes } : { notes: undefined }),
    origin: "user",
  };
  return {
    ...input,
    name: raw.name,
    steps: raw.steps,
    // Stored prep labels stay in the source language (prep tasks are keyed by them); new ones keep what was typed.
    prepItems: input.prepItems.map((p, i) => ({ ...p, label: raw.prepItems[i]?.label ?? p.label })),
    ingredients: input.ingredients.map((i) => {
      const old = raw.ingredients.find((o) => o.name === i.name);
      const { note: _note, ...rest } = i;
      void _note;
      return old?.note ? { ...rest, note: old.note } : rest;
    }),
    lang,
    translations: { ...raw.translations, [locale]: translation },
  };
}
