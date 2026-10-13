import { RECIPE_JSON_SCHEMA, SYSTEM_PROMPT, userPrompt } from "./prompt";
import { ProviderError, type LlmProvider } from "./types";

export const GEMINI_DEFAULT_MODEL = "gemini-3.1-flash-lite";
/** Thinking tokens count toward the output limit; a 24-ingredient draft is ~1.5k tokens of JSON. */
export const GEMINI_MAX_TOKENS = 4096;
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiFetch = (input: string, init: RequestInit) => Promise<Response>;

type Schema = { [k: string]: unknown };

/**
 * The shared JSON Schema → Gemini's `responseSchema` (OpenAPI subset):
 * `type: ["string", "null"]` becomes `type: "STRING", nullable: true`, and
 * `null` leaves enums.
 */
export function toGeminiSchema(s: Schema): Schema {
  const out: Schema = {};
  const types = Array.isArray(s.type) ? (s.type as string[]) : [s.type as string];
  const main = types.find((t) => t !== "null")!;
  out.type = main.toUpperCase();
  if (types.includes("null")) out.nullable = true;
  if (Array.isArray(s.enum)) out.enum = (s.enum as unknown[]).filter((v) => v !== null);
  if (typeof s.minimum === "number") out.minimum = s.minimum;
  if (typeof s.maximum === "number") out.maximum = s.maximum;
  if (Array.isArray(s.required)) out.required = s.required;
  if (s.properties) out.properties = Object.fromEntries(Object.entries(s.properties as Record<string, Schema>).map(([k, v]) => [k, toGeminiSchema(v)]));
  if (s.items) out.items = toGeminiSchema(s.items as Schema);
  return out;
}

const RESPONSE_SCHEMA = toGeminiSchema(RECIPE_JSON_SCHEMA);

/**
 * Gemini 3 models think before answering by default, which took 6–7 s even for a short
 * caption — past the per-attempt budget. Structuring a caption needs no deliberation.
 * Levels by family; `null` sends no thinking config (unknown families keep their default).
 */
export function thinkingFor(model: string, level: ThinkingLevel): Record<string, unknown> | null {
  if (/^gemini-3/.test(model)) return { thinkingLevel: level };
  if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  return null;
}
export type ThinkingLevel = "minimal" | "low";

/** Levels a model refused (400 INVALID_ARGUMENT), per server instance: minimal → low. */
const refusedMinimal = new Set<string>();

/** The full request body. Only the static prompt, the caption and the platform are in it. */
export function geminiRequestBody(input: Parameters<LlmProvider["call"]>[0], retry: boolean, model = GEMINI_DEFAULT_MODEL, level: ThinkingLevel = "minimal") {
  const thinking = thinkingFor(model, level);
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userPrompt(input, retry) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: GEMINI_MAX_TOKENS,
      ...(thinking ? { thinkingConfig: thinking } : {}),
    },
  };
}

/**
 * Gemini over its REST API with structured JSON output. Free tier by default
 * (`GEMINI_API_KEY` from Google AI Studio); 429 / RESOURCE_EXHAUSTED is a
 * quota failure so the chain moves on to Claude or the rules.
 */
export function geminiProvider(opts: { apiKey: string; model?: string; fetch: GeminiFetch; retryDelayMs?: number }): LlmProvider {
  const model = opts.model?.trim() || GEMINI_DEFAULT_MODEL;
  return {
    name: "gemini",
    async call(input, { signal, retry }) {
      const send = async (level: ThinkingLevel) => {
        try {
          return await opts.fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": opts.apiKey },
            body: JSON.stringify(geminiRequestBody(input, retry, model, level)),
            signal,
          });
        } catch (e) {
          const name = (e as { name?: string })?.name;
          throw new ProviderError(signal.aborted || name === "AbortError" || name === "TimeoutError" ? "timeout" : "error");
        }
      };
      const errorStatus = (r: Response) =>
        r
          .json()
          .then((b: { error?: { status?: string } }) => b?.error?.status)
          .catch(() => undefined);

      let res = await send(refusedMinimal.has(model) ? "low" : "minimal");
      let status: string | undefined;
      if (!res.ok) status = await errorStatus(res);
      // "minimal" isn't offered by every Gemini 3 model: fall back to "low" once and remember.
      if (res.status === 400 && status === "INVALID_ARGUMENT" && thinkingFor(model, "minimal") && !refusedMinimal.has(model)) {
        refusedMinimal.add(model);
        console.warn(`[import] gemini ${model}: thinking level minimal refused; using low`);
        res = await send("low");
        status = res.ok ? undefined : await errorStatus(res);
      }
      // 500/503 ("model is overloaded") come back in under a second and usually pass on a retry.
      if (!res.ok && (res.status === 503 || res.status === 500) && !signal.aborted) {
        await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 800));
        res = await send(refusedMinimal.has(model) ? "low" : "minimal");
        status = res.ok ? undefined : await errorStatus(res);
      }
      if (!res.ok) {
        if (res.status === 429 || status === "RESOURCE_EXHAUSTED") throw new ProviderError("quota", res.status, status);
        if (res.status === 408 || res.status === 504 || status === "DEADLINE_EXCEEDED") throw new ProviderError("timeout", res.status, status);
        throw new ProviderError("error", res.status, status);
      }
      let data: { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
      try {
        data = await res.json();
      } catch {
        throw new ProviderError(signal.aborted ? "timeout" : "invalid", res.status, "BODY");
      }
      const cand = data.candidates?.[0];
      // Thinking models may return thought parts first; only the answer parts are JSON.
      const text = cand?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
      try {
        return JSON.parse(text);
      } catch {
        throw new ProviderError("invalid", res.status, cand?.finishReason ?? data.promptFeedback?.blockReason ?? "NOT_JSON");
      }
    },
  };
}
