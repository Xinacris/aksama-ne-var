import { parseRecipeText } from "@/domain/import/parseText";
import type { ImportedRecipe } from "@/domain/import/types";
import type { SourcePlatform } from "@/data/models";
import { ProviderError, type LlmProvider, type ProviderInput, type ProviderName } from "./types";
import { validateDraft } from "./validate";

export * from "./types";

/** Each provider gets at most this long per attempt, so a slow one still leaves time for the next. */
export const PROVIDER_TIMEOUT_MS = 7_000;

export interface StructureMeta {
  platform: SourcePlatform | null;
  /** Public title of the post/video (YouTube): used by the rule parser and prepended to the caption when missing. */
  title: string | null;
}

export interface StructureOptions {
  /** In order of preference; unconfigured ones are simply not in the list. */
  providers: LlmProvider[];
  /** The request's overall deadline. */
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Called once per provider that gave up (for counting/logging; never with the caption). */
  onFailure?: (provider: LlmProvider["name"], kind: ProviderError["kind"]) => void;
}

/** What LLM providers receive: caption text (title as its first line when not already in it) + platform. */
export function providerInput(text: string, meta: StructureMeta): ProviderInput {
  const title = meta.title?.trim();
  return { text: title && !text.includes(title) ? `${title}\n\n${text}` : text, platform: meta.platform };
}

async function attempt(p: LlmProvider, input: ProviderInput, opts: StructureOptions): Promise<ImportedRecipe> {
  for (let retry = 0; retry < 2; retry++) {
    const signals = [AbortSignal.timeout(opts.timeoutMs ?? PROVIDER_TIMEOUT_MS), ...(opts.signal ? [opts.signal] : [])];
    const signal = AbortSignal.any(signals);
    let raw: unknown;
    try {
      raw = await p.call(input, { signal, retry: retry > 0 });
    } catch (e) {
      if (e instanceof ProviderError && e.kind !== "invalid") throw e;
      if (signal.aborted) throw new ProviderError("timeout");
      if (!(e instanceof ProviderError)) throw new ProviderError("error");
      continue; // invalid → one retry
    }
    const draft = validateDraft(raw);
    if (draft) return draft;
  }
  throw new ProviderError("invalid");
}

/**
 * Caption → draft. Tries each configured LLM provider in order (Gemini →
 * Claude); quota/429, timeout, errors and invalid output after one retry fall
 * through to the next; the rule-based parser always answers last.
 * Never logs the caption.
 */
export async function structureRecipe(text: string, meta: StructureMeta, opts: StructureOptions): Promise<{ draft: ImportedRecipe; provider: ProviderName }> {
  const input = providerInput(text, meta);
  for (const p of opts.providers) {
    if (opts.signal?.aborted) break;
    try {
      return { draft: await attempt(p, input, opts), provider: p.name };
    } catch (e) {
      const kind = e instanceof ProviderError ? e.kind : "error";
      console.warn(`[import] ${p.name} gave up (${kind}); trying next`);
      opts.onFailure?.(p.name, kind);
    }
  }
  return { draft: parseRecipeText(text, meta.title), provider: "rules" };
}
