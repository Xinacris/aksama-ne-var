import type { SourcePlatform } from "@/data/models";

export type LlmProviderName = "gemini" | "claude";
export type ProviderName = LlmProviderName | "rules";

/** Exactly what an LLM provider may see: the caption text and its platform. No names, ids or stored data. */
export interface ProviderInput {
  text: string;
  platform: SourcePlatform | null;
}

/** Why a provider gave up; every kind moves on to the next provider. */
export type ProviderFailure = "quota" | "timeout" | "invalid" | "error";

export class ProviderError extends Error {
  constructor(readonly kind: ProviderFailure) {
    super(`provider-${kind}`);
    this.name = "ProviderError";
  }
}

/**
 * One LLM backend. `call` returns the model's raw JSON (unvalidated) or throws
 * a `ProviderError`; validation and the single retry live in `structureRecipe`.
 */
export interface LlmProvider {
  name: LlmProviderName;
  call(input: ProviderInput, opts: { signal: AbortSignal; retry: boolean }): Promise<unknown>;
}
