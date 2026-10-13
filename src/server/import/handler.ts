import { runImport, type Structurer } from "@/domain/import/pipeline";
import { importRequestSchema } from "@/domain/import/types";
import { claudeProvider, type MessagesClient } from "@/server/llm/claude";
import { geminiProvider, type GeminiFetch } from "@/server/llm/gemini";
import { structureRecipe, type LlmProvider } from "@/server/llm";
import { DailyLimiter } from "./rateLimit";

export const IMPORT_TIMEOUT_MS = 15_000;

export interface ImportEnv {
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

/** Configured LLM providers in order of preference: Gemini (free tier) → Claude. Rules always come last. */
export function providersFromEnv(env: ImportEnv, deps: Pick<HandlerDeps, "anthropic" | "geminiFetch" | "fetch">): LlmProvider[] {
  const out: LlmProvider[] = [];
  if (env.GEMINI_API_KEY) out.push(geminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, fetch: deps.geminiFetch ?? deps.fetch }));
  if (env.ANTHROPIC_API_KEY) out.push(claudeProvider(deps.anthropic(env.ANTHROPIC_API_KEY)));
  return out;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/** POST /api/import: { url?, text?, householdId? } → ImportResult + { counted, llmAvailable }. */
export async function handleImport(req: Request, deps: HandlerDeps): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Bu isteği okuyamadık." }, 400);
  }
  const parsed = importRequestSchema.safeParse(body);
  if (!parsed.success) return jsonResponse({ error: "Link ya da metin biraz uzun oldu; kısaltıp yeniden dener misin?" }, 400);
  const { url, text, householdId } = parsed.data;
  if (!url.trim() && !text.trim()) return jsonResponse({ error: "Bir link ya da tarif metni gerekiyor." }, 400);

  const signal = AbortSignal.timeout(IMPORT_TIMEOUT_MS);
  const providers = providersFromEnv(deps.env, deps);
  // The household id is only the quota key; it never reaches a provider.
  const quotaKey = householdId || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anon";
  let limited = false;
  const structure: Structurer | undefined = providers.length
    ? async (t, meta) => {
        const allowed = deps.limiter.take(quotaKey);
        if (!allowed) limited = true;
        return structureRecipe(t, meta, { providers: allowed ? providers : [], signal });
      }
    : undefined;

  // Platform adapters use plain fetch; the web adapter's arbitrary hosts use the guarded one.
  const routedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input);
    const platformHost = /^https:\/\/(www\.tiktok\.com\/oembed|www\.youtube\.com\/oembed|www\.googleapis\.com\/youtube\/)/.test(u);
    return (platformHost ? deps.fetch : deps.webFetch)(input, init);
  }) as typeof fetch;

  try {
    const { result, counted } = await runImport({ url, text }, { fetch: routedFetch, env: { YOUTUBE_API_KEY: deps.env.YOUTUBE_API_KEY }, signal, structure });
    const message = limited && !result.message ? "Bugünlük akıllı içe aktarma sınırına ulaşıldı; taslağı basit okumayla hazırladık." : result.message;
    return jsonResponse({ ...result, message, counted, llmAvailable: providers.length > 0 });
  } catch (e) {
    console.warn("[import] failed:", e instanceof Error ? e.name : "unknown");
    const timedOut = signal.aborted;
    return jsonResponse(
      { error: timedOut ? "Kaynak geç yanıt verdi. Açıklamayı yapıştırırsan hemen devam ederiz." : "Bu linkten tarif alamadık. Açıklamayı yapıştırarak deneyebilirsin." },
      timedOut ? 504 : 502,
    );
  }
}
