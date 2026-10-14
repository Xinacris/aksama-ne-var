import { parseIngredientLine } from "../domain/import/parseText";
import { ingredientRow } from "./importDraft";
import { emptyIngredient, type IngredientDraft } from "./recipeForm";

/** Non-empty lines of a pasted block. */
export function pastedLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** List markers a phone note or a website adds in front of a line: "1.", "2)", "3 -", "Adım 4:", "•", "-", "1️⃣". */
const MARKER = /^(?:\d{1,2}\s*[.)]|\d{1,2}\s*[-–:](?!\s*\d)|adım\s*\d+\s*[:.)-]?|[1-9]\u{FE0F}?\u{20E3}|[-–—•·*▪◦●►▶➤→✓✔]+)\s*/iu;

export function stripMarker(line: string): string {
  return line.replace(MARKER, "").trim();
}

/**
 * "Toplu yapıştır" for Malzemeler: one ingredient per line, read like an import
 * caption's ingredient section ("Tuz, karabiber" becomes two rows). A line that
 * doesn't read as an ingredient stays, as typed, in the name so nothing is lost.
 */
export function ingredientsFromLines(text: string): IngredientDraft[] {
  const rows: IngredientDraft[] = [];
  for (const line of pastedLines(text)) {
    const parsed = parseIngredientLine(line, true);
    if (parsed?.length) rows.push(...parsed.map(ingredientRow));
    else {
      const name = stripMarker(line);
      if (name) rows.push({ ...emptyIngredient(), name, unit: "" });
    }
  }
  return rows;
}

/** "Toplu yapıştır" for Hazırlanışı: one step per line, numbering stripped, blank lines ignored. */
export function stepsFromLines(text: string): string[] {
  return pastedLines(text)
    .map(stripMarker)
    .filter((l) => /\p{L}/u.test(l));
}

/** Rows that are still empty can be replaced by pasted ones instead of trailing above them. */
export function isBlankIngredient(i: IngredientDraft): boolean {
  return !i.name.trim() && !i.quantity.trim();
}
