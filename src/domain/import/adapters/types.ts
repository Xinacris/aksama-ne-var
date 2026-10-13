import type { SourcePlatform } from "@/data/models";
import type { ImportSource } from "../types";

export interface AdapterContext {
  /** Injected so tests can mock it and the route can guard it (timeout, private hosts). */
  fetch: typeof fetch;
  env: { YOUTUBE_API_KEY?: string };
  signal?: AbortSignal;
}

/** A source of recipe text for one platform. New sources implement this and register in `adapters/index.ts`. */
export interface SourceAdapter {
  platform: SourcePlatform;
  fetchSource(url: string, ctx: AdapterContext): Promise<ImportSource>;
}

/** The platform answered with an error or nothing usable; the UI falls back to pasting. */
export class SourceUnavailableError extends Error {
  constructor(
    public readonly platform: SourcePlatform,
    message: string,
  ) {
    super(message);
    this.name = "SourceUnavailableError";
  }
}

export function emptySource(platform: SourcePlatform, url: string, needsPaste = true): ImportSource {
  return { platform, url, title: null, text: null, author: null, thumbnailUrl: null, needsPaste };
}

export async function getJson(ctx: AdapterContext, url: string, platform: SourcePlatform): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await ctx.fetch(url, { signal: ctx.signal, headers: { accept: "application/json" } });
  } catch {
    throw new SourceUnavailableError(platform, "unreachable");
  }
  if (!res.ok) throw new SourceUnavailableError(platform, `status ${res.status}`);
  try {
    const data = (await res.json()) as unknown;
    if (!data || typeof data !== "object") throw new Error("not an object");
    return data as Record<string, unknown>;
  } catch {
    throw new SourceUnavailableError(platform, "bad json");
  }
}

export const s = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
