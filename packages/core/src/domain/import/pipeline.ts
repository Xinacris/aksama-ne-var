import { PLATFORM_LABEL, type SourcePlatform } from "../../data/models";
import { ADAPTERS, emptySource, SourceUnavailableError, type AdapterContext } from "./adapters";
import { detectPlatform, extractUrl, normalizeUrl } from "./detect";
import { webAdapter } from "./adapters/web";
import { isBoilerplateLine, stripBoilerplate } from "./boilerplate";
import { recipeLinks } from "./links";
import { hasIngredientLines, MAX_INPUT_CHARS, parseRecipeText } from "./parseText";
import type { ImportedRecipe, ImportPath, ImportProvider, ImportResult, ImportSource } from "./types";

/**
 * Turns caption text into a draft (the server's provider chain, see
 * `src/server/llm`). Without one — or if it throws — the rule parser runs.
 */
export type Structurer = (
  text: string,
  meta: { title: string | null; platform: SourcePlatform | null },
) => Promise<{ draft: ImportedRecipe; provider: ImportProvider }>;

export interface ImportDeps extends AdapterContext {
  structure?: Structurer;
}

export interface ImportInput {
  url?: string;
  text?: string;
}

/** What the server logs/counts: never the caption, only the provider and platform. */
export interface ImportOutcome {
  result: ImportResult;
  /** Set when a draft was produced (for the usage counter). */
  counted: { platform: SourcePlatform | null; provider: ImportProvider } | null;
}

function pasteMessage(source: ImportSource, reason: "instagram" | "title-only" | "no-ingredients" | "no-recipe-data" | "unavailable"): string {
  const name = PLATFORM_LABEL[source.platform];
  switch (reason) {
    case "instagram":
      return "Instagram, gönderinin açıklamasını dışarıya vermiyor. Reels'in altındaki açıklamayı kopyalayıp aşağıya yapıştırırsan tarifi oradan çıkarırız.";
    case "title-only":
      return "YouTube'dan yalnızca başlık geldi. Açıklamadaki tarifi kopyalayıp yapıştırırsan malzemeleri oradan alırız.";
    case "no-recipe-data":
      return "Bu sayfada tarif bilgisi bulamadık. Malzemeleri ve yapılışı kopyalayıp yapıştırabilirsin.";
    case "unavailable":
      return source.platform === "web"
        ? "Bu sayfaya şu an ulaşamadık. Tarifi kopyalayıp yapıştırırsan oradan devam ederiz."
        : `${name} şu an yanıt vermedi. Açıklamayı yapıştırırsan oradan devam ederiz.`;
    default:
      return "Açıklamada malzeme listesi bulamadık. Tarif yorumlarda ya da videonun içindeyse buraya yapıştırabilir veya yazabilirsin.";
  }
}

/** At most this many links are tried for a written recipe. */
export const MAX_RECIPE_LINKS = 2;
/** A shortener is expanded (≤ 3 redirects, through the guarded fetch) within this time. */
export const SHORTENER_TIMEOUT_MS = 5_000;
/** One written-recipe page may take this long. */
export const RECIPE_PAGE_TIMEOUT_MS = 8_000;

