import type { Recipe, RecipeTranslation } from "../data/models";
import { catalogEntry } from "../data/seed/ingredients";
import { translationFromResult, translationPayload } from "../domain/recipeText";
import type { Locale } from "../i18n";

/**
 * Client side of "Çevir / Translate": both apps call the web's /api/translate
 * (the phone over HTTPS) with the recipe text only and save the answer as
 * `translations[locale]`.
 */
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const cache = new Map<string, Promise<boolean>>();

/** Whether the server has a provider (GET /api/translate). Cached per base URL; false on any error. */
export function translateAvailable(fetchFn: FetchLike, baseUrl = ""): Promise<boolean> {
  let p = cache.get(baseUrl);
  if (!p) {
    p = fetchFn(`${baseUrl}/api/translate`, { method: "GET", headers: { accept: "application/json" } })
      .then(async (r) => (r.ok ? !!((await r.json()) as { available?: boolean }).available : false))
      .catch(() => false);
    cache.set(baseUrl, p);
  }
  return p;
}

export function resetTranslateAvailability() {
  cache.clear();
}

export async function requestTranslation(
  fetchFn: FetchLike,
  baseUrl: string,
  raw: Recipe,
  to: Locale,
  householdId: string,
): Promise<{ ok: true; translation: RecipeTranslation } | { ok: false; error: string | null }> {
  const body = {
    householdId,
    from: raw.lang ?? "tr",
    to,
    recipe: translationPayload(raw, (n) => !!catalogEntry(n)),
  };
  try {
    const res = await fetchFn(`${baseUrl}/api/translate`, {
      method: "POST",
      headers: { "content-type": "application/json", "accept-language": to },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { translation?: Parameters<typeof translationFromResult>[0]; error?: string };
    if (!res.ok || !data.translation) return { ok: false, error: data.error ?? null };
    return { ok: true, translation: translationFromResult(data.translation) };
  } catch {
    return { ok: false, error: null };
  }
}
