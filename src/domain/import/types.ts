import { z } from "zod";
import { sourcePlatformSchema, unitSchema, type SourcePlatform } from "@/data/models";

/**
 * What a source adapter returns: whatever public text the platform gives us
 * for a link. `text` is the caption/description; `recipe` is set when the
 * source already carries structured data (schema.org/Recipe).
 */
export interface ImportSource {
  platform: SourcePlatform;
  url: string;
  title: string | null;
  text: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  /** The platform gives no caption (Instagram): the user pastes it. */
  needsPaste: boolean;
  recipe?: ImportedRecipe | null;
}

export const IMPORT_ROLES = ["corba", "ana", "yaninda", "salata"] as const;

/**
 * Structured recipe draft shared by the rule parser, the schema.org reader
 * and the LLM tool output. Item names are free text here; `toRecipeDraft`
 * maps them onto the ingredient catalog for the form.
 */
export const importedIngredientSchema = z.object({
  amount: z.number().positive().nullable(),
  unit: unitSchema.nullable(),
  item: z.string().trim().min(1).max(80),
  side: z.enum(["pazar", "market"]).nullable(),
  note: z.string().max(80).nullable().optional(),
});
export type ImportedIngredient = z.infer<typeof importedIngredientSchema>;

export const importedStepSchema = z.object({
  text: z.string().trim().min(1).max(600),
  minutes: z.number().positive().max(24 * 60).nullable(),
});
export type ImportedStep = z.infer<typeof importedStepSchema>;

export const importedPrepSchema = z.object({
  label: z.string().trim().min(1).max(120),
  when: z.enum(["night-before", "morning", "hour-before"]),
});
export type ImportedPrep = z.infer<typeof importedPrepSchema>;

export const importedRecipeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  servings: z.number().int().min(1).max(20).nullable(),
  role: z.enum(IMPORT_ROLES).nullable(),
  totalMinutes: z.number().int().min(1).max(24 * 60).nullable(),
  ingredients: z.array(importedIngredientSchema).max(60),
  steps: z.array(importedStepSchema).max(40),
  prep: z.array(importedPrepSchema).max(10),
});
export type ImportedRecipe = z.infer<typeof importedRecipeSchema>;

export type ImportPath = "llm" | "rules";
/** Which provider produced the draft (see `src/server/llm`). */
export const IMPORT_PROVIDERS = ["gemini", "claude", "rules"] as const;
export type ImportProvider = (typeof IMPORT_PROVIDERS)[number];

/** Response of POST /api/import. */
export interface ImportResult {
  /** Null when only text was pasted (no link). */
  source: (Omit<ImportSource, "recipe" | "text"> & { hasText: boolean }) | null;
  draft: ImportedRecipe | null;
  /** "llm" when an LLM provider answered, else "rules" (the UI's wording depends on it). */
  path: ImportPath | null;
  provider: ImportProvider | null;
  /** Calm Turkish note for the UI ("Instagram açıklamayı paylaşmıyor…"). */
  message: string | null;
  /** Fetched text had no ingredient-like lines: open the paste box. */
  needsPaste: boolean;
}

export const importRequestSchema = z.object({
  url: z.string().trim().max(2048).optional().default(""),
  text: z.string().max(20_000).optional().default(""),
  householdId: z.string().max(100).optional().default(""),
});

export { sourcePlatformSchema };
