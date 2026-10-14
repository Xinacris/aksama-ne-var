import { ana1En } from "./ana1";
import { ana2En } from "./ana2";
import { corbaEn } from "./corba";
import { kahvaltiTatliEn } from "./kahvaltiTatli";
import { salataEn } from "./salata";
import type { EnRecipe } from "./types";
import { yanindaEn } from "./yaninda";

/** English text of the built-in recipes, by recipe id. */
export const BUILTIN_EN: Record<string, EnRecipe> = { ...corbaEn, ...ana1En, ...ana2En, ...yanindaEn, ...salataEn, ...kahvaltiTatliEn };
