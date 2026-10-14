import { z } from "zod";
import { recipeSchema, type Recipe } from "../models";
import { anaYemekler1 } from "./recipes/ana1";
import { anaYemekler2 } from "./recipes/ana2";
import { corbalar } from "./recipes/corba";
import { kahvaltilar, tatlilar } from "./recipes/kahvalti-tatli";
import { salatalar } from "./recipes/salata";
import { yanindalar } from "./recipes/yaninda";
import { BUILTIN_EN } from "./en";

const all: Recipe[] = [
  ...corbalar,
  ...anaYemekler1,
  ...anaYemekler2,
  ...yanindalar,
  ...salatalar,
  ...kahvaltilar,
  ...tatlilar,
];

/**
 * Built-ins are written in Turkish and carry their English text (`seed/en`).
 * Ingredient display names come from the catalog (`ing.*` keys), so the
 * translation only holds what is recipe-specific: name, steps, prep labels, notes.
 */
function withEnglish(r: Recipe): Recipe {
  const en = BUILTIN_EN[r.id];
  if (!en) return { ...r, lang: "tr" };
  return {
    ...r,
    lang: "tr",
    translations: {
      en: {
        name: en.name,
        ...(en.shortName ? { shortName: en.shortName } : {}),
        ...(en.timeNote ? { timeNote: en.timeNote } : {}),
        ...(en.notes ? { notes: en.notes } : {}),
        steps: en.steps,
        ...(en.prep ? { prepItems: en.prep } : {}),
        origin: "seed",
      },
    },
  };
}

/** The 100 built-in recipes, validated once at module load. */
export const builtinRecipes: Recipe[] = z.array(recipeSchema).parse(all.map(withEnglish));
