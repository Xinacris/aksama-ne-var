import type { Member, PlanItem, PrepOffset, PrepTask, Recipe, User } from "@/data/models";
import { addDays, clockTime, fromIsoDate } from "./dates";
import { genitive, lowerFirstTr } from "@/lib/text";

export const MORNING_TIME = "09:00";
export const NIGHT_BEFORE_TIME = "21:00";

function at(dateIso: string, hhmm: string): Date {
  const d = fromIsoDate(dateIso);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Offset in minutes before dinner, or null for the fixed slots. */
export function offsetMinutes(offset: PrepOffset): number | null {
  const m = /^-(\d+)min$/.exec(offset);
  return m ? Number(m[1]) : null;
}

/** When a prep item is due for a dinner on `dateIso` at `dinnerTime`. */
export function prepDueAt(dateIso: string, offset: PrepOffset, dinnerTime: string): Date {
  if (offset === "morning") return at(dateIso, MORNING_TIME);
  if (offset === "night-before") return at(addDays(dateIso, -1), NIGHT_BEFORE_TIME);
  const mins = offsetMinutes(offset) ?? 0;
  return new Date(at(dateIso, dinnerTime).getTime() - mins * 60000);
}

/** Timeline label from the design: "Sabah", "1 sa önce", "45 dk önce", "Akşamdan". */
export function offsetLabel(offset: PrepOffset): string {
  if (offset === "morning") return "Sabah";
  if (offset === "night-before") return "Akşamdan";
  const mins = offsetMinutes(offset) ?? 0;
  if (mins >= 60 && mins % 60 === 0) return `${mins / 60} sa önce`;
  if (mins > 60) return `${Math.floor(mins / 60)} sa ${mins % 60} dk önce`;
  return `${mins} dk önce`;
}

/** "Sabah 09:00", "Öğleden sonra 15:30", "Akşam 21:00" */
export function dayPartTime(d: Date): string {
  const h = d.getHours();
  const part = h < 12 ? "Sabah" : h < 17 ? "Öğleden sonra" : "Akşam";
  return `${part} ${clockTime(d)}`;
}

const ORDER: Record<string, number> = { "night-before": 0, morning: 1 };
function sortKey(offset: PrepOffset): number {
  if (offset in ORDER) return ORDER[offset];
  return 10_000 - (offsetMinutes(offset) ?? 0);
}

export function taskKey(t: Pick<PrepTask, "date" | "recipeId" | "label">): string {
  return `${t.date}|${t.recipeId}|${t.label}`;
}

export type TaskDraft = Omit<PrepTask, "id" | "createdAt" | "updatedAt"> & { id?: string };

/**
 * Regenerate prep tasks from the planned items. Tasks are assigned by
 * alternating household members in time order (first member gets the
 * first task of the day), and existing completion state is preserved.
 */
export function generatePrepTasks(args: {
  householdId: string;
  items: PlanItem[];
  recipesById: Map<string, Recipe>;
  members: Member[];
  existing: PrepTask[];
  dinnerTime: string;
  createdBy: string;
}): TaskDraft[] {
  const { items, recipesById, members, existing, dinnerTime } = args;
  const existingByKey = new Map(existing.map((t) => [taskKey(t), t]));
  const byDate = new Map<string, { recipe: Recipe; offset: PrepOffset; label: string; freezer: boolean }[]>();
  for (const item of items) {
    const recipe = recipesById.get(item.recipeId);
    if (!recipe) continue;
    for (const p of recipe.prepItems) {
      const list = byDate.get(item.date) ?? [];
      if (!list.some((x) => x.recipe.id === recipe.id && x.label === p.label)) {
        list.push({ recipe, offset: p.offset, label: p.label, freezer: !!p.freezer });
      }
      byDate.set(item.date, list);
    }
  }
  const out: TaskDraft[] = [];
  const memberIds = members.map((m) => m.userId);
  for (const [date, list] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    list.sort((a, b) => sortKey(a.offset) - sortKey(b.offset));
    list.forEach((p, idx) => {
      const key = taskKey({ date, recipeId: p.recipe.id, label: p.label });
      const prev = existingByKey.get(key);
      out.push({
        ...(prev ? { id: prev.id } : {}),
        householdId: args.householdId,
        date,
        recipeId: p.recipe.id,
        label: p.label,
        offset: p.offset,
        freezer: p.freezer,
        dueAt: prepDueAt(date, p.offset, dinnerTime).toISOString(),
        assigneeId: prev?.assigneeId ?? (memberIds.length ? memberIds[idx % memberIds.length] : null),
        status: prev?.status ?? "pending",
        doneBy: prev?.doneBy ?? null,
        doneAt: prev?.doneAt ?? null,
        createdBy: prev?.createdBy ?? args.createdBy,
      });
    });
  }
  return out;
}

/** Tasks due on the given local day (night-before tasks show up the evening before). */
export function tasksDueOn(tasks: PrepTask[], dayIso: string): PrepTask[] {
  return tasks
    .filter((t) => {
      const due = new Date(t.dueAt);
      const d = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
      return d === dayIso;
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/**
 * Today's top reminder, in due order: the first task that is still pending,
 * or that was completed recently (so the banner can show "tamamladı" with
 * an undo). If everything is long done, the last completed one is shown.
 */
export const RECENT_DONE_MS = 2 * 60 * 60 * 1000;

export function topReminder(tasks: PrepTask[], todayIso: string, nowDate: Date = new Date()): PrepTask | null {
  const today = tasksDueOn(tasks, todayIso);
  const current = today.find(
    (t) => t.status === "pending" || (t.doneAt !== null && nowDate.getTime() - new Date(t.doneAt).getTime() < RECENT_DONE_MS),
  );
  if (current) return current;
  const done = today.filter((t) => t.status === "done").sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  return done[0] ?? null;
}

const PROPER_START = ["İzmir", "Hünkar", "Rus"];

/** Dish name inside a sentence: "tavuk sote", but "İzmir köfte". */
export function dishInSentence(name: string): string {
  return PROPER_START.some((p) => name.startsWith(p)) ? name : lowerFirstTr(name);
}

const BACK_VOWELS = "aıou";
const ALL_VOWELS = "aeıioöuü";

/** Imperative → "…mayı/meyi unutma": "çıkar" → "çıkarmayı unutma". */
export function dontForget(label: string): string {
  const text = lowerFirstTr(label.trim());
  let last = "e";
  for (let i = text.length - 1; i >= 0; i--) {
    if (ALL_VOWELS.includes(text[i])) {
      last = text[i];
      break;
    }
  }
  const suffix = BACK_VOWELS.includes(last) ? "mayı" : "meyi";
  return `${text}${suffix} unutma`;
}

/** "Akşama İzmir köfte var, kıymayı buzluktan çıkarmayı unutma." */
export function reminderSentence(task: Pick<PrepTask, "label" | "date" | "dueAt">, dish: Recipe | undefined, todayIso: string): string {
  const name = dish ? dishInSentence(dish.shortName ?? dish.name) : "yemek";
  const when = task.date === todayIso ? "Akşama" : task.date === addDays(todayIso, 1) ? "Yarın akşama" : "Yakında";
  return `${when} ${name} var, ${dontForget(task.label)}.`;
}

/** "Sabah 09:00 · Ali'nin işi" */
export function reminderMeta(task: Pick<PrepTask, "dueAt" | "assigneeId">, users: Map<string, User>): string {
  const due = dayPartTime(new Date(task.dueAt));
  const who = task.assigneeId ? users.get(task.assigneeId) : undefined;
  return who ? `${due} · ${genitive(who.name)} işi` : due;
}
