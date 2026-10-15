import { z } from "zod";
import { UNITS } from "../data/models";

/**
 * The curated recipe catalog (Round 3.4): one shape for the local JSON files, the generator, the
 * validator and the Supabase seed (recipes, recipe_ingredients, recipe_steps, recipe_tags). Flat
 * data, nothing computed: aisle and side come from the ingredient catalog by `pantryKey`.
 */

export const CUISINES = ["turkish", "italian", "spanish", "indian", "american", "french", "indonesian", "british"] as const;
export const CATEGORIES = ["main", "soup", "salad", "side", "dessert"] as const;
export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;
export const REGIONS = ["Ege", "Karadeniz", "Güneydoğu", "Doğu Anadolu", "İç Anadolu", "Marmara", "Akdeniz"] as const;
export const PREP_WHEN = ["night-before", "morning"] as const;

export type Cuisine = (typeof CUISINES)[number];
export type Category = (typeof CATEGORIES)[number];

/** Exact number of recipes per cuisine × category (the spec's matrix). */
export const MATRIX: Record<Cuisine, Record<Category, number>> = {
  turkish: { main: 318, soup: 174, salad: 84, side: 58, dessert: 66 },
  italian: { main: 48, soup: 7, salad: 6, side: 10, dessert: 9 },
  spanish: { main: 20, soup: 4, salad: 3, side: 14, dessert: 4 },
  indian: { main: 28, soup: 3, salad: 0, side: 10, dessert: 4 },
  american: { main: 28, soup: 2, salad: 4, side: 5, dessert: 6 },
  french: { main: 22, soup: 7, salad: 2, side: 1, dessert: 8 },
  indonesian: { main: 21, soup: 3, salad: 1, side: 0, dessert: 0 },
  british: { main: 15, soup: 0, salad: 0, side: 2, dessert: 3 },
};

/** Language-neutral flags (filters, the Supabase recipe_tags table). */
export const FLAG_TAGS = [
  "vegetarian",
  "vegan",
  "glutenFree",
  "dairyFree",
  "quick",
  "budget",
  "onePot",
  "containsAlcohol",
  "spicy",
  "kidFriendly",
  "makeAhead",
  "freezable",
  "guest",
] as const;

/** The app's own Turkish tags (filters and chips that exist today), kept so nothing disappears. */
export const APP_TAGS = [
  "Kızartma",
  "Fırında",
  "Tencere",
  "Tavada",
  "Izgara",
  "Haşlama",
  "Buharda",
  "Pişirmeden",
  "Kıymalı",
  "Etli",
  "Tavuklu",
  "Balık",
  "Vejetaryen",
  "Bakliyat",
  "Akşamdan ıslat",
  "Marine",
  "Dinlendirme",
  "Hızlı",
  "Kolay",
  "Tek tabak",
  "Meze",
  "Yoğurtlu",
  "Zeytinyağlı",
  "Pilav",
  "Hamur işi",
  "Hafif",
  "Misafir",
  "Sütlü",
  "Mevsiminde",
  "Ekonomik",
  "Şerbetli",
  "Sebzeli",
  "Sarma",
  "Önceden hazırla",
  "Közleme",
  "Hafta sonu",
  "Ekşili",
  "Dolma",
  "Acılı",
] as const;

export const TAG_VOCABULARY: readonly string[] = [...FLAG_TAGS, ...APP_TAGS];

const pantryKey = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "pantryKey must be kebab-case (e.g. red-lentil)");
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be kebab-case");
export const bilingual = z.object({ tr: z.string().trim().min(1), en: z.string().trim().min(1) }).strict();
const amount = z.number().positive().nullable().optional();
const unit = z.enum(UNITS).nullable().optional();

export const substituteSchema = z
  .object({
    name: bilingual,
    amount,
    unit,
    pantryKey,
    reason: z.literal("alcoholFree"),
    /** The note shown under the ingredient: "Şarap kullanmak istemezseniz: …". */
    note: bilingual,
  })
  .strict();

export const catalogIngredientSchema = z
  .object({
    name: bilingual,
    amount,
    unit,
    note: bilingual.nullable().optional(),
    pantryKey,
    substitute: substituteSchema.nullable().optional(),
  })
  .strict();

