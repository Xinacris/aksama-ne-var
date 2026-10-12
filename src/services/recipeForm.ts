import { z } from "zod";
import { aisleSchema, courseSchema, prepOffsetSchema, sideSchema, unitSchema, type Recipe } from "@/data/models";
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
  servings: string;
  tags: string;
  ingredients: IngredientDraft[];
  prepItems: PrepDraft[];
  steps: string[];
  leftoverFriendly: boolean;
  freezerItem: string;
  source: string;
}

export const emptyIngredient = (): IngredientDraft => ({ name: "", quantity: "", unit: "adet", side: "market", aisle: "Diğer" });

export function emptyDraft(name = ""): RecipeDraft {
  return {
    name,
    course: "ana",
    prepMinutes: "15",
    cookMinutes: "30",
    servings: "4",
    tags: "",
    ingredients: [emptyIngredient()],
    prepItems: [],
    steps: [""],
    leftoverFriendly: false,
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
    leftoverFriendly: r.leftoverFriendly,
    freezerItem: r.freezerItem ?? "",
    source: r.source ?? "",
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
  return {
    ok: true,
    value: {
      ...head.data,
      tags: d.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => t.charAt(0).toLocaleUpperCase("tr") + t.slice(1)),
      ingredients,
      prepItems,
      steps,
      leftoverFriendly: d.leftoverFriendly,
      freezerItem: freezer,
      ...(d.source.trim() ? { source: d.source.trim() } : {}),
    },
  };
}
