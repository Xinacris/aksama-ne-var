import { runImport, type Structurer } from "@anv/core/domain/import/pipeline";
import { importRequestSchema } from "@anv/core/domain/import/types";
import { claudeProvider, type MessagesClient } from "@/server/llm/claude";
import { geminiProvider, type GeminiFetch } from "@/server/llm/gemini";
import { structureRecipe, type LlmProvider, type ProviderFallback } from "@/server/llm";
import { DailyLimiter } from "./rateLimit";
import { detectLocale, i18n } from "@anv/core/i18n";

/**
 * Whole request: platform fetch, an optional written-recipe page, the LLM chain. Gemini 3.1
 * Flash-Lite took 5–10 s for a short caption in production, so 15 s was too tight.
 */
export const IMPORT_TIMEOUT_MS = 25_000;

export interface ImportEnv {
  /** `anthropic` | `gemini` | `none`; unset (or anything else) = every configured provider, Gemini → Claude. */
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  YOUTUBE_API_KEY?: string;
}

export interface HandlerDeps {
  /** Platform endpoints (oEmbed, YouTube API) — public, fixed hosts. */
  fetch: typeof fetch;
  /** User-supplied web links go through the private-network guard. */
  webFetch: typeof fetch;
  env: ImportEnv;
  /** Builds the Claude client; only called when ANTHROPIC_API_KEY is set. */
  anthropic: (apiKey: string) => MessagesClient;
  /** HTTP for the Gemini REST API; defaults to `fetch`. */
  geminiFetch?: GeminiFetch;
  limiter: DailyLimiter;
}

export type AiProvider = "anthropic" | "gemini" | "none";

/** `AI_PROVIDER`, or null when unset or not one of the three (then the default chain). */
export function aiProvider(env: Pick<ImportEnv, "AI_PROVIDER">): AiProvider | null {
  const v = env.AI_PROVIDER?.trim().toLowerCase();
  if (!v) return null;
  if (v === "anthropic" || v === "gemini" || v === "none") return v;
  console.warn(`[import] AI_PROVIDER="${env.AI_PROVIDER}" is not anthropic, gemini or none; using every configured provider`);
  return null;
}

/**
 * LLM providers in order of preference; the rule parser always comes last.
 * `AI_PROVIDER=anthropic` → only Claude, `gemini` → only Gemini, `none` → rules only.
 * Unset → every configured one, Gemini (free tier) → Claude (today's production setup).
 * A chosen provider without its key gives rules, with a warning.
 */
export function providersFromEnv(env: ImportEnv, deps: Pick<HandlerDeps, "anthropic" | "geminiFetch" | "fetch">): LlmProvider[] {
  const choice = aiProvider(env);
  if (choice === "none") return [];
  const gemini = () => geminiProvider({ apiKey: env.GEMINI_API_KEY!, model: env.GEMINI_MODEL, fetch: deps.geminiFetch ?? deps.fetch });
  const claude = () => claudeProvider(deps.anthropic(env.ANTHROPIC_API_KEY!));
  if (choice === "anthropic") {
    if (env.ANTHROPIC_API_KEY) return [claude()];
    console.warn("[import] AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set; using the rule parser");
    return [];
  }
  if (choice === "gemini") {
    if (env.GEMINI_API_KEY) return [gemini()];
    console.warn("[import] AI_PROVIDER=gemini but GEMINI_API_KEY is not set; using the rule parser");
    return [];
  }
  const out: LlmProvider[] = [];
  if (env.GEMINI_API_KEY) out.push(gemini());
  if (env.ANTHROPIC_API_KEY) out.push(claude());
  return out;
}

/** Language for messages when the body has none: the client's Accept-Language (tr → Turkish, else English), else Turkish. */
export function requestLocale(req: Request): "tr" | "en" {
  const h = req.headers.get("accept-language");
  return h ? detectLocale(h.split(",").map((x) => x.split(";")[0].trim())) : "tr";
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/** POST /api/import: { url?, text?, householdId? } → ImportResult + { counted, llmAvailable }. */
export async function handleImport(req: Request, deps: HandlerDeps): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: i18n.getFixedT(requestLocale(req))("import.msg.badRequest") }, 400);
  }
  const parsed = importRequestSchema.safeParse(body);
  const tr = i18n.getFixedT(parsed.success ? parsed.data.locale : requestLocale(req));
  if (!parsed.success) return jsonResponse({ error: tr("import.msg.tooLong") }, 400);
  const { url, text, householdId, locale } = parsed.data;
  if (!url.trim() && !text.trim()) return jsonResponse({ error: tr("import.msg.needInput") }, 400);

  const deadline = Date.now() + IMPORT_TIMEOUT_MS;
  const signal = AbortSignal.timeout(IMPORT_TIMEOUT_MS);
  const providers = providersFromEnv(deps.env, deps);
  // The household id is only the quota key; it never reaches a provider.
  const quotaKey = householdId || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anon";
  let limited = false;
  const fallbacks: ProviderFallback[] = [];
  const structure: Structurer | undefined = providers.length
    ? async (t, meta) => {
        const allowed = deps.limiter.take(quotaKey);
        if (!allowed) limited = true;
        return structureRecipe(t, { ...meta, locale }, { providers: allowed ? providers : [], signal, deadline, onFailure: (f) => fallbacks.push(f) });
      }
    : undefined;

  // Platform adapters use plain fetch; the web adapter's arbitrary hosts use the guarded one.
  const routedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input);
    const platformHost = /^https:\/\/(www\.tiktok\.com\/oembed|www\.youtube\.com\/oembed|www\.googleapis\.com\/youtube\/)/.test(u);
    return (platformHost ? deps.fetch : deps.webFetch)(input, init);
  }) as typeof fetch;

  try {
    const { result, counted } = await runImport({ url, text }, { fetch: routedFetch, env: { YOUTUBE_API_KEY: deps.env.YOUTUBE_API_KEY }, signal, structure, t: tr });
    const message = limited && !result.message ? tr("import.msg.limited") : result.message;
    // `fallbacks`: which providers gave up and why (status codes only) — the same facts as the log line.
    return jsonResponse({ ...result, message, counted, llmAvailable: providers.length > 0, fallbacks });
  } catch (e) {
    console.warn("[import] failed:", e instanceof Error ? e.name : "unknown");
    const timedOut = signal.aborted;
    return jsonResponse(
      { error: timedOut ? tr("import.msg.slow") : tr("import.msg.failed") },
      timedOut ? 504 : 502,
    );
  }
}
