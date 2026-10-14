import { parseRecipeText } from "@anv/core/domain/import/parseText";
import type { ImportedRecipe } from "@anv/core/domain/import/types";
import type { SourcePlatform } from "@anv/core/data/models";
import { ProviderError, type LlmProvider, type ProviderFallback, type ProviderInput, type ProviderName } from "./types";
import { validateDraft } from "./validate";

export * from "./types";

/**
 * A provider with another one after it gets at most this long per attempt, so a slow one
 * still leaves time for the next. The last provider may use what is left of the request.
 */
export const PROVIDER_TIMEOUT_MS = 8_000;

export interface StructureMeta {
  platform: SourcePlatform | null;
  /** Public title of the post/video (YouTube): used by the rule parser and prepended to the caption when missing. */
  title: string | null;
  /** The user's language: the draft comes back in it. */
  locale?: "tr" | "en";
}

export interface StructureOptions {
  /** In order of preference; unconfigured ones are simply not in the list. */
  providers: LlmProvider[];
  /** The request's overall deadline. */
  signal?: AbortSignal;
  /** When that deadline falls (epoch ms), so the last provider can use the remaining time. */
  deadline?: number;
  timeoutMs?: number;
  /** Called once per provider that gave up (for counting/logging; never with the caption). */
  onFailure?: (fallback: ProviderFallback) => void;
}

/** What LLM providers receive: caption text (title as its first line when not already in it) + platform. */
export function providerInput(text: string, meta: StructureMeta): ProviderInput {
  const title = meta.title?.trim();
  return { text: title && !text.includes(title) ? `${title}\n\n${text}` : text, platform: meta.platform, ...(meta.locale && meta.locale !== "tr" ? { locale: meta.locale } : {}) };
}

async function attempt(p: LlmProvider, input: ProviderInput, opts: StructureOptions, isLast: boolean): Promise<ImportedRecipe> {
  let last: ProviderError | null = null;
  for (let retry = 0; retry < 2; retry++) {
    // The last provider keeps going until the request deadline (the rule parser needs no time).
    const budget = opts.timeoutMs ?? (isLast && opts.deadline ? Math.max(1_000, opts.deadline - Date.now() - 300) : PROVIDER_TIMEOUT_MS);
    const signals = [AbortSignal.timeout(budget), ...(opts.signal ? [opts.signal] : [])];
    const signal = AbortSignal.any(signals);
    let raw: unknown;
    try {
      raw = await p.call(input, { signal, retry: retry > 0 });
    } catch (e) {
      if (e instanceof ProviderError && e.kind !== "invalid") throw e;
      if (signal.aborted) throw new ProviderError("timeout");
      if (!(e instanceof ProviderError)) throw new ProviderError("error");
      last = e;
      continue; // invalid → one retry
    }
    const draft = validateDraft(raw);
    if (draft) return draft;
    last = new ProviderError("invalid", undefined, "SCHEMA");
  }
  throw last ?? new ProviderError("invalid");
}

/**
 * Caption → draft. Tries each configured LLM provider in order (Gemini →
 * Claude); quota/429, timeout, errors and invalid output after one retry fall
 * through to the next; the rule-based parser always answers last.
 * Never logs the caption.
 */
export async function structureRecipe(text: string, meta: StructureMeta, opts: StructureOptions): Promise<{ draft: ImportedRecipe; provider: ProviderName }> {
  const input = providerInput(text, meta);
  for (const [i, p] of opts.providers.entries()) {
    if (opts.signal?.aborted) break;
    try {
      return { draft: await attempt(p, input, opts, i === opts.providers.length - 1), provider: p.name };
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError("error");
      const fb: ProviderFallback = { provider: p.name, kind: err.kind, ...(err.status ? { status: err.status } : {}), ...(err.reason ? { reason: err.reason } : {}) };
      console.warn(`[import] ${p.name} gave up (${fb.kind}${fb.status ? ` ${fb.status}` : ""}${fb.reason ? ` ${fb.reason}` : ""}); trying next`);
      opts.onFailure?.(fb);
    }
  }
  return { draft: parseRecipeText(text, meta.title), provider: "rules" };
}
