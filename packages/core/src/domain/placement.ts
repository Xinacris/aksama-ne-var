import { SLOT_LABEL, type Course, type PlanItem, type Recipe, type Slot } from "../data/models";
import { t } from "../i18n";
import { dayName } from "./dates";
import { CATEGORIES, type Category } from "../recipes/schema";
import { addToPlan, menuFor, moveItem, type PlanOp, type PlanState } from "./plan";

/**
 * Category-locked placement (Round 3.5). A dish dropped anywhere on a day lands in the slot of its
 * own category, and nowhere else: a main dish only ever fills the main slot, a soup the soup slot.
 * Everything here is pure: it reads the plan and returns the ops the store applies, plus what
 * happened, so the UI can say it ("Mercimek Salı'nın çorbası oldu; Ezogelin eşleşmelere döndü").
 */

export const CATEGORY_SLOT: Record<Category, Slot> = { main: "ana", soup: "corba", salad: "salata", side: "yaninda", dessert: "tatli" };
export const SLOT_CATEGORY: Record<Slot, Category> = { ana: "main", corba: "soup", salata: "salad", yaninda: "side", tatli: "dessert" };

/** Courses that name a slot by themselves. Breakfast / one-plate (`kahvalti`) doesn't: it could be any. */
const COURSE_SLOT: Partial<Record<Course, Slot>> = { ana: "ana", corba: "corba", yaninda: "yaninda", salata: "salata", tatli: "tatli" };
/** The course a slot's dishes carry (saving a slot answer on a placeholder recipe). */
export const SLOT_COURSE: Record<Slot, Course> = { ana: "ana", corba: "corba", yaninda: "yaninda", salata: "salata", tatli: "tatli" };

function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

/**
 * The one slot a recipe may occupy, or null when it has no category yet: a stub (its course is a
 * placeholder) or a breakfast / one-plate dish nobody has placed before. A saved answer lives in
 * the recipe's `category`, so it is asked once.
 */
export function slotForRecipe(recipe: Pick<Recipe, "course" | "category" | "stub">): Slot | null {
  if (isCategory(recipe.category)) return CATEGORY_SLOT[recipe.category];
  if (recipe.stub) return null;
  return COURSE_SLOT[recipe.course] ?? null;
}

/** Where a dragged dish comes from. */
export type DropOrigin = "match" | "recipe" | "favorite";

/** What happened to the dish that was in the target slot. */
export type Displacement =
  /** It came from the matches: it goes back there ("Salı'dan geri döndü"). */
  | { to: "matches"; itemId: string; recipeId: string }
  /** Added by hand: it leaves the day and stays in the recipes. */
  | { to: "removed"; itemId: string; recipeId: string }
  /** Moving a planned dish between days: the two swap. */
  | { to: "swapped"; itemId: string; recipeId: string; date: string };

export type DropResult =
  | { kind: "placed"; slot: Slot; ops: PlanOp[]; displaced: Displacement | null }
  /** Nothing to do: the dish is already in that slot (`same`) or elsewhere on that day (`onDay`). */
  | { kind: "noop"; reason: "same" | "onDay"; slot: Slot }
  /** The recipe has no category: ask which slot (once), then drop again with `slot`. */
  | { kind: "needsSlot" }
  /** Unknown item or recipe. */
  | { kind: "invalid" };

/** True when the planned dish came from the matches (source, or a match placed on that day). */
function fromMatches(state: PlanState, it: PlanItem): boolean {
  if (it.source === "match") return true;
  return state.matches.some((m) => m.recipeId === it.recipeId && m.status === "placed" && m.placedDate === it.date);
}

/** Ops that send a displaced dish back to the matches, visible as "returned from <day>". */
function returnToMatches(state: PlanState, it: PlanItem, by: string): PlanOp[] {
  const m =
    state.matches.find((x) => x.recipeId === it.recipeId && x.status === "placed" && x.placedDate === it.date) ??
    state.matches.find((x) => x.recipeId === it.recipeId && x.status !== "placed");
  if (m) return [{ op: "updateMatch", id: m.id, patch: { status: "returned", placedDate: null, returnedFrom: it.date } }];
  return [{ op: "addMatch", row: { recipeId: it.recipeId, date: it.date, slot: it.slot, status: "returned", placedDate: null, returnedFrom: it.date, createdBy: by } }];
}

