import { z } from "zod";

/**
 * Entity models. Each table-like entity mirrors a future Postgres table:
 * uuid `id`, `household_id`, `created_at` / `updated_at`, `created_by`.
 * Field names are camelCase here and snake_case in supabase/schema.sql.
 */

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const isoDateTime = z.string().min(10);
export const uuid = z.string().min(1);

const base = {
  id: uuid,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
};

// ───────────────────────── recipes ─────────────────────────

export const COURSES = ["corba", "ana", "yaninda", "salata", "kahvalti", "tatli"] as const;
export const courseSchema = z.enum(COURSES);
export type Course = z.infer<typeof courseSchema>;

export const COURSE_LABEL: Record<Course, string> = {
  corba: "Çorba",
  ana: "Ana yemek",
  yaninda: "Yanında",
  salata: "Salata ve meze",
  kahvalti: "Kahvaltı ve tek tabak",
  tatli: "Tatlı",
};

export const UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "adet",
  "demet",
  "diş",
  "dilim",
  "paket",
  "kavanoz",
  "kutu",
  "yemek kaşığı",
  "tatlı kaşığı",
  "çay kaşığı",
  "su bardağı",
  "çay bardağı",
  "tutam",
] as const;
export const unitSchema = z.enum(UNITS);
export type Unit = z.infer<typeof unitSchema>;

export const sideSchema = z.enum(["pazar", "market"]);
export type Side = z.infer<typeof sideSchema>;

export const MARKET_AISLES = [
  "Kasap",
  "Süt ve kahvaltılık",
  "Bakliyat ve kuru gıda",
  "Baharat",
  "Fırın ve hamur",
  "Dondurulmuş",
  "Diğer",
] as const;
export const PAZAR_AISLES = ["Sebze", "Meyve", "Yeşillik"] as const;
export const AISLES = [...MARKET_AISLES, ...PAZAR_AISLES] as const;
export const aisleSchema = z.enum(AISLES);
export type Aisle = z.infer<typeof aisleSchema>;

export const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().nullable(),
  unit: unitSchema.nullable(),
  side: sideSchema,
  aisle: aisleSchema,
  /** Pantry staples (salt, oil, spices) never go to the list automatically. */
  staple: z.boolean().optional(),
  /** Free-text note shown after the name, e.g. "rendelenmiş". */
  note: z.string().optional(),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

/** `night-before`, `morning`, or minutes before dinner like `-60min`. */
export const prepOffsetSchema = z.union([
  z.literal("night-before"),
  z.literal("morning"),
  z.string().regex(/^-\d+min$/),
]);
export type PrepOffset = z.infer<typeof prepOffsetSchema>;

export const prepItemSchema = z.object({
  label: z.string().min(1),
  offset: prepOffsetSchema,
  /** Freezer-related prep (shown with the snowflake). */
  freezer: z.boolean().optional(),
});
export type PrepItem = z.infer<typeof prepItemSchema>;

export const SOURCE_PLATFORMS = ["instagram", "youtube", "tiktok", "web"] as const;
export const sourcePlatformSchema = z.enum(SOURCE_PLATFORMS);
export type SourcePlatform = z.infer<typeof sourcePlatformSchema>;
export const PLATFORM_LABEL: Record<SourcePlatform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  web: "Web",
};

/** "Artarsa ne olur?": artmaz / ertesi gün öğlen yenir / saklanır, X gün içinde. */
export const LEFTOVER_POLICIES = ["none", "lunch", "store"] as const;
export const leftoverPolicySchema = z.enum(LEFTOVER_POLICIES);
export type LeftoverPolicy = z.infer<typeof leftoverPolicySchema>;

