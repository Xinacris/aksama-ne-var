import { runImport } from "@/domain/import/pipeline";
import { importRequestSchema } from "@/domain/import/types";
import { llmStructurer, type MessagesClient } from "./llm";
import { DailyLimiter } from "./rateLimit";

export const IMPORT_TIMEOUT_MS = 15_000;

export interface HandlerDeps {
  /** Platform endpoints (oEmbed, YouTube API) — public, fixed hosts. */
  fetch: typeof fetch;
  /** User-supplied web links go through the private-network guard. */
  webFetch: typeof fetch;
  env: { ANTHROPIC_API_KEY?: string; YOUTUBE_API_KEY?: string };
  /** Builds the Claude client; only called when ANTHROPIC_API_KEY is set. */
  anthropic: (apiKey: string) => MessagesClient;
  limiter: DailyLimiter;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/** POST /api/import: { url?, text?, householdId? } → ImportResult + { llmAvailable }. */
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
  const key = deps.env.ANTHROPIC_API_KEY;
  const quotaKey = householdId || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anon";
  let limited = false;
  const structure = key
    ? (async (t: string, hint: Parameters<ReturnType<typeof llmStructurer>>[1]) => {
        if (!deps.limiter.take(quotaKey)) {
          limited = true;
          return null;
        }
        return llmStructurer(deps.anthropic(key), { signal, timeoutMs: IMPORT_TIMEOUT_MS })(t, hint);
      })
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
    return jsonResponse({ ...result, message, counted, llmAvailable: !!key });
  } catch (e) {
    console.warn("[import] failed:", e instanceof Error ? e.name : "unknown");
    const timedOut = signal.aborted;
    return jsonResponse(
      { error: timedOut ? "Kaynak geç yanıt verdi. Açıklamayı yapıştırırsan hemen devam ederiz." : "Bu linkten tarif alamadık. Açıklamayı yapıştırarak deneyebilirsin." },
      timedOut ? 504 : 502,
    );
  }
}
