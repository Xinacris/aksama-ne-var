import { z } from "zod";
import { recipeSchema, type Recipe } from "../models";
import { anaYemekler1 } from "./recipes/ana1";
import { anaYemekler2 } from "./recipes/ana2";
import { corbalar } from "./recipes/corba";
import { kahvaltilar, tatlilar } from "./recipes/kahvalti-tatli";
import { salatalar } from "./recipes/salata";
import { yanindalar } from "./recipes/yaninda";

const all: Recipe[] = [
  ...corbalar,
  ...anaYemekler1,
  ...anaYemekler2,
  ...yanindalar,
  ...salatalar,
  ...kahvaltilar,
  ...tatlilar,
];

/** The 100 built-in recipes, validated once at module load. */
export const builtinRecipes: Recipe[] = z.array(recipeSchema).parse(all);
