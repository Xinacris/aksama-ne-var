import { intlTag, t as tx } from "../i18n";
import type { CookLog, LeftoverChoice, Match, PlanDay, PlanItem, PrepTask, Recipe, Slot, User } from "../data/models";
import { SLOTS } from "../data/models";
import { addDays, dayName, dayShort, fromIsoDate } from "./dates";
import { formatIngredientQuantity } from "./shopping";
import { ingredientLabel } from "./recipeText";

/**
 * Plan transitions are pure: they read the current state and return the
 * list of operations the store applies through the repositories.
 */
export type PlanOp =
  | { op: "addItem"; row: Omit<PlanItem, "id" | "createdAt" | "updatedAt" | "householdId"> }
  | { op: "updateItem"; id: string; patch: Partial<Pick<PlanItem, "date" | "slot" | "recipeId" | "source">> }
  | { op: "removeItem"; id: string }
  | { op: "upsertDay"; date: string; patch: Partial<Pick<PlanDay, "status" | "approvals" | "leftoverChoice" | "leftoverChoiceBy" | "returnedRecipeIds" | "cookedAt">> }
  | { op: "addMatch"; row: Omit<Match, "id" | "createdAt" | "updatedAt" | "householdId"> }
  | { op: "updateMatch"; id: string; patch: Partial<Pick<Match, "status" | "placedDate" | "returnedFrom">> }
  | { op: "addCookLog"; row: Omit<CookLog, "id" | "createdAt" | "updatedAt" | "householdId"> };

export interface PlanState {
  items: PlanItem[];
  days: PlanDay[];
  matches: Match[];
  recipesById: Map<string, Recipe>;
}

export type Menu = Partial<Record<Slot, PlanItem>>;

export function menuFor(items: PlanItem[], date: string): Menu {
  const menu: Menu = {};
  for (const it of items
    .filter((i) => i.date === date)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    menu[it.slot] = it;
  }
  return menu;
}

export function menuItems(menu: Menu): PlanItem[] {
  return SLOTS.map((s) => menu[s]).filter((x): x is PlanItem => !!x);
}

export function dayFor(days: PlanDay[], date: string): PlanDay | undefined {
  return days.find((d) => d.date === date);
}

export function isPlanned(items: PlanItem[], days: PlanDay[], date: string): boolean {
  return dayFor(days, date)?.status !== "ate-out" && items.some((i) => i.date === date);
}

/** "İzmir köfte sofrası" — titled after the main dish. */
export function menuTitle(menu: Menu, recipesById: Map<string, Recipe>): string {
  const main = menu.ana ?? menu.corba ?? menu.yaninda ?? menu.salata;
  const r = main ? recipesById.get(main.recipeId) : undefined;
  return r ? tx("plan.menuTitle", { dish: r.shortName ?? r.name }) : tx("plan.eveningMenu");
}

/** "Karnıyarık · cacık · şehriyeli pilav": main first, at most three dishes (as in the Yarın card). */
export function menuLine(menu: Menu, recipesById: Map<string, Recipe>): string {
  const order: Slot[] = ["ana", "salata", "yaninda", "corba"];
  return order
    .map((s) => menu[s])
    .filter((x): x is PlanItem => !!x)
    .slice(0, 3)
    .map((it, idx) => {
      const r = recipesById.get(it.recipeId);
      const n = r ? r.shortName ?? r.name : tx("plan.deletedRecipe");
      return idx === 0 ? n : n.charAt(0).toLocaleLowerCase(intlTag()) + n.slice(1);
    })
    .join(" · ");
}

export function totalMinutes(menu: Menu, recipesById: Map<string, Recipe>): number {
  // Dishes are cooked in parallel; the longest sets the pace, plus five minutes to bring it together (design: köfte menu ≈ 1 sa 15 dk).
  const times = menuItems(menu)
    .map((i) => recipesById.get(i.recipeId))
    .filter((r): r is Recipe => !!r)
    .map((r) => r.prepMinutes + r.cookMinutes);
  if (times.length === 0) return 0;
  return Math.max(...times) + (times.length > 1 ? 5 : 0);
}

// ───────────────────────── transitions ─────────────────────────

