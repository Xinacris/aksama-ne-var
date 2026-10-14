import { z } from "zod";
import { PROVIDER_TIMEOUT_MS } from "./index";
import { ProviderError, type LlmProvider, type LlmTask, type ProviderFallback } from "./types";

/**
 * Recipe translation ("Çevir / Translate"). Only recipe text and the two
 * language codes go to a provider — never names, emails, household or user
 * data. Same provider order, retry and fall-through as the import.
 */

const LANG_NAME = { tr: "Turkish", en: "English" } as const;
export type Lang = keyof typeof LANG_NAME;

export const translationRequestSchema = z.object({
  householdId: z.string().max(100).optional().default(""),
  from: z.enum(["tr", "en"]),
  to: z.enum(["tr", "en"]),
  recipe: z.object({
    name: z.string().trim().min(1).max(120),
    steps: z.array(z.string().max(1200)).max(40),
    prepItems: z.array(z.string().max(200)).max(10).default([]),
    /** Ingredient notes ("rendelenmiş"), keyed by the ingredient's stored name. */
    notes: z.record(z.string().max(80), z.string().max(160)).default({}),
    /** Ingredient names that are not in the shared catalog (the catalog has its own translations). */
    ingredients: z.array(z.string().max(80)).max(60).default([]),
  }),
});
export type TranslationRequest = z.infer<typeof translationRequestSchema>;
export type TranslationPayload = TranslationRequest["recipe"];

export interface TranslationResult {
  name: string;
  steps: string[];
  prepItems: string[];
  notes: Record<string, string>;
  ingredients: Record<string, string>;
}

const str = { type: "string" };
export const TRANSLATION_JSON_SCHEMA = {
  type: "object",
  required: ["name", "steps", "prepItems", "notes", "ingredients"],
  properties: {
    name: str,
    steps: { type: "array", items: str },
    prepItems: { type: "array", items: str },
    notes: { type: "array", items: { type: "object", required: ["key", "text"], properties: { key: str, text: str } } },
    ingredients: { type: "array", items: { type: "object", required: ["key", "text"], properties: { key: str, text: str } } },
  },
};

export function translationSystemPrompt(from: Lang, to: Lang): string {
  return `You translate home-cooking recipes from ${LANG_NAME[from]} to ${LANG_NAME[to]}.
Rules:
- Translate naturally for a home cook; keep it short and warm, not literal. Keep every step as one step, in order; translate prep-ahead labels as short imperatives.
- Keep quantities, temperatures and times exactly as written. A "su bardağı" is a 200 ml cup, a "yemek kaşığı" a tablespoon, a "tatlı kaşığı" a dessert spoon, a "çay kaşığı" a teaspoon.
- Well-known Turkish dish names stay in Turkish in English, with a short English hint in brackets: "Karnıyarık (stuffed aubergine)". Into Turkish, use the usual Turkish name.
- "notes" and "ingredients": return one item per input key with the same "key" and the translated "text".
- Do not add steps, ingredients, nutrition or comments. Return only the JSON.`;
}

export function translationTask(req: { from: Lang; to: Lang; recipe: TranslationPayload }, retry: boolean): LlmTask {
  const payload = {
    name: req.recipe.name,
    steps: req.recipe.steps,
    prepItems: req.recipe.prepItems,
    notes: Object.entries(req.recipe.notes).map(([key, text]) => ({ key, text })),
    ingredients: req.recipe.ingredients.map((key) => ({ key, text: key })),
  };
  return {
    system: translationSystemPrompt(req.from, req.to),
    user: `Recipe (${req.from} → ${req.to}):\n${JSON.stringify(payload)}${retry ? "\n\nThe previous answer did not match the schema. Return only valid JSON with the same number of steps and prepItems." : ""}`,
    schema: TRANSLATION_JSON_SCHEMA,
    tool: { name: "recipe_translation", description: "Saves the translated recipe text." },
  };
}

const pairList = z.array(z.object({ key: z.string(), text: z.string().trim().min(1).max(200) }));
const answerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  steps: z.array(z.string().trim().min(1).max(1500)),
  prepItems: z.array(z.string().trim().min(1).max(200)),
  notes: pairList.default([]),
  ingredients: pairList.default([]),
});

/** The answer must line up with the request: same number of steps and prep labels, only known keys. */
export function validateTranslation(raw: unknown, req: TranslationPayload): TranslationResult | null {
  const p = answerSchema.safeParse(raw);
  if (!p.success) return null;
  const a = p.data;
  if (a.steps.length !== req.steps.length || a.prepItems.length !== req.prepItems.length) return null;
  const pick = (pairs: { key: string; text: string }[], keys: string[]) =>
    Object.fromEntries(pairs.filter((x) => keys.includes(x.key)).map((x) => [x.key, x.text]));
  return {
    name: a.name,
    steps: a.steps,
    prepItems: a.prepItems,
    notes: pick(a.notes, Object.keys(req.notes)),
    ingredients: pick(a.ingredients, req.ingredients),
  };
}

export interface TranslateOptions {
  providers: LlmProvider[];
  signal?: AbortSignal;
  deadline?: number;
  onFailure?: (f: ProviderFallback) => void;
}

/** Tries each provider (Gemini → Claude); invalid output gets one retry. Throws when none answers. */
export async function translateRecipe(req: { from: Lang; to: Lang; recipe: TranslationPayload }, opts: TranslateOptions): Promise<{ translation: TranslationResult; provider: LlmProvider["name"] }> {
  const usable = opts.providers.filter((p) => p.run);
  for (const [i, p] of usable.entries()) {
    if (opts.signal?.aborted) break;
    const isLast = i === usable.length - 1;
    try {
      for (let retry = 0; retry < 2; retry++) {
        const budget = isLast && opts.deadline ? Math.max(1_000, opts.deadline - Date.now() - 300) : PROVIDER_TIMEOUT_MS;
        const signal = AbortSignal.any([AbortSignal.timeout(budget), ...(opts.signal ? [opts.signal] : [])]);
        let raw: unknown;
        try {
          raw = await p.run!(translationTask(req, retry > 0), { signal });
        } catch (e) {
          if (e instanceof ProviderError && e.kind !== "invalid") throw e;
          if (signal.aborted) throw new ProviderError("timeout");
          if (!(e instanceof ProviderError)) throw new ProviderError("error");
          continue;
        }
        const out = validateTranslation(raw, req.recipe);
        if (out) return { translation: out, provider: p.name };
      }
      throw new ProviderError("invalid", undefined, "SCHEMA");
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError("error");
      const fb: ProviderFallback = { provider: p.name, kind: err.kind, ...(err.status ? { status: err.status } : {}), ...(err.reason ? { reason: err.reason } : {}) };
      console.warn(`[translate] ${p.name} gave up (${fb.kind}${fb.status ? ` ${fb.status}` : ""}${fb.reason ? ` ${fb.reason}` : ""})`);
      opts.onFailure?.(fb);
    }
  }
  throw new ProviderError("error", undefined, "NO_PROVIDER");
}