/**
 * Drop a dish from the matches, the recipes or the frequent list onto a day. `slot` is only for a
 * recipe without a category (the answer to "which slot?"); otherwise the recipe decides.
 */
export function dropOnDay(
  state: PlanState,
  args: { date: string; recipe: Recipe; origin: DropOrigin; by: string; matchId?: string; slot?: Slot },
): DropResult {
  const slot = slotForRecipe(args.recipe) ?? args.slot ?? null;
  if (!slot) return { kind: "needsSlot" };
  const menu = menuFor(state.items, args.date);
  const existing = menu[slot];
  if (existing?.recipeId === args.recipe.id) return { kind: "noop", reason: "same", slot };
  if (state.items.some((i) => i.date === args.date && i.recipeId === args.recipe.id)) return { kind: "noop", reason: "onDay", slot };

  let displaced: Displacement | null = null;
  const ops: PlanOp[] = [];
  if (existing) {
    if (fromMatches(state, existing)) {
      displaced = { to: "matches", itemId: existing.id, recipeId: existing.recipeId };
      ops.push(...returnToMatches(state, existing, args.by));
    } else {
      displaced = { to: "removed", itemId: existing.id, recipeId: existing.recipeId };
    }
  }
  const source: PlanItem["source"] = args.origin === "match" ? "match" : args.origin === "favorite" ? "favorite" : "manual";
  // addToPlan removes the slot's current item; the match ops above only touch the match rows.
  // Without these matches, addToPlan's "match for this recipe" lookup must not pick the one just returned.
  const rest = { ...state, matches: state.matches.filter((m) => !(displaced?.to === "matches" && m.recipeId === displaced.recipeId)) };
  ops.unshift(...addToPlan(rest, { date: args.date, slot, recipeId: args.recipe.id, source, by: args.by, matchId: args.origin === "match" ? args.matchId : undefined }));
  return { kind: "placed", slot, ops, displaced };
}

/** Move a planned dish to another day: it keeps its slot there, swapping with what's in it. */
export function moveToDay(state: PlanState, args: { itemId: string; date: string; by: string }): DropResult {
  const it = state.items.find((i) => i.id === args.itemId);
  if (!it) return { kind: "invalid" };
  const recipe = state.recipesById.get(it.recipeId);
  const slot = (recipe && slotForRecipe(recipe)) ?? it.slot;
  if (it.date === args.date && it.slot === slot) return { kind: "noop", reason: "same", slot };
  if (it.date !== args.date && state.items.some((i) => i.date === args.date && i.recipeId === it.recipeId)) return { kind: "noop", reason: "onDay", slot };
  const target = menuFor(state.items, args.date)[slot];
  const ops = moveItem(state, it.id, args.date, slot, args.by);
  const displaced: Displacement | null = target && target.id !== it.id ? { to: "swapped", itemId: target.id, recipeId: target.recipeId, date: it.date } : null;
  return { kind: "placed", slot, ops, displaced };
}

/** During a drag: the one slot that will take the dish (highlighted); the rest are shown disabled. */
export function validSlot(recipe: Pick<Recipe, "course" | "category" | "stub"> | null): Slot | null {
  return recipe ? slotForRecipe(recipe) : null;
}

/** One line of feedback for a drop (both apps show it as a notice / toast and announce it). */
export function dropMessage(res: DropResult, args: { name: string; date: string; recipesById: Map<string, Recipe> }): string {
  const day = dayName(args.date);
  switch (res.kind) {
    case "invalid":
    case "needsSlot":
      return t("place.invalid");
    case "noop":
      return res.reason === "same" ? t("place.same", { name: args.name, day, slot: SLOT_LABEL[res.slot] }) : t("place.onDay", { name: args.name, day });
    case "placed": {
      const lines = [t("place.placed", { name: args.name, day, slot: SLOT_LABEL[res.slot] })];
      const d = res.displaced;
      const other = d ? (args.recipesById.get(d.recipeId)?.name ?? t("plan.deletedRecipe")) : "";
      if (d?.to === "matches") lines.push(t("place.backToMatches", { name: other }));
      else if (d?.to === "removed") lines.push(t("place.removed", { name: other }));
      else if (d?.to === "swapped") lines.push(t("place.swapped", { name: other, day: dayName(d.date) }));
      return lines.join(" ");
    }
  }
}