const within = (ms: number, outer?: AbortSignal) => (outer ? AbortSignal.any([outer, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms));

/**
 * "Yazılı tarif için: https://…" — follow up to two recipe links in the text and use the
 * page's schema.org/Recipe when it has ingredients and steps. Direct recipe-site links
 * first; a shortener only when no direct link worked, expanded within 5 s.
 */
export async function followRecipeLinks(text: string, deps: ImportDeps): Promise<{ url: string; recipe: ImportedRecipe } | null> {
  const candidates = recipeLinks(text);
  let tried = 0;
  for (const c of candidates) {
    if (tried >= MAX_RECIPE_LINKS || deps.signal?.aborted) break;
    tried++;
    let url = c.url;
    try {
      if (c.shortener) {
        // The route's fetch for non-platform hosts is guarded: public hosts only, ≤ 3 redirects.
        const res = await deps.fetch(url, { method: "HEAD", signal: within(SHORTENER_TIMEOUT_MS, deps.signal) });
        const target = res.url && res.url !== url ? res.url : (res.headers.get("location") ?? "");
        if (!target || recipeLinks(target).length === 0) continue;
        url = new URL(target, url).toString();
      }
      const page = await webAdapter.fetchSource(url, { ...deps, signal: within(RECIPE_PAGE_TIMEOUT_MS, deps.signal) });
      const r = page.recipe;
      if (r && r.ingredients.length && r.steps.length) return { url, recipe: r };
    } catch {
      // unreachable, not HTML, blocked host, timeout: try the next one
    }
  }
  return null;
}

function publicSource(src: ImportSource, hasText: boolean): NonNullable<ImportResult["source"]> {
  return {
    platform: src.platform,
    url: src.url,
    title: src.title,
    author: src.author,
    thumbnailUrl: src.thumbnailUrl,
    needsPaste: src.needsPaste,
    ...(src.siteName ? { siteName: src.siteName } : {}),
    hasText,
  };
}

/**
 * Link and/or pasted caption → recipe draft. Pasted text always wins over
 * fetched text; schema.org data is used as-is; otherwise the LLM structures
 * the text when available, and the rule parser is the fallback.
 */
export async function runImport(input: ImportInput, deps: ImportDeps): Promise<ImportOutcome> {
  const pasted = (input.text ?? "").trim().slice(0, MAX_INPUT_CHARS);
  const rawUrl = (input.url ?? "").trim();
  const link = rawUrl ? normalizeUrl(extractUrl(rawUrl) ?? rawUrl) : pasted ? normalizeUrl(extractUrl(pasted) ?? "") : null;

  if (rawUrl && !link && !pasted) {
    return {
      result: { source: null, draft: null, path: null, provider: null, writtenRecipeUrl: null, needsPaste: true, message: "Bu bir bağlantıya benzemiyor. Linki yeniden kopyalayabilir ya da tarifi doğrudan yapıştırabilirsin." },
      counted: null,
    };
  }

  let source: ImportSource | null = null;
  let message: string | null = null;
  if (link) {
    const platform = detectPlatform(link) ?? "web";
    try {
      source = await ADAPTERS[platform].fetchSource(link, deps);
    } catch (e) {
      if (!(e instanceof SourceUnavailableError)) throw e;
      source = emptySource(platform, link);
      message = pasteMessage(source, "unavailable");
    }
  }

  const fetchedRaw = source?.text?.slice(0, MAX_INPUT_CHARS) ?? null;
  const rawText = pasted || fetchedRaw || "";
  // Channel boilerplate (link lists, abone ol, SOSYAL MEDYA, sponsors) never reaches a parser.
  const fetched = fetchedRaw === null ? null : stripBoilerplate(fetchedRaw);
  const text = stripBoilerplate(rawText);
  let structured = !pasted && source?.recipe && source.recipe.ingredients.length ? source.recipe : null;

  // A video/post that links its written recipe: that page is the better source.
  let writtenRecipeUrl: string | null = null;
  if (!structured && rawText && source?.platform !== "web") {
    const written = await followRecipeLinks(rawText, deps);
    if (written) {
      structured = written.recipe;
      writtenRecipeUrl = written.url;
    }
  }

  let draft: ImportedRecipe | null = null;
  let provider: ImportProvider | null = null;
  if (structured) {
    // schema.org/Recipe data: no LLM call for structure (tags/times are suggested from it later).
    draft = structured;
    provider = "web";
  } else if (text) {
    const meta = { title: pasted ? null : source?.title ?? null, platform: source?.platform ?? null };
    const out = deps.structure ? await deps.structure(text, meta).catch(() => null) : null;
    ({ draft, provider } = out ?? { draft: parseRecipeText(text, meta.title), provider: "rules" as const });
  }
  if (draft) draft = { ...draft, steps: draft.steps.filter((st) => !isBoilerplateLine(st.text)) };
  const path: ImportPath | null = provider ? (provider === "gemini" || provider === "claude" ? "llm" : "rules") : null;

  const needsPaste = !pasted && !structured && !hasIngredientLines(fetched);
  if (needsPaste && source && !message) {
    message = pasteMessage(
      source,
      source.platform === "instagram"
        ? "instagram"
        : source.platform === "youtube" && !fetched?.includes("\n")
          ? "title-only"
          : source.platform === "web"
            ? "no-recipe-data"
            : "no-ingredients",
    );
  }

  return {
    result: {
      source: source ? publicSource(source, !!fetched) : null,
      draft,
      path,
      provider,
      needsPaste,
      message,
      writtenRecipeUrl,
    },
    counted: draft && provider ? { platform: source?.platform ?? null, provider } : null,
  };
}
