import { RECIPE_JSON_SCHEMA, SYSTEM_PROMPT, userPrompt } from "./prompt";
import { ProviderError, type LlmProvider } from "./types";

export const GEMINI_DEFAULT_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_MAX_TOKENS = 2048;
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

/** The full request body. Only the static prompt, the caption and the platform are in it. */
export function geminiRequestBody(input: Parameters<LlmProvider["call"]>[0], retry: boolean) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userPrompt(input, retry) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: GEMINI_MAX_TOKENS,
    },
  };
}

/**
 * Gemini over its REST API with structured JSON output. Free tier by default
 * (`GEMINI_API_KEY` from Google AI Studio); 429 / RESOURCE_EXHAUSTED is a
 * quota failure so the chain moves on to Claude or the rules.
 */
export function geminiProvider(opts: { apiKey: string; model?: string; fetch: GeminiFetch }): LlmProvider {
  const model = opts.model?.trim() || GEMINI_DEFAULT_MODEL;
  return {
    name: "gemini",
    async call(input, { signal, retry }) {
      let res: Response;
      try {
        res = await opts.fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": opts.apiKey },
          body: JSON.stringify(geminiRequestBody(input, retry)),
          signal,
        });
      } catch (e) {
        const name = (e as { name?: string })?.name;
        throw new ProviderError(signal.aborted || name === "AbortError" || name === "TimeoutError" ? "timeout" : "error");
      }
      if (!res.ok) {
        const status = await res
          .json()
          .then((b: { error?: { status?: string } }) => b?.error?.status)
          .catch(() => undefined);
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
