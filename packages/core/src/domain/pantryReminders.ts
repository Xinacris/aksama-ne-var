import type { PantryAnswer, PantryItem, PlanDay, PlanItem, Recipe } from "../data/models";
import { intlTag, t } from "../i18n";
import { addDays, fromIsoDate, toIsoDate } from "./dates";
import { ingredientLabel } from "./recipeText";
import { recipeLabel } from "./shopping";

/**
 * Pantry reminders (Round 3.5): when to ask "evde ne var?". Pure and delivery-free, so the phone's
 * local notifications, the web's in-app banner (and a server push later) all read the same plan.
 *
 * - Week start (Monday, 10:00): "Bu hafta için evde ne var, bir bakalım mı?"
 * - A pantry day (its planned dishes use things that are at home): the evening before (20:00);
 *   if nobody answered by then, again on the morning of that day (08:30).
 * - Answering (any "var / yok / az kaldı" marked) is shared by the household: it ends that
 *   reminder for everyone, and cancels the morning one.
 */

export interface ReminderSettings {
  /** Master switch (Ayarlar). On by default. */
  enabled: boolean;
  weekStart: boolean;
  pantryDays: boolean;
}
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { enabled: true, weekStart: true, pantryDays: true };

export const REMINDER_TIMES = { weekStart: "10:00", evening: "20:00", morning: "08:30" } as const;

export type ReminderKind = "week" | "evening" | "morning";

export interface PantryReminder {
  /** Unique per delivery: "week:2026-10-12", "evening:2026-10-14", "morning:2026-10-14". */
  id: string;
  kind: ReminderKind;
  /** What answering records: "week:<monday>" or "day:<date>". */
  answerKey: string;
  /** The week's Monday, or the pantry day. */
  date: string;
  fireAt: Date;
  /** Only the relevant ingredients (canonical names), for the quick checklist. */
  ingredients: string[];
  /** The planned dishes that need them (pantry days). */
  recipeIds: string[];
}

export interface ReminderInput {
  now: Date;
  planItems: readonly Pick<PlanItem, "date" | "recipeId" | "source">[];
  planDays: readonly Pick<PlanDay, "date" | "status">[];
  recipesById: ReadonlyMap<string, Pick<Recipe, "id" | "ingredients">>;
  pantry: readonly Pick<PantryItem, "name">[];
  answers: readonly Pick<PantryAnswer, "key">[];
  settings: ReminderSettings;
  /** Days ahead to plan for (default 7). */
  horizonDays?: number;
}

export interface ReminderPlan {
  /** Still to come: what a phone schedules as local notifications. */
  scheduled: PantryReminder[];
  /** Fired and not answered: what the in-app banner / inbox shows now. */
  due: PantryReminder[];
}

