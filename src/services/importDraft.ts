import type { Recipe } from "@/data/models";
import { catalogEntry } from "@/data/seed/ingredients";
import { isWater, matchCatalog } from "@/domain/import/catalogMatch";
import type { ImportedRecipe, ImportResult } from "@/domain/import/types";
import { emptyIngredient, type RecipeDraft } from "./recipeForm";

const OFFSET: Record<ImportedRecipe["prep"][number]["when"], string> = {
  "night-before": "night-before",
  morning: "morning",
  "hour-before": "-60min",
};

const dec = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/** Import draft → the existing recipe form's draft. Nothing is saved until the user submits the form. */
export function toRecipeDraft(r: ImportedRecipe, source: ImportResult["source"]): RecipeDraft {
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

  // Total known: about a third is preparation (at most 15 min), the rest cooking.
  // Otherwise cooking is the sum of the step durations and prep a default 15 min.
  const stepMinutes = r.steps.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
  const total = r.totalMinutes ?? 0;
  const prep = total ? Math.min(15, Math.max(5, Math.round(total / 3))) : 15;
  const cook = Math.min(total ? Math.max(total - prep, stepMinutes ? Math.min(stepMinutes, total) : 0) : stepMinutes || 30, 600);

  const prepItems = r.prep.map((p) => ({ label: p.label, offset: OFFSET[p.when], freezer: /buzluk|dondurucu/i.test(p.label) }));
  const freezerItem =
    prepItems
      .filter((p) => p.freezer)
      .map((p) => matchCatalog(p.label))
      .find((name) => name && ingredients.some((i) => i.name === name)) ?? "";

  return {
    name: r.name,
    course: r.role ?? (/tatlı|kek|kurabiye|sütlaç|revani|muhallebi/i.test(r.name) ? "tatli" : "ana"),
    prepMinutes: String(prep),
    cookMinutes: String(cook),
    servings: String(r.servings ?? 4),
    tags: "",
    ingredients: ingredients.length ? ingredients : [emptyIngredient()],
    prepItems,
    steps: r.steps.length ? r.steps.map((s) => s.text) : [""],
    // Never guessed: the user chooses when a dish is kept.
    leftoverPolicy: "none",
    leftoverDays: "2",
    freezerItem,
    source: "",
    ...(source?.url ? { sourceUrl: source.url } : {}),
    ...(source?.author ? { sourceAuthor: source.author } : {}),
    ...(source ? { sourcePlatform: source.platform as Recipe["sourcePlatform"] } : {}),
  };
}
