import { PLATFORM_LABEL, type Recipe } from "@/data/models";
import { catalogEntry } from "@/data/seed/ingredients";
import { isWater, matchCatalog } from "@/domain/import/catalogMatch";
import { filterTags, keywordTags, mergeTags } from "@/domain/import/tags";
import { stepMinutes } from "@/domain/import/timing";
import type { ImportedRecipe, ImportResult } from "@/domain/import/types";
import { emptyIngredient, type RecipeDraft } from "./recipeForm";

const OFFSET: Record<ImportedRecipe["prep"][number]["when"], string> = {
  "night-before": "night-before",
  morning: "morning",
  "hour-before": "-60min",
};

const dec = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/** Pasted text with no link at all: still say where the recipe came from. */
export const PASTED_SOURCE = "Yapıştırılan tarif metni";

/**
 * The form's Kaynak field, never empty: "YouTube · Yemek.com", "TikTok · @mutfakdefteri",
 * just "Instagram" when the author is unknown, the site name for web pages.
 */
export function sourceLabel(source: ImportResult["source"]): string {
  if (!source) return PASTED_SOURCE;
  if (source.platform === "web") return source.siteName || source.author || hostOf(source.url) || PLATFORM_LABEL.web;
  const platform = PLATFORM_LABEL[source.platform];
  return source.author ? `${platform} · ${source.author}` : platform;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const clampMinutes = (n: number) => Math.max(0, Math.min(Math.round(n), 600));

/**
 * Times for the form. Pişirme is heat only; waiting (marinate, rest, soak, chill) goes to Bekleme.
 * Explicit prep/cook/wait (LLM, schema.org, "Pişirme: 40 dk") win; otherwise the steps' heat
 * minutes are the cooking time and a known total is split around them.
 */
export function draftTimes(r: ImportedRecipe): { prep: number; cook: number; wait: number } {
  const fromSteps = stepMinutes(r.steps);
  const wait = r.waitMinutes ?? fromSteps.wait;
  const total = r.totalMinutes ?? 0;
  // A known total is split around the waiting: about a third preparation (5–15 min), the rest cooking.
  const avail = total ? Math.max(total - wait, 1) : 0;
  const prepGuess = avail ? Math.min(15, Math.max(5, Math.round(avail / 3))) : 15;
  let cook = r.cookMinutes ?? null;
  let prep = r.prepMinutes ?? null;
  if (cook === null) cook = avail ? Math.max(Math.min(fromSteps.heat, avail), avail - (prep ?? prepGuess)) : fromSteps.heat || 30;
  if (prep === null) prep = avail && r.cookMinutes != null ? Math.min(30, Math.max(5, avail - cook)) : prepGuess;
  return { prep: clampMinutes(prep), cook: clampMinutes(cook), wait: Math.max(0, Math.min(Math.round(wait), 1440)) };
}

/**
 * Import draft → the existing recipe form's draft. Nothing is saved until the user submits the form.
 * `existingTags` (what the form already had) are kept first; new tags are merged without duplicates.
 */
export function toRecipeDraft(r: ImportedRecipe, source: ImportResult["source"], existingTags = ""): RecipeDraft {
  const ingredients = r.ingredients
    .filter((i) => !isWater(i.item))
    .map((i) => {
      const canonical = matchCatalog(i.item);
      const entry = canonical ? catalogEntry(canonical) : undefined;
      const side = entry?.side ?? i.side ?? "market";
      return {
        name: canonical ?? i.item,
        quantity: i.amount === null ? "" : dec(i.amount),
        unit: i.amount === null ? "" : i.unit ?? "adet",
        side,
        aisle: entry?.aisle ?? (side === "pazar" ? "Sebze" : "Diğer"),
        ...(i.note ? { note: i.note } : {}),
      };
    })
    // one row per catalog item ("soğan" twice → keep the first)
    .filter((row, idx, all) => all.findIndex((x) => x.name === row.name) === idx);

  const times = draftTimes(r);
  // Vocabulary tags from the provider (LLM fields or rule keywords); a draft without any gets the keyword pass.
  const tags = r.tags?.length ? filterTags(r.tags) : keywordTags([r.name, ...r.steps.map((x) => x.text)].join("\n"), r.ingredients);

  const prepItems = r.prep.map((p) => ({ label: p.label, offset: OFFSET[p.when], freezer: /buzluk|dondurucu/i.test(p.label) }));
  const freezerItem =
    prepItems
      .filter((p) => p.freezer)
      .map((p) => matchCatalog(p.label))
      .find((name) => name && ingredients.some((i) => i.name === name)) ?? "";

  return {
    name: r.name,
    course: r.role ?? (/tatlı|kek|kurabiye|sütlaç|revani|muhallebi/i.test(r.name) ? "tatli" : "ana"),
    prepMinutes: String(times.prep),
    cookMinutes: String(times.cook),
    waitMinutes: times.wait ? String(times.wait) : "",
    servings: String(r.servings ?? 4),
    tags: mergeTags(existingTags, tags),
    ingredients: ingredients.length ? ingredients : [emptyIngredient()],
    prepItems,
    steps: r.steps.length ? r.steps.map((s) => s.text) : [""],
    // Never guessed: the user chooses when a dish is kept.
    leftoverPolicy: "none",
    leftoverDays: "2",
    freezerItem,
    source: sourceLabel(source),
    ...(source?.url ? { sourceUrl: source.url } : {}),
    ...(source?.author ? { sourceAuthor: source.author } : {}),
    ...(source ? { sourcePlatform: source.platform as Recipe["sourcePlatform"] } : {}),
    ...(source?.thumbnailUrl ? { sourceThumbnailUrl: source.thumbnailUrl } : {}),
  };
}

type Source = NonNullable<ImportResult["source"]>;

/**
 * The paste-fallback call fetches the link again; if the platform answers less this time
 * (rate limit, timeout), keep what the first answer said about the same link.
 */
export function keepSource(prev: ImportResult["source"], next: ImportResult["source"]): ImportResult["source"] {
  if (!next || !prev || prev.url !== next.url) return next;
  const pick = <K extends keyof Source>(k: K) => next[k] ?? prev[k];
  return { ...next, title: pick("title"), author: pick("author"), thumbnailUrl: pick("thumbnailUrl"), siteName: pick("siteName") };
}