function at(date: string, hhmm: string): Date {
  const d = fromIsoDate(date);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Monday of the week `iso` falls in (both languages start the week on Monday). */
export function weekStartOf(iso: string): string {
  const dow = fromIsoDate(iso).getDay();
  return addDays(iso, -((dow + 6) % 7));
}

/** A day's dishes that rely on the pantry, and which pantry items they use. Leftover dishes don't count. */
export function pantryDayNeeds(
  date: string,
  input: Pick<ReminderInput, "planItems" | "planDays" | "recipesById" | "pantry">,
): { ingredients: string[]; recipeIds: string[] } {
  if (input.planDays.some((d) => d.date === date && d.status === "ate-out")) return { ingredients: [], recipeIds: [] };
  const have = new Set(input.pantry.map((p) => p.name));
  const ingredients = new Set<string>();
  const recipeIds: string[] = [];
  for (const it of input.planItems) {
    if (it.date !== date || it.source === "leftover") continue;
    const r = input.recipesById.get(it.recipeId);
    if (!r) continue;
    const uses = r.ingredients.filter((i) => !i.staple && have.has(i.name)).map((i) => i.name);
    if (uses.length === 0) continue;
    recipeIds.push(r.id);
    for (const n of uses) ingredients.add(n);
  }
  return { ingredients: [...ingredients].sort((a, b) => a.localeCompare(b, "tr")), recipeIds };
}

export function planPantryReminders(input: ReminderInput): ReminderPlan {
  const out: ReminderPlan = { scheduled: [], due: [] };
  const { now, settings } = input;
  if (!settings.enabled) return out;
  const today = toIsoDate(now);
  const answered = new Set(input.answers.map((a) => a.key));
  const horizon = input.horizonDays ?? 7;

  if (settings.weekStart) {
    const monday = weekStartOf(today);
    for (const start of [monday, addDays(monday, 7)]) {
      const key = `week:${start}`;
      if (answered.has(key)) continue;
      const fireAt = at(start, REMINDER_TIMES.weekStart);
      // The week's relevant items: what this week's pantry days use; none planned yet → everything at home.
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => d >= today);
      const used = new Set<string>();
      const ids = new Set<string>();
      for (const d of days) {
        const n = pantryDayNeeds(d, input);
        n.ingredients.forEach((x) => used.add(x));
        n.recipeIds.forEach((x) => ids.add(x));
      }
      const ingredients = used.size ? [...used].sort((a, b) => a.localeCompare(b, "tr")) : [...new Set(input.pantry.map((p) => p.name))].sort((a, b) => a.localeCompare(b, "tr"));
      const r: PantryReminder = { id: key, kind: "week", answerKey: key, date: start, fireAt, ingredients, recipeIds: [...ids] };
      if (fireAt > now) out.scheduled.push(r);
      else if (start === monday) out.due.push(r);
    }
  }

  if (settings.pantryDays) {
    for (let i = 0; i <= horizon; i++) {
      const date = addDays(today, i);
      const answerKey = `day:${date}`;
      if (answered.has(answerKey)) continue;
      const needs = pantryDayNeeds(date, input);
      if (needs.ingredients.length === 0) continue; // no pantry dependency: no reminder
      const evening: PantryReminder = { id: `evening:${date}`, kind: "evening", answerKey, date, fireAt: at(addDays(date, -1), REMINDER_TIMES.evening), ...needs };
      const morning: PantryReminder = { id: `morning:${date}`, kind: "morning", answerKey, date, fireAt: at(date, REMINDER_TIMES.morning), ...needs };
      if (now < evening.fireAt) out.scheduled.push(evening, morning);
      else if (now < morning.fireAt) {
        out.due.push(evening);
        out.scheduled.push(morning); // cancelled once someone answers
      } else if (date === today) out.due.push(morning);
    }
  }

  out.scheduled.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  out.due.sort((a, b) => b.fireAt.getTime() - a.fireAt.getTime());
  return out;
}

/** Dish names for reminder copy: the short label ("Yayla çorbası", "Lentil soup"), so a banner stays two lines. */
export function reminderNames(recipes: readonly Pick<Recipe, "id" | "name" | "shortName">[]): Map<string, string> {
  return new Map(recipes.map((r) => [r.id, recipeLabel(r)]));
}

/** Notification / banner copy in the current language. */
export function reminderText(r: PantryReminder, names: ReadonlyMap<string, string>): { title: string; body: string } {
  if (r.kind === "week") return { title: t("pantry.remind.weekTitle"), body: t("pantry.remind.weekBody") };
  const items = r.ingredients.map((n) => ingredientLabel(n).toLocaleLowerCase(intlTag()));
  const shown = items.length > 3 ? `${items.slice(0, 3).join(", ")} +${items.length - 3}` : items.join(", ");
  const dishes = r.recipeIds.map((id) => names.get(id)).filter(Boolean).slice(0, 2).join(", ");
  return {
    title: t(r.kind === "evening" ? "pantry.remind.eveningTitle" : "pantry.remind.morningTitle"),
    body: t(r.kind === "evening" ? "pantry.remind.eveningBody" : "pantry.remind.morningBody", { dishes, items: shown }),
  };
}

/** Notification id for a scheduled reminder; carries the fire time so a moved one is rescheduled. */
export function reminderNotificationId(r: Pick<PantryReminder, "id" | "fireAt">): string {
  return `pantry:${r.id}@${r.fireAt.getTime()}`;
}

/** What a scheduler must cancel and add so the phone holds exactly `wanted` (ids from `reminderNotificationId`). */
export function reconcileReminders(scheduledIds: readonly string[], wanted: readonly PantryReminder[]): { cancel: string[]; schedule: PantryReminder[] } {
  const want = new Map(wanted.map((r) => [reminderNotificationId(r), r]));
  const have = new Set(scheduledIds.filter((id) => id.startsWith("pantry:")));
  return {
    cancel: [...have].filter((id) => !want.has(id)),
    schedule: [...want.entries()].filter(([id]) => !have.has(id)).map(([, r]) => r),
  };
}

/** The reminder an opened notification or banner points at (`?r=<id>`), recomputed from the current plan. */
export function findReminder(plan: ReminderPlan, id: string): PantryReminder | undefined {
  return [...plan.due, ...plan.scheduled].find((r) => r.id === id);
}
