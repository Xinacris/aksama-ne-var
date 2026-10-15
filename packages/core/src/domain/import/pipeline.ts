import { PLATFORM_LABEL, type SourcePlatform } from "../../data/models";
import { ADAPTERS, emptySource, SourceUnavailableError, type AdapterContext } from "./adapters";
import { restoreDiacritics } from "./diacritics";
import { detectPlatform, extractUrl, normalizeUrl } from "./detect";
import { webAdapter } from "./adapters/web";
import { isBoilerplateLine, stripBoilerplate } from "./boilerplate";
import { recipeLinks } from "./links";
import { hasIngredientLines, MAX_INPUT_CHARS, parseRecipeText } from "./parseText";
import type { ImportedRecipe, ImportPath, ImportProvider, ImportResult, ImportSource } from "./types";
import { t } from "../../i18n";

/**
 * Turns caption text into a draft (the server's provider chain, see
 * `src/server/llm`). Without one — or if it throws — the rule parser runs.
 */
export type Structurer = (
  text: string,
  meta: { title: string | null; platform: SourcePlatform | null; ocr?: boolean },
) => Promise<{ draft: ImportedRecipe; provider: ImportProvider }>;

export interface ImportDeps extends AdapterContext {
  structure?: Structurer;
  /** Messages in the request's language (the server passes a fixed-language `t`). */
  t?: Translate;
}

export interface ImportInput {
  url?: string;
  text?: string;
  /** "ocr": pasted text came from screenshots (Turkish letters may be missing). */
  textOrigin?: "paste" | "ocr";
}

/** What the server logs/counts: never the caption, only the provider and platform. */
export interface ImportOutcome {
  result: ImportResult;
  /** Set when a draft was produced (for the usage counter). */
  counted: { platform: SourcePlatform | null; provider: ImportProvider } | null;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function pasteMessage(source: ImportSource, reason: "instagram" | "title-only" | "no-ingredients" | "no-recipe-data" | "unavailable", tr: Translate): string {
  const name = PLATFORM_LABEL[source.platform];
  switch (reason) {
    case "instagram":
      return source.availability === "private" ? tr("import.msg.instagramPrivate") : tr("import.msg.instagram");
    case "title-only":
      return tr("import.msg.titleOnly");
    case "no-recipe-data":
      return tr("import.msg.noRecipeData");
    case "unavailable":
      return source.platform === "web" ? tr("import.msg.pageUnavailable") : tr("import.msg.platformUnavailable", { name });
    default:
      return tr("import.msg.noIngredients");
  }
}

/**
 * The rule parser reads Turkish only. Text that shows no sign of Turkish
 * (letters, common kitchen words) gets a plain paste draft instead of a
 * misread one.
 */
export function looksTurkish(text: string): boolean {
  const letters = (text.match(/[çğıöşüÇĞİÖŞÜ]/g) ?? []).length;
  if (letters >= 3) return true;
  const words = text.toLocaleLowerCase("tr").match(/\b(ve|bir|ile|için|dakika|bardağı|kaşığı|tuz|biber|soğan|yağ|yumurta|domates|şeker|süt|salça|kıyma|tereyağı|un|pişir|ekle|malzemeler|yapılışı)\b/g) ?? [];
  return words.length >= 2;
}

/** "Bu metni otomatik ayrıştıramadık": the lines as steps, a name from the title, nothing guessed. */
export function pasteDraft(text: string, title: string | null): ImportedRecipe {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /\p{L}/u.test(l))
    .slice(0, 40);
  const name = (title?.trim() || lines[0] || "").slice(0, 80) || "—";
  return {
    name,
    servings: null,
    role: null,
    totalMinutes: null,
    ingredients: [],
    steps: lines.filter((l) => l !== name).map((l) => ({ text: l.slice(0, 600), minutes: null })),
    prep: [],
    tags: [],
  };
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
  const tr: Translate = deps.t ?? t;
  const pasted = (input.text ?? "").trim().slice(0, MAX_INPUT_CHARS);
  const rawUrl = (input.url ?? "").trim();
  const link = rawUrl ? normalizeUrl(extractUrl(rawUrl) ?? rawUrl) : pasted ? normalizeUrl(extractUrl(pasted) ?? "") : null;

  if (rawUrl && !link && !pasted) {
    return {
      result: { source: null, draft: null, path: null, provider: null, writtenRecipeUrl: null, needsPaste: true, message: tr("import.msg.notALink") },
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
      message = pasteMessage(source, "unavailable", tr);
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
  let notParsed = false;
  if (structured) {
    // schema.org/Recipe data: no LLM call for structure (tags/times are suggested from it later).
    draft = structured;
    provider = "web";
  } else if (text) {
    const ocr = !!pasted && input.textOrigin === "ocr";
    const meta = { title: pasted ? null : source?.title ?? null, platform: source?.platform ?? null, ...(ocr ? { ocr } : {}) };
    const out = deps.structure ? await deps.structure(text, meta).catch(() => null) : null;
    // The rule parser gets screenshot text with its Turkish letters put back (the LLMs are told instead).
    const ruleText = ocr ? restoreDiacritics(text) : text;
    if (out) ({ draft, provider } = out);
    else if (looksTurkish(ruleText)) ({ draft, provider } = { draft: parseRecipeText(ruleText, meta.title), provider: "rules" as const });
    else {
      draft = pasteDraft(ruleText, meta.title);
      provider = "rules";
      notParsed = true;
    }
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
      tr,
    );
  }
  if (notParsed && !message) message = tr("import.msg.notParsed");

  return {
    result: {
      source: source ? publicSource(source, !!fetched) : null,
      draft,
      path,
      provider,
      needsPaste,
      message,
      writtenRecipeUrl,
      // The original wording stays with the draft; the LLM says which language it was in.
      sourceLang: draft?.sourceLang ?? (text ? (looksTurkish(text) ? "tr" : null) : null),
      sourceText: rawText ? rawText.slice(0, MAX_INPUT_CHARS) : null,
    },
    counted: draft && provider ? { platform: source?.platform ?? null, provider } : null,
  };
}
