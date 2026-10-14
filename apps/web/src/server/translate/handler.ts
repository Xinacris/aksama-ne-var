import { i18n } from "@anv/core/i18n";
import { providersFromEnv, requestLocale, type HandlerDeps } from "@/server/import/handler";
import type { ProviderFallback } from "@/server/llm";
import { translateRecipe, translationRequestSchema } from "@/server/llm/translate";

/** One recipe's text is small; Gemini/Claude answer well within this. */
export const TRANSLATE_TIMEOUT_MS = 25_000;

export type TranslateDeps = Pick<HandlerDeps, "env" | "anthropic" | "geminiFetch" | "fetch" | "limiter">;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/** GET /api/translate → { available }: clients hide "Çevir / Translate" when no provider is configured. */
export function handleTranslateInfo(deps: TranslateDeps): Response {
  return json({ available: providersFromEnv(deps.env, deps).length > 0 });
}

/**
 * POST /api/translate: { householdId?, from, to, recipe: { name, steps, prepItems, notes, ingredients } }
 * → { translation, provider }. Only the recipe text and the language codes reach a provider; the household id
 * is the quota key, like the import's.
 */
export async function handleTranslate(req: Request, deps: TranslateDeps): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: i18n.getFixedT(requestLocale(req))("import.msg.badRequest") }, 400);
  }
  const parsed = translationRequestSchema.safeParse(body);
  const tr = i18n.getFixedT(parsed.success ? parsed.data.to : requestLocale(req));
  if (!parsed.success || parsed.data.from === parsed.data.to) return json({ error: tr("translate.badRequest") }, 400);
  const providers = providersFromEnv(deps.env, deps);
  if (!providers.length) return json({ error: tr("translate.unavailable"), available: false }, 503);
  const quotaKey = parsed.data.householdId || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anon";
  if (!deps.limiter.take(quotaKey)) return json({ error: tr("translate.limited") }, 429);

  const deadline = Date.now() + TRANSLATE_TIMEOUT_MS;
  const signal = AbortSignal.timeout(TRANSLATE_TIMEOUT_MS);
  const fallbacks: ProviderFallback[] = [];
  try {
    const { translation, provider } = await translateRecipe(
      { from: parsed.data.from, to: parsed.data.to, recipe: parsed.data.recipe },
      { providers, signal, deadline, onFailure: (f) => fallbacks.push(f) },
    );
    return json({ translation, provider, fallbacks });
  } catch {
    return json({ error: tr("translate.failed"), fallbacks }, signal.aborted ? 504 : 502);
  }
}