export const catalogStepSchema = z
  .object({
    text: bilingual,
    timerSeconds: z.number().int().positive().nullable().optional(),
  })
  .strict();

/**
 * Same meaning as the app's prep items: "night-before", "morning", or minutes before dinner
 * ("-60min"). `freezer`: the step is taking something out of the freezer.
 */
export const prepAheadSchema = z
  .object({ text: bilingual, when: z.union([z.enum(PREP_WHEN), z.string().regex(/^-\d+min$/)]), freezer: z.boolean().optional() })
  .strict();

export const catalogRecipeSchema = z
  .object({
    id: z.string().uuid(),
    slug,
    cuisine: z.enum(CUISINES),
    category: z.enum(CATEGORIES),
    region: z.enum(REGIONS).nullable().optional(),
    title: bilingual,
    /** Shorter label for chips ("Pirinç pilavı"), per language; either may be missing. */
    shortTitle: z
      .object({ tr: z.string().trim().min(1).optional(), en: z.string().trim().min(1).optional() })
      .strict()
      .nullable()
      .optional(),
    /** Required in the finished catalog; converted built-ins get theirs from the generator (`--fill`). */
    description: bilingual.optional(),
    servings: z.number().int().min(1).max(20),
    prepMinutes: z.number().int().min(0).max(1440),
    cookMinutes: z.number().int().min(0).max(1440),
    /** Marinating, resting, soaking, chilling: not part of the time to table. */
    waitMinutes: z.number().int().min(0).max(1440).nullable().optional(),
    /** A human note on the time, e.g. "45 dk (hazır mantıyla)". */
    timeNote: bilingual.nullable().optional(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    ingredients: z.array(catalogIngredientSchema).min(1),
    steps: z.array(catalogStepSchema).min(1),
    prepAhead: z.array(prepAheadSchema).optional(),
    /** pantryKey of the ingredient that comes out of the freezer the morning of, if any. */
    freezerItem: pantryKey.nullable().optional(),
    tags: z.array(z.string()),
    mealSlots: z.array(z.enum(MEAL_SLOTS)).min(1),
    leftover: z
      .object({ likelihood: z.enum(["low", "medium", "high"]), keepsDays: z.number().int().min(1).max(4), reheatable: z.boolean() })
      .strict(),
    source: z.literal("curated-v1"),
    version: z.literal(1),
  })
  .strict();

export type CatalogRecipe = z.infer<typeof catalogRecipeSchema>;
export type CatalogIngredient = z.infer<typeof catalogIngredientSchema>;

/** One row of dish-list.json: what to write, before the recipe exists. */
export const dishSchema = z
  .object({
    id: z.string().uuid(),
    slug,
    cuisine: z.enum(CUISINES),
    category: z.enum(CATEGORIES),
    region: z.enum(REGIONS).nullable().optional(),
    title: z.object({ tr: z.string().min(1), en: z.string().min(1) }).strict(),
    /** One of the app's original 100 built-ins (converted by scripts/convert-seed.ts, not generated). */
    existing: z.boolean().optional(),
    /** A hint for the writer when the name alone is ambiguous. */
    hint: z.string().optional(),
  })
  .strict();
export type Dish = z.infer<typeof dishSchema>;

/** Leftover defaults by category (the spec): the planner suggests next-day leftovers from these. */
export function defaultLeftover(category: Category): CatalogRecipe["leftover"] {
  switch (category) {
    case "salad":
      return { likelihood: "low", keepsDays: 1, reheatable: false };
    case "main":
      return { likelihood: "medium", keepsDays: 2, reheatable: true };
    case "dessert":
      return { likelihood: "high", keepsDays: 3, reheatable: false };
    default:
      return { likelihood: "high", keepsDays: 2, reheatable: true };
  }
}

/** Normalized dish name for duplicate checks: "Mercimek Çorbası" = "mercimek çorbası" = "mercimek corbasi". */
export function normalizeDishName(name: string): string {
  return name
    .toLocaleLowerCase("tr")
    .replace(/\(.*?\)/g, " ")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
