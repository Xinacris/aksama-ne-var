import { CATALOG_FILES } from "../../data/recipes/index";
import type { Recipe } from "../data/models";
import { loadCatalog } from "./load";

/** The app's built-in recipes: the curated catalog (packages/core/data/recipes), however much of it exists. */
export const catalogRecipes: Recipe[] = loadCatalog(CATALOG_FILES);