function matchFor(state: PlanState, recipeId: string): Match | undefined {
  return state.matches
    .filter((m) => m.recipeId === recipeId && m.status !== "placed")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

/** Put a dish into a day's slot (replacing whatever was there). */
export function addToPlan(
  state: PlanState,
  args: { date: string; slot: Slot; recipeId: string; source: PlanItem["source"]; by: string; matchId?: string; leftoverFrom?: string },
): PlanOp[] {
  const ops: PlanOp[] = [];
  const menu = menuFor(state.items, args.date);
  const existing = menu[args.slot];
  if (existing) ops.push({ op: "removeItem", id: existing.id });
  ops.push({
    op: "addItem",
    row: {
      date: args.date,
      slot: args.slot,
      recipeId: args.recipeId,
      source: args.source,
      ...(args.leftoverFrom ? { leftoverFrom: args.leftoverFrom } : {}),
      createdBy: args.by,
    },
  });
  const day = dayFor(state.days, args.date);
  const patch: Extract<PlanOp, { op: "upsertDay" }>["patch"] = { approvals: [args.by] };
  if (day?.status === "ate-out") patch.status = "open";
  // A new main dish: its leftovers follow the defaults again.
  if (args.slot === "ana") Object.assign(patch, { leftoverChoice: null, leftoverChoiceBy: null });
  ops.push({ op: "upsertDay", date: args.date, patch });
  if (args.source === "leftover") return ops;
  const match = args.matchId ? state.matches.find((m) => m.id === args.matchId) : matchFor(state, args.recipeId);
  if (match) ops.push({ op: "updateMatch", id: match.id, patch: { status: "placed", placedDate: args.date } });
  return ops;
}

export function removeFromPlan(state: PlanState, itemId: string, by: string): PlanOp[] {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return [];
  const ops: PlanOp[] = [{ op: "removeItem", id: itemId }];
  const patch: Extract<PlanOp, { op: "upsertDay" }>["patch"] = { approvals: [by] };
  if (item.slot === "ana") Object.assign(patch, { leftoverChoice: null, leftoverChoiceBy: null });
  ops.push({ op: "upsertDay", date: item.date, patch });
  const placed = state.matches.find((m) => m.recipeId === item.recipeId && m.status === "placed" && m.placedDate === item.date);
  if (placed) ops.push({ op: "updateMatch", id: placed.id, patch: { status: "open", placedDate: null } });
  return ops;
}

/** Drag a planned dish to another day/slot; swaps with what's already there. */
export function moveItem(state: PlanState, itemId: string, toDate: string, toSlot: Slot, by: string): PlanOp[] {
  const item = state.items.find((i) => i.id === itemId);
  if (!item || (item.date === toDate && item.slot === toSlot)) return [];
  const ops: PlanOp[] = [];
  const target = menuFor(state.items, toDate)[toSlot];
  ops.push({ op: "updateItem", id: item.id, patch: { date: toDate, slot: toSlot, source: "moved" } });
  if (target) ops.push({ op: "updateItem", id: target.id, patch: { date: item.date, slot: item.slot, source: "moved" } });
  for (const d of new Set([item.date, toDate])) {
    const patch: Extract<PlanOp, { op: "upsertDay" }>["patch"] = { approvals: [by] };
    if (dayFor(state.days, d)?.status === "ate-out") patch.status = "open";
    ops.push({ op: "upsertDay", date: d, patch });
  }
  for (const m of state.matches) {
    if (m.status === "placed" && m.recipeId === item.recipeId && m.placedDate === item.date) {
      ops.push({ op: "updateMatch", id: m.id, patch: { placedDate: toDate } });
    }
  }
  return ops;
}

function returnMainToMatches(state: PlanState, date: string, menu: Menu, by: string): PlanOp[] {
  const ops: PlanOp[] = [];
  const main = menu.ana;
  if (!main) return ops;
  const existing = state.matches.find((m) => m.recipeId === main.recipeId && (m.placedDate === date || m.status !== "placed"));
  if (existing) {
    ops.push({ op: "updateMatch", id: existing.id, patch: { status: "returned", placedDate: null, returnedFrom: date } });
  } else {
    ops.push({
      op: "addMatch",
      row: { recipeId: main.recipeId, date, slot: "ana", status: "returned", placedDate: null, returnedFrom: date, createdBy: by },
    });
  }
  return ops;
}

/**
 * "Bugün dışarıda yedik": the evening is marked neutrally, the main dish
 * goes back to the matches, ingredients stay on the list.
 */
export function markAteOut(state: PlanState, date: string, by: string): PlanOp[] {
  const menu = menuFor(state.items, date);
  const ops: PlanOp[] = menuItems(menu).map((i) => ({ op: "removeItem" as const, id: i.id }));
  ops.push(...returnMainToMatches(state, date, menu, by));
  ops.push({
    op: "upsertDay",
    date,
    patch: { status: "ate-out", approvals: [], leftoverChoice: null, leftoverChoiceBy: null, returnedRecipeIds: menu.ana ? [menu.ana.recipeId] : [] },
  });
  return ops;
}

/** Undo "dışarıda yedik": the day becomes an empty, open evening. */
export function clearAteOut(date: string): PlanOp[] {
  return [{ op: "upsertDay", date, patch: { status: "open", returnedRecipeIds: [] } }];
}

/** "Plan değişti" → "Eşleşmelere geri gönder". */
export function sendBackToMatches(state: PlanState, date: string, by: string): PlanOp[] {
  const menu = menuFor(state.items, date);
  const ops: PlanOp[] = menuItems(menu).map((i) => ({ op: "removeItem" as const, id: i.id }));
  ops.push(...returnMainToMatches(state, date, menu, by));
  ops.push({
    op: "upsertDay",
    date,
    patch: { status: "open", approvals: [], leftoverChoice: null, leftoverChoiceBy: null, returnedRecipeIds: menu.ana ? [menu.ana.recipeId] : [] },
  });
  return ops;
}

/** "Plan değişti" → "Yarına taşı": swap with tomorrow when tomorrow is planned. */
export function moveDayToTomorrow(state: PlanState, date: string, by: string): PlanOp[] {
  const tomorrow = addDays(date, 1);
  const today = menuItems(menuFor(state.items, date));
  const next = menuItems(menuFor(state.items, tomorrow));
  const ops: PlanOp[] = [];
  for (const i of today) ops.push({ op: "updateItem", id: i.id, patch: { date: tomorrow, source: "moved" } });
  for (const i of next) ops.push({ op: "updateItem", id: i.id, patch: { date, source: "moved" } });
  const dToday = dayFor(state.days, date);
  const dNext = dayFor(state.days, tomorrow);
  ops.push({
    op: "upsertDay",
    date: tomorrow,
    patch: { status: "open", approvals: [by], leftoverChoice: dToday?.leftoverChoice ?? null, leftoverChoiceBy: dToday?.leftoverChoiceBy ?? null, returnedRecipeIds: [] },
  });
  ops.push({
    op: "upsertDay",
    date,
    patch: {
      status: "open",
      approvals: next.length ? [by] : [],
      leftoverChoice: dNext?.leftoverChoice ?? null,
      leftoverChoiceBy: dNext?.leftoverChoiceBy ?? null,
      returnedRecipeIds: [],
    },
  });
  for (const m of state.matches) {
    if (m.status !== "placed") continue;
    if (m.placedDate === date) ops.push({ op: "updateMatch", id: m.id, patch: { placedDate: tomorrow } });
    else if (m.placedDate === tomorrow) ops.push({ op: "updateMatch", id: m.id, patch: { placedDate: date } });
  }
  return ops;
}

export function approve(state: PlanState, date: string, userId: string): PlanOp[] {
  const day = dayFor(state.days, date);
  const approvals = new Set(day?.approvals ?? []);
  approvals.add(userId);
  return [{ op: "upsertDay", date, patch: { approvals: [...approvals] } }];
}

/** Per-evening leftover choice; null returns to the defaults. */
export function setLeftoverChoice(date: string, choice: LeftoverChoice | null, by: string): PlanOp[] {
  return [{ op: "upsertDay", date, patch: { leftoverChoice: choice, leftoverChoiceBy: choice === null ? null : by } }];
}

/**
 * Put a dolapta dish on an evening: a normal plan item marked `leftover`,
 * so the list, prep tasks and cook log skip it.
 */
export function placeLeftover(state: PlanState, args: { fromDate: string; recipeId: string; toDate: string; slot: Slot; by: string }): PlanOp[] {
  return addToPlan(state, { date: args.toDate, slot: args.slot, recipeId: args.recipeId, source: "leftover", by: args.by, leftoverFrom: args.fromDate });
}

/** "Afiyet olsun": tonight is cooked now (cook log + status), instead of waiting for tomorrow's rollover. */
export function markCooked(state: PlanState, cookLog: CookLog[], date: string, by: string, nowIso: string): { ops: PlanOp[]; cooked: { date: string; recipeId: string }[] } {
  const ops: PlanOp[] = [];
  const cooked: { date: string; recipeId: string }[] = [];
  for (const it of menuItems(menuFor(state.items, date))) {
    if (it.source === "leftover") continue;
    if (!cookLog.some((c) => c.recipeId === it.recipeId && c.date === date)) {
      ops.push({ op: "addCookLog", row: { recipeId: it.recipeId, date, createdBy: by } });
      cooked.push({ date, recipeId: it.recipeId });
    }
  }
  ops.push({ op: "upsertDay", date, patch: { status: "cooked", cookedAt: nowIso } });
  return { ops, cooked };
}

/**
 * Past evenings that were planned and not eaten out count as cooked:
 * they get a cook log (rotation memory) and status "cooked".
 */
export function rollover(
  state: PlanState,
  cookLog: CookLog[],
  todayIso: string,
  by: string,
  nowIso: string,
): { ops: PlanOp[]; cooked: { date: string; recipeId: string }[] } {
  const ops: PlanOp[] = [];
  const cooked: { date: string; recipeId: string }[] = [];
  const pastDates = [...new Set(state.items.map((i) => i.date))].filter((d) => d < todayIso).sort();
  for (const date of pastDates) {
    const day = dayFor(state.days, date);
    if (day?.status === "ate-out" || day?.status === "cooked") continue;
    for (const it of menuItems(menuFor(state.items, date))) {
      if (it.source === "leftover") continue; // eaten again, not cooked
      if (!cookLog.some((c) => c.recipeId === it.recipeId && c.date === date)) {
        ops.push({ op: "addCookLog", row: { recipeId: it.recipeId, date, createdBy: by } });
        cooked.push({ date, recipeId: it.recipeId });
      }
    }
    ops.push({ op: "upsertDay", date, patch: { status: "cooked", cookedAt: nowIso } });
  }
  return { ops, cooked };
}

// ───────────────────────── summaries ─────────────────────────

export interface WeekSummary {
  planned: number;
  note: string;
}

/** "5 akşam planlı" + "Cumartesi dışarıda · Cuma henüz boş" */
export function summarizeWeek(state: PlanState, dates: string[], todayIso: string): WeekSummary {
  let planned = 0;
  const ateOut: string[] = [];
  const empty: string[] = [];
  for (const d of dates) {
    const day = dayFor(state.days, d);
    if (day?.status === "ate-out") ateOut.push(dayName(d));
    else if (state.items.some((i) => i.date === d)) planned++;
    else if (d >= todayIso) empty.push(dayName(d));
  }
  const parts: string[] = [];
  if (ateOut.length) parts.push(tx("plan.weekAteOut", { days: ateOut.join(", ") }));
  if (empty.length) parts.push(tx("plan.weekEmpty", { days: empty.join(", ") }));
  return { planned, note: parts.join(" · ") || tx("plan.weekAllSet") };
}

export interface FreezerLine {
  taskId: string;
  text: string;
  done: boolean;
  who: string;
}

/** "Bu hafta buzluktan çıkacaklar": "Kıyma 500 g · Pzt sabah". */
export function freezerLines(tasks: PrepTask[], dates: string[], recipesById: Map<string, Recipe>, users: Map<string, User>): FreezerLine[] {
  return tasks
    .filter((t) => t.freezer && dates.includes(t.date))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .map((t) => {
      const recipe = recipesById.get(t.recipeId);
      const ing = recipe?.ingredients.find((i) => i.name === recipe.freezerItem);
      const qty = ing ? formatIngredientQuantity(ing) : "";
      const due = new Date(t.dueAt);
      const dueIso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
      const part = tx(due.getHours() < 12 ? "plan.part.morning" : due.getHours() < 17 ? "plan.part.noon" : "plan.part.evening");
      const name = recipe?.freezerItem ? ingredientLabel(recipe.freezerItem) : t.label;
      const who = users.get((t.status === "done" ? t.doneBy : t.assigneeId) ?? "")?.name ?? "";
      return {
        taskId: t.id,
        text: `${name}${qty ? ` ${qty}` : ""} · ${dayShort(dueIso)} ${part}`,
        done: t.status === "done",
        who,
      };
    });
}

export type DayNote =
  | { kind: "cooked" }
  | { kind: "approved" }
  | { kind: "match" }
  | { kind: "light" }
  | { kind: "addedBy"; userId: string }
  | { kind: "empty" }
  | { kind: "none" };

/** Footer line under each board day ("Pişti", "Onaylandı", "Eşleşmeden"…). */
export function dayNote(state: PlanState, date: string, memberIds: string[], todayIso: string): DayNote {
  const day = dayFor(state.days, date);
  const items = menuItems(menuFor(state.items, date));
  if (day?.status === "ate-out") return { kind: "none" };
  if (items.length === 0) return date >= todayIso ? { kind: "empty" } : { kind: "none" };
  if (day?.status === "cooked" || date < todayIso) return { kind: "cooked" };
  if (memberIds.length > 0 && memberIds.every((m) => day?.approvals.includes(m))) return { kind: "approved" };
  const menu = menuFor(state.items, date);
  if (menu.ana?.source === "match") return { kind: "match" };
  if (items.length <= 2) return { kind: "light" };
  const by = menu.ana?.createdBy ?? items[0].createdBy;
  return { kind: "addedBy", userId: by };
}

/** Weekday of an ISO date in the dative for activity copy: "Perşembe'ye". */
export function weekdayIndex(iso: string): number {
  return fromIsoDate(iso).getDay();
}
