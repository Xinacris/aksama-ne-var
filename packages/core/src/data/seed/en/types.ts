/** English text of a built-in recipe (ingredient display names come from the catalog: `ing.*` keys). */
export interface EnRecipe {
  name: string;
  shortName?: string;
  timeNote?: string;
  /** Ingredient notes by canonical ingredient name. */
  notes?: Record<string, string>;
  /** Prep-ahead labels, same order as the recipe's `prepItems`. */
  prep?: string[];
  steps: string[];
}
