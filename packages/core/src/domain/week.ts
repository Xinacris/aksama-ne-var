import type { Match, PlanItem, Recipe, Slot } from "../data/models";
import { SLOTS } from "../data/models";
import { intlTag, t } from "../i18n";
import { ablativeSuffix, dative } from "../lib/text";
import { addDays, boardWindow, dayName, dayShort, rangeLabel, shortDayMonth } from "./dates";
import { courseToSlot, sortMatches } from "./matching";
import { dayFor, dayNote, freezerLines, menuFor, summarizeWeek, type DayNote, type FreezerLine } from "./plan";
import { daysSinceCooked, lastCookedMap, rotationShort } from "./rotation";
import { eveningLeftover, fridgeItems, lunchOn, type EveningLeftover } from "./leftovers";
import { recipesMap, selectList, usersMap, type AppState } from "../store/app";

/** "Salı'ya kondu", "Cumartesiden geri döndü", "En son 2 ay önce". */
export function matchNote(m: Match, daysSince: number | null): string {
  if (m.status === "placed" && m.placedDate) {
    const day = dayName(m.placedDate);
    return t("match.placedOn", { day, dayDat: dative(day) });
  }
  if (m.status === "returned" && m.returnedFrom) {
    const day = dayName(m.returnedFrom);
    return t("match.returnedFrom", { day, dayAbl: `${day}${ablativeSuffix(day)}` });
  }
  const r = rotationShort(daysSince);
  return r.charAt(0).toLocaleUpperCase(intlTag()) + r.slice(1);
}

export interface SlotCell {
  item: PlanItem;
  recipe: Recipe | null;
}

export interface DayModel {
  date: string;
  short: string;
  dayMonth: string;
  dayNum: number;
  isToday: boolean;
  isPast: boolean;
  ateOut: boolean;
  cooked: boolean;
  menu: Record<Slot, SlotCell | null>;
  filled: number;
  lunch: Recipe | null;
  /** Tonight's leftovers extend to tomorrow's lunch (the board's olive link). */
  leftoverOut: boolean;
  leftover: EveningLeftover | null;
  note: DayNote;
  returnedNames: string[];
  approvals: string[];
}

export interface AsideMatch {
  match: Match;
  recipe: Recipe;
  note: string;
}

export interface WeekModel {
  dates: string[];
  range: string;
  days: DayModel[];
  summary: { planned: number; note: string };
  list: { total: number; pazar: number; market: number; partnerBought: number };
  freezer: FreezerLine[];
  matches: AsideMatch[];
  frequent: Recipe[];
  /** Dolapta dishes not yet put on an evening. */
  fridge: EveningLeftover[];
}

/** The week board / day list model (web board, web and phone day lists). */
export function buildWeek(st: AppState, offsetWeeks: number): WeekModel {
  {
    const { today, planItems, planDays, matches, recipes, prepTasks, people, me, cookLog, favorites, household } = st;
    const anchor = addDays(today, offsetWeeks * 7);
    const dates = boardWindow(anchor);
    const byId = recipesMap(recipes);
    const state = { items: planItems, days: planDays, matches, recipesById: byId };
    const memberIds = people.map((p) => p.id);

    const days: DayModel[] = dates.map((date) => {
      const d = dayFor(planDays, date);
      const menu = menuFor(planItems, date);
      const cells = Object.fromEntries(
        SLOTS.map((sl) => [sl, menu[sl] ? { item: menu[sl]!, recipe: byId.get(menu[sl]!.recipeId) ?? null } : null]),
      ) as Record<Slot, SlotCell | null>;
      const lunchSetting = household ?? { lunchAtHome: "yes" as const, lunchDays: [] };
      const lunch = lunchOn(state, lunchSetting, date, people.length, today)?.recipe ?? null;
      const leftover = eveningLeftover(state, lunchSetting, date, people.length, today);
      return {
        date,
        short: dayShort(date),
        dayMonth: shortDayMonth(date),
        dayNum: Number(date.slice(8)),
        isToday: date === today,
        isPast: date < today,
        ateOut: d?.status === "ate-out",
        cooked: d?.status === "cooked",
        menu: cells,
        filled: SLOTS.filter((sl) => cells[sl]).length,
        lunch,
        leftoverOut: leftover?.outcome.kind === "lunch",
        leftover,
        note: dayNote(state, date, memberIds, today),
        returnedNames: (d?.returnedRecipeIds ?? []).map((id) => byId.get(id)?.name ?? "").filter(Boolean),
        approvals: d?.approvals ?? [],
      };
    });

    const rows = selectList(st);
    const partnerBought = rows.filter((r) => r.checkedBy && r.checkedBy !== me?.id).length;

    const last = lastCookedMap(cookLog);
    const asideMatches = sortMatches(matches)
      .filter((m) => m.status !== "placed" || (m.placedDate !== null && dates.includes(m.placedDate)))
      .map((m) => ({ match: m, recipe: byId.get(m.recipeId)!, note: matchNote(m, daysSinceCooked(m.recipeId, last, today)) }))
      .filter((v) => v.recipe)
      .slice(0, 8);

    // "Sık yaptıklarınız": most cooked first, then favorites.
    const counts = new Map<string, number>();
    for (const c of cookLog) counts.set(c.recipeId, (counts.get(c.recipeId) ?? 0) + 1);
    const favIds = new Set(favorites.map((f) => f.recipeId));
    const frequent = [...new Set([...counts.keys(), ...favIds])]
      .map((id) => byId.get(id))
      .filter((r): r is Recipe => !!r && courseToSlot(r.course) !== null)
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || (favIds.has(b.id) ? 1 : 0) - (favIds.has(a.id) ? 1 : 0) || a.name.localeCompare(b.name, "tr"))
      .slice(0, 8);

    return {
      dates,
      range: rangeLabel(dates[0], dates[6]),
      days,
      summary: summarizeWeek(state, dates, today),
      list: {
        total: rows.length,
        pazar: rows.filter((r) => r.side === "pazar").length,
        market: rows.filter((r) => r.side === "market").length,
        partnerBought,
      },
      freezer: freezerLines(prepTasks, dates, byId, usersMap(people)),
      matches: asideMatches,
      frequent,
      fridge: household ? fridgeItems(state, household, today, people.length).filter((f) => !f.plannedDate) : [],
    };
  }
}
