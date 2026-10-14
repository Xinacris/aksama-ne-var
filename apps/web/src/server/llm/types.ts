import type { SourcePlatform } from "@anv/core/data/models";

export type LlmProviderName = "gemini" | "claude";
export type ProviderName = LlmProviderName | "rules";

/** Exactly what an LLM provider may see: the caption text and its platform. No names, ids or stored data. */
export interface ProviderInput {
  text: string;
  platform: SourcePlatform | null;
  /** Language the draft is written in (the user's). Not personal data: a language code. */
  locale?: "tr" | "en";
}

type JsonSchema = { [k: string]: unknown };

/** One structured-output job for any provider: instructions, the user message, the JSON Schema of the answer. */
export interface LlmTask {
  system: string;
  user: string;
  schema: JsonSchema;
  /** Claude's forced tool (name + description); Gemini ignores it. */
  tool: { name: string; description: string };
}

/** Why a provider gave up; every kind moves on to the next provider. */
export type ProviderFailure = "quota" | "timeout" | "invalid" | "error";

export class ProviderError extends Error {
  /**
   * `status`: the provider's HTTP status; `reason`: its error code ("NOT_FOUND",
   * "INVALID_ARGUMENT", "RESOURCE_EXHAUSTED", "MAX_TOKENS"…). Never caption text.
   */
  constructor(
    readonly kind: ProviderFailure,
    readonly status?: number,
    readonly reason?: string,
  ) {
    super(`provider-${kind}`);
    this.name = "ProviderError";
  }
}

/** Why a provider was skipped, safe to log and to return: no caption, no prompt, no output. */
export interface ProviderFallback {
  provider: LlmProviderName;
  kind: ProviderFailure;
  status?: number;
  reason?: string;
}

/**
 * One LLM backend. `call` returns the model's raw JSON (unvalidated) or throws
 * a `ProviderError`; validation and the single retry live in `structureRecipe`.
 */
export interface LlmProvider {
  name: LlmProviderName;
  /** Recipe structuring (import). */
  call(input: ProviderInput, opts: { signal: AbortSignal; retry: boolean }): Promise<unknown>;
  /** Any other structured task (translation). Providers without it are skipped there. */
  run?(task: LlmTask, opts: { signal: AbortSignal }): Promise<unknown>;
}
