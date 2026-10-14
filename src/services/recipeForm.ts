import { z } from "zod";
import { aisleSchema, courseSchema, leftoverPolicySchema, prepOffsetSchema, sideSchema, unitSchema, type Recipe } from "@/data/models";
import { catalogEntry, normalizeIngredientName } from "@/data/seed/ingredients";
import type { RecipeInput } from "@/store/app";

/** Editable draft: everything as strings so inputs stay controlled. */
export interface IngredientDraft {
  name: string;
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
          name: i.name,
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
    .refine((v) => Number.isFinite(v) && v >= min && v <= max, `${label} ${min}–${max} arasında bir sayı olsun.`);

const inputSchema = z.object({
  name: z.string().trim().min(1, "Tarifin adını yazar mısın?").max(80, "Ad biraz uzun oldu."),
  course: courseSchema,
  prepMinutes: num("Hazırlık süresi", 0, 1440).pipe(z.number().int("Hazırlık süresi tam dakika olsun.")),
  cookMinutes: num("Pişirme süresi", 0, 1440).pipe(z.number().int("Pişirme süresi tam dakika olsun.")),
  servings: num("Kişi sayısı", 1, 20).pipe(z.number().int("Kişi sayısı tam sayı olsun.")),
  waitMinutes: z.preprocess((v) => (typeof v === "string" && !v.trim() ? "0" : v), num("Bekleme süresi", 0, 1440).pipe(z.number().int("Bekleme süresi tam dakika olsun."))),
});

/** Validate a draft and turn it into store input; returns the first calm error message. */
export function parseDraft(d: RecipeDraft): { ok: true; value: RecipeInput } | { ok: false; error: string } {
  const head = inputSchema.safeParse(d);
  if (!head.success) return { ok: false, error: head.error.issues[0].message };
  const ingredients = [];
  for (const [idx, i] of d.ingredients.entries()) {
    if (!i.name.trim()) {
      if (i.quantity.trim()) return { ok: false, error: `${idx + 1}. malzemenin adı eksik.` };
      continue;
    }
    const name = normalizeIngredientName(i.name);
    const q = i.quantity.trim() ? Number(i.quantity.replace(",", ".")) : null;
    if (q !== null && (!Number.isFinite(q) || q <= 0)) return { ok: false, error: `“${name}” için miktar bir sayı olsun.` };
    const unit = i.unit ? unitSchema.safeParse(i.unit) : null;
    if (unit && !unit.success) return { ok: false, error: `“${name}” için birim tanınmadı.` };
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
    if (!off.success) return { ok: false, error: `“${p.label}” için zaman seçilmedi.` };
    prepItems.push({ label: p.label.trim(), offset: off.data, ...(p.freezer ? { freezer: true } : {}) });
  }
  const steps = d.steps.map((x) => x.trim()).filter(Boolean);
  const freezer = d.freezerItem.trim() ? normalizeIngredientName(d.freezerItem) : null;
  if (freezer && !ingredients.some((i) => i.name === freezer)) {
    return { ok: false, error: "Buzluktan çıkacak malzeme, malzemeler arasında olmalı." };
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
  if (n < 60) return `${n} dk`;
  return n % 60 ? `${Math.floor(n / 60)} sa ${n % 60} dk` : `${n / 60} sa`;
};

/** One line under a closed section's title, so its defaults are visible without opening it. */
export function genelSummary(d: RecipeDraft): string {
  const parts = [`${dk(d.prepMinutes)} hazırlık`, `${dk(d.cookMinutes)} pişirme`];
  if (minutes(d.waitMinutes) > 0) parts.push(`${dk(d.waitMinutes)} bekleme`);
  parts.push(`${d.servings.trim() || "?"} kişilik`);
  const tags = d.tags
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (tags.length) parts.push(tags.slice(0, 2).join(", ") + (tags.length > 2 ? ` +${tags.length - 2}` : ""));
  return parts.join(" · ");
}

export function prepSummary(d: RecipeDraft): string {
  const n = d.prepItems.filter((p) => p.label.trim()).length;
  const parts = [n ? `${n} hatırlatma` : "Yok"];
  if (d.freezerItem.trim()) parts.push(`buzluktan: ${d.freezerItem.trim().toLocaleLowerCase("tr")}`);
  return parts.join(" · ");
}

const POLICY_SHORT = { none: "Artmaz", lunch: "Ertesi gün öğlen yenir", store: "Saklanır" } as const;

export function sourceSummary(d: RecipeDraft): string {
  const policy =
    d.leftoverPolicy === "store" ? `${d.leftoverDays} gün saklanır` : POLICY_SHORT[d.leftoverPolicy];
  return [d.source.trim(), policy].filter(Boolean).join(" · ");
}