export const recipeSchema = z.object({
  id: z.string().min(1),
  /** null = built-in recipe shared by all households. */
  householdId: uuid.nullable(),
  name: z.string().min(1),
  /** Shorter label for chips and list tags, e.g. "Pirinç pilavı". */
  shortName: z.string().optional(),
  course: courseSchema,
  prepMinutes: z.number().int().min(0),
  cookMinutes: z.number().int().min(0),
  /** Waiting that isn't cooking: marinating, resting, soaking, chilling. Not part of the menu's time. */
  waitMinutes: z.number().int().min(0).max(1440).optional(),
  /** Optional human override for time, e.g. "45 dk (hazır mantıyla)". */
  timeNote: z.string().optional(),
  servings: z.number().int().min(1),
  tags: z.array(z.string()),
  ingredients: z.array(ingredientSchema),
  prepItems: z.array(prepItemSchema),
  steps: z.array(z.string().min(1)),
  leftoverPolicy: leftoverPolicySchema,
  /** Days a stored leftover keeps (1–4); used when the policy is `store` or lunch falls back to the fridge. */
  leftoverDays: z.number().int().min(1).max(4),
  /** Canonical ingredient name that comes out of the freezer, if any. */
  freezerItem: z.string().nullable(),
  /** Free-text origin: "Annemin defteri". Links live in `sourceUrl`. */
  source: z.string().optional(),
  /** Imported or linked recipe: the original post, credited on the recipe page. */
  sourceUrl: z.string().url().optional(),
  /** Creator handle or name as the platform reports it ("@mutfaktaali"). */
  sourceAuthor: z.string().optional(),
  sourcePlatform: sourcePlatformSchema.optional(),
  /** The post's thumbnail as the platform gave it (link card); never downloaded or re-hosted. */
  sourceThumbnailUrl: z.string().url().optional(),
  /** The written recipe a video linked to ("Yazılı tarif"); the video stays the Kaynak. */
  writtenRecipeUrl: z.string().url().optional(),
  /** Created from an unknown name during onboarding; details not filled yet. */
  stub: z.boolean().optional(),
  createdBy: uuid.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Recipe = z.infer<typeof recipeSchema>;

// ───────────────────────── users & households ─────────────────────────

export const userSchema = z.object({
  ...base,
  email: z.string().email(),
  name: z.string().min(1),
  avatarInitial: z.string().min(1).max(2),
  passwordHash: z.string(),
  passwordSalt: z.string(),
  onboarded: z.boolean(),
});
export type User = z.infer<typeof userSchema>;

export const householdSchema = z.object({
  ...base,
  name: z.string(),
  inviteCode: z.string().min(4),
  createdBy: uuid,
  /** Dinner time, used by prep scheduling ("Sofra 19:30"). */
  dinnerTime: z.string().regex(/^\d{2}:\d{2}$/),
  /** "Öğlenleri evde yiyen var mı?" — yes / no / some days (`lunchDays`). */
  lunchAtHome: z.enum(["yes", "no", "some"]),
  /** Weekdays someone eats lunch at home when `lunchAtHome` is `some` (0 = Pazar … 6 = Cumartesi). */
  lunchDays: z.array(z.number().int().min(0).max(6)),
});
export type Household = z.infer<typeof householdSchema>;

export const memberSchema = z.object({
  ...base,
  householdId: uuid,
  userId: uuid,
  role: z.enum(["owner", "member"]),
  color: z.string(),
  createdBy: uuid,
});
export type Member = z.infer<typeof memberSchema>;

export const favoriteSchema = z.object({
  ...base,
  householdId: uuid,
  recipeId: z.string(),
  createdBy: uuid,
});
export type Favorite = z.infer<typeof favoriteSchema>;

// ───────────────────────── plan ─────────────────────────

export const SLOTS = ["corba", "ana", "yaninda", "salata"] as const;
export const slotSchema = z.enum(SLOTS);
export type Slot = z.infer<typeof slotSchema>;

export const SLOT_LABEL: Record<Slot, string> = {
  corba: "Çorba",
  ana: "Ana yemek",
  yaninda: "Yanında",
  salata: "Salata",
};
export const SLOT_SHORT: Record<Slot, string> = {
  corba: "Çorba",
  ana: "Ana",
  yaninda: "Yanında",
  salata: "Salata",
};

export const planItemSchema = z.object({
  ...base,
  householdId: uuid,
  date: isoDate,
  slot: slotSchema,
  recipeId: z.string(),
  source: z.enum(["match", "favorite", "manual", "moved", "leftover"]),
  /** For `leftover` items: the evening the dish was cooked (a dolapta dish eaten again). */
  leftoverFrom: isoDate.optional(),
  createdBy: uuid,
});
export type PlanItem = z.infer<typeof planItemSchema>;

/** Per-evening leftover choice: Hiç kalmadı · Yarın öğlen · Dolaba kaldır · Kimse yemeyecek · (dolaptaki) bitti. */
export const LEFTOVER_CHOICES = ["none", "lunch", "fridge", "discard", "eaten"] as const;
export type LeftoverChoice = (typeof LEFTOVER_CHOICES)[number];

export const planDaySchema = z.object({
  ...base,
  householdId: uuid,
  date: isoDate,
  status: z.enum(["open", "ate-out", "cooked"]),
  /** Members who approved this evening's menu. */
  approvals: z.array(uuid),
  /**
   * What happens to this evening's leftovers. null = follow the recipe default
   * and the household lunch setting; otherwise the household's choice.
   */
  leftoverChoice: z.enum(LEFTOVER_CHOICES).nullable(),
  /** Who made the choice (null when automatic). */
  leftoverChoiceBy: uuid.nullable(),
  /** Recipe names returned to matches when the day changed (for neutral copy). */
  returnedRecipeIds: z.array(z.string()),
  cookedAt: isoDateTime.nullable(),
  createdBy: uuid,
});
export type PlanDay = z.infer<typeof planDaySchema>;

export const cookLogSchema = z.object({
  ...base,
  householdId: uuid,
  recipeId: z.string(),
  date: isoDate,
  createdBy: uuid,
});
export type CookLog = z.infer<typeof cookLogSchema>;

// ───────────────────────── shopping ─────────────────────────

export const shoppingItemSchema = z.object({
  ...base,
  householdId: uuid,
  name: z.string().min(1),
  quantity: z.number().positive().nullable(),
  unit: unitSchema.nullable(),
  side: sideSchema,
  aisle: aisleSchema,
  /** Recipe this manual item was added for (from recipe detail), if any. */
  forRecipeId: z.string().nullable(),
  createdBy: uuid,
});
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;

export const shoppingCheckSchema = z.object({
  ...base,
  householdId: uuid,
  /** Stable key of the derived list row (see domain/shopping). */
  itemKey: z.string(),
  checkedBy: uuid,
  createdBy: uuid,
});
export type ShoppingCheck = z.infer<typeof shoppingCheckSchema>;

export const pantryItemSchema = z.object({
  ...base,
  householdId: uuid,
  name: z.string().min(1),
  quantity: z.number().positive().nullable(),
  unit: unitSchema.nullable(),
  createdBy: uuid,
});
export type PantryItem = z.infer<typeof pantryItemSchema>;

// ───────────────────────── prep tasks ─────────────────────────

export const prepTaskSchema = z.object({
  ...base,
  householdId: uuid,
  date: isoDate,
  recipeId: z.string(),
  label: z.string(),
  offset: prepOffsetSchema,
  freezer: z.boolean(),
  dueAt: isoDateTime,
  assigneeId: uuid.nullable(),
  status: z.enum(["pending", "done"]),
  doneBy: uuid.nullable(),
  doneAt: isoDateTime.nullable(),
  createdBy: uuid,
});
export type PrepTask = z.infer<typeof prepTaskSchema>;

// ───────────────────────── swipes & matches ─────────────────────────

export const swipeSchema = z.object({
  ...base,
  householdId: uuid,
  userId: uuid,
  recipeId: z.string(),
  date: isoDate,
  slot: slotSchema,
  decision: z.enum(["like", "pass"]),
  createdBy: uuid,
});
export type Swipe = z.infer<typeof swipeSchema>;

export const matchSchema = z.object({
  ...base,
  householdId: uuid,
  recipeId: z.string(),
  /** Day the deck was for. */
  date: isoDate,
  slot: slotSchema,
  status: z.enum(["open", "placed", "returned"]),
  placedDate: isoDate.nullable(),
  /** For returned matches: the date they came back from. */
  returnedFrom: isoDate.nullable(),
  createdBy: uuid,
});
export type Match = z.infer<typeof matchSchema>;

// ───────────────────────── cooking mode ─────────────────────────

export const cookingTimerSchema = z.object({
  id: z.string().min(1),
  recipeId: z.string(),
  /** Step index the timer was started from. */
  step: z.number().int().min(0),
  /** "Mercimek · 25 dk" — what the sticky bar shows. */
  label: z.string(),
  seconds: z.number().int().positive(),
  /** Absolute end time, so timers survive reloads and other tabs see the same countdown. */
  endsAt: isoDateTime,
  /** The cook dismissed the finished banner. */
  dismissed: z.boolean(),
});
export type CookingTimer = z.infer<typeof cookingTimerSchema>;

/** One cooking session per household and menu date (or single recipe). Shared: whoever opens it continues it. */
export const cookingSessionSchema = z.object({
  ...base,
  householdId: uuid,
  /** "2026-10-12" (that evening's menu) or a recipe id. */
  key: z.string().min(1),
  /** Who started cooking (for "Ali pişiriyor"). */
  userId: uuid,
  recipeIds: z.array(z.string()),
  phase: z.enum(["prep", "steps", "done"]),
  dishIndex: z.number().int().min(0),
  /** Current step per recipe id. */
  positions: z.record(z.string(), z.number().int().min(0)),
  /** Checked ingredient keys on the "Hazırlık" list. */
  checked: z.array(z.string()),
  timers: z.array(cookingTimerSchema),
  finishedAt: isoDateTime.nullable(),
  createdBy: uuid,
});
export type CookingSession = z.infer<typeof cookingSessionSchema>;

// ───────────────────────── recipe import ─────────────────────────

/** One successful link/caption import. No link or caption is stored: this only counts usage. */
export const importLogSchema = z.object({
  ...base,
  householdId: uuid,
  platform: sourcePlatformSchema.nullable(),
  /** Which provider made the draft; "web" = a page's schema.org/Recipe (the link itself or a "yazılı tarif" link). */
  provider: z.enum(["gemini", "claude", "web", "rules"]),
  createdBy: uuid,
});
export type ImportLog = z.infer<typeof importLogSchema>;

// ───────────────────────── activity ─────────────────────────

export const ACTIVITY_TYPES = [
  "household.joined",
  "plan.added",
  "plan.removed",
  "plan.moved",
  "plan.approved",
  "plan.ateOut",
  "plan.changed",
  "plan.leftovers",
  "match.made",
  "shopping.checked",
  "shopping.finished",
  "shopping.added",
  "prep.done",
  "recipe.created",
  "recipe.updated",
  "recipe.imported",
  "leftover.set",
  "cooking.started",
  "cooking.finished",
] as const;
export const activitySchema = z.object({
  ...base,
  householdId: uuid,
  actorId: uuid,
  type: z.enum(ACTIVITY_TYPES),
  /** Free-form params: recipeId, date, itemName, count… */
  data: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  createdBy: uuid,
});
export type Activity = z.infer<typeof activitySchema>;
export type ActivityType = Activity["type"];
