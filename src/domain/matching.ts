import type { Course, Favorite, Match, Recipe, Slot, Swipe } from "@/data/models";

export const DECK_SIZE = 12;

/** Which recipe courses can fill a menu slot. */
export const SLOT_COURSES: Record<Slot, Course[]> = {
  corba: ["corba"],
  ana: ["ana", "kahvalti"],
  yaninda: ["yaninda"],
  salata: ["salata"],
};

export function courseToSlot(course: Course): Slot | null {
  for (const [slot, courses] of Object.entries(SLOT_COURSES) as [Slot, Course[]][]) {
    if (courses.includes(course)) return slot;
  }
  return null;
}

/**
 * Household deck for a day/slot: favorites first, then everything else;
 * within each group, dishes not made recently (or never) come first.
 * Dishes already planned this week or already matched for this day are
 * left out. Deterministic, so both members see the same deck.
 */
export function buildDeck(args: {
  recipes: Recipe[];
  favorites: Favorite[];
  lastCooked: Map<string, string>;
  slot: Slot;
  date: string;
  plannedRecipeIds: Set<string>;
  matches: Match[];
  size?: number;
}): Recipe[] {
  const fav = new Set(args.favorites.map((f) => f.recipeId));
  const matchedHere = new Set(
    args.matches.filter((m) => m.date === args.date && m.slot === args.slot).map((m) => m.recipeId),
  );
  const courses = SLOT_COURSES[args.slot];
  const candidates = args.recipes.filter(
    (r) => courses.includes(r.course) && !args.plannedRecipeIds.has(r.id) && !matchedHere.has(r.id),
  );
  const score = (r: Recipe) => {
    const last = args.lastCooked.get(r.id);
    // Never cooked sorts as the oldest.
    return last ?? "0000-00-00";
  };
  candidates.sort((a, b) => {
    const fa = fav.has(a.id) ? 0 : 1;
    const fb = fav.has(b.id) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa.localeCompare(sb);
    return a.name.localeCompare(b.name, "tr");
  });
  return candidates.slice(0, args.size ?? DECK_SIZE);
}

export function swipesFor(swipes: Swipe[], date: string, slot: Slot, userId?: string): Swipe[] {
  return swipes.filter((s) => s.date === date && s.slot === slot && (!userId || s.userId === userId));
}

/** Next card this member hasn't decided on yet. */
export function nextCard(deck: Recipe[], mySwipes: Swipe[]): Recipe | null {
  const done = new Set(mySwipes.map((s) => s.recipeId));
  return deck.find((r) => !done.has(r.id)) ?? null;
}

/** How many of the deck's cards a member has swiped. */
export function progress(deck: Recipe[], swipes: Swipe[]): number {
  const ids = new Set(deck.map((r) => r.id));
  return new Set(swipes.filter((s) => ids.has(s.recipeId)).map((s) => s.recipeId)).size;
}

/** A match happens when every household member liked the same card. */
export function isMatch(swipes: Swipe[], recipeId: string, date: string, slot: Slot, memberIds: string[]): boolean {
  if (memberIds.length === 0) return false;
  return memberIds.every((uid) =>
    swipes.some(
      (s) => s.userId === uid && s.recipeId === recipeId && s.date === date && s.slot === slot && s.decision === "like",
    ),
  );
}

/** Open matches first (newest first), then placed ones; returned ones count as open. */
export function sortMatches(matches: Match[]): Match[] {
  const rank = (m: Match) => (m.status === "placed" ? 1 : 0);
  return [...matches].sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt));
}
