import { describe, expect, it } from "vitest";
import type { PantryAnswer, PantryItem, PlanDay, PlanItem } from "@/data/models";
import {
  DEFAULT_REMINDER_SETTINGS,
  pantryDayNeeds,
  planPantryReminders,
  reconcileReminders,
  reminderNotificationId,
  reminderText,
  weekStartOf,
  type ReminderInput,
} from "@/domain/pantryReminders";
import { day, item, pantry, R, recipesById } from "@/testing/builders";

// 2026-10-12 is a Monday (Istanbul time in vitest config).
const local = (iso: string, hhmm: string) => {
  const d = new Date(`${iso}T00:00:00`);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};

const WED = "2026-10-14";
const plan: PlanItem[] = [item(WED, "ana", "Karnıyarık"), item(WED, "salata", "Çoban salata")];
const atHome: PantryItem[] = [pantry("Patlıcan", null, null), pantry("Kıyma", 500, "g"), pantry("Domates", null, null), pantry("Yumurta", 6, "adet")];

function input(now: Date, extra: Partial<ReminderInput> = {}): ReminderInput {
  return { now, planItems: plan, planDays: [], recipesById, pantry: atHome, answers: [], settings: DEFAULT_REMINDER_SETTINGS, ...extra };
}
const ids = (rs: { id: string }[]) => rs.map((r) => r.id);
const answer = (key: string): PantryAnswer => ({ id: key, householdId: "h", key, answeredAt: "2026-10-13T18:00:00.000Z", createdBy: "ali", createdAt: "x", updatedAt: "x" });

describe("pantry day needs", () => {
  it("lists only the at-home ingredients the day's dishes use", () => {
    const needs = pantryDayNeeds(WED, input(local("2026-10-12", "09:00")));
    expect(needs.ingredients).toEqual(["Domates", "Kıyma", "Patlıcan"].filter((n) => R("Karnıyarık").ingredients.some((i) => i.name === n) || R("Çoban salata").ingredients.some((i) => i.name === n)));
    expect(needs.ingredients).not.toContain("Yumurta");
    expect(needs.recipeIds).toContain(R("Karnıyarık").id);
  });

  it("a day without pantry dependency gets no reminder", () => {
    const p = planPantryReminders(input(local("2026-10-12", "09:00"), { pantry: [pantry("Yumurta", 6, "adet")] }));
    expect(ids([...p.scheduled, ...p.due]).filter((x) => x.includes(WED))).toEqual([]);
  });

  it("an eaten-out day and leftover dishes don't count", () => {
    expect(pantryDayNeeds(WED, input(local("2026-10-12", "09:00"), { planDays: [day(WED, { status: "ate-out" }) as PlanDay] })).ingredients).toEqual([]);
    const leftover = [item(WED, "ana", "Karnıyarık", { source: "leftover" })];
    expect(pantryDayNeeds(WED, input(local("2026-10-12", "09:00"), { planItems: leftover })).ingredients).toEqual([]);
  });
});

describe("evening before → unanswered → morning of", () => {
  it("before the evening: both are scheduled", () => {
    const p = planPantryReminders(input(local("2026-10-13", "12:00")));
    expect(ids(p.scheduled)).toEqual(expect.arrayContaining([`evening:${WED}`, `morning:${WED}`]));
    const eve = p.scheduled.find((r) => r.id === `evening:${WED}`)!;
    expect(eve.fireAt).toEqual(local("2026-10-13", "20:00"));
    expect(p.scheduled.find((r) => r.id === `morning:${WED}`)!.fireAt).toEqual(local(WED, "08:30"));
    expect(ids(p.due)).not.toContain(`evening:${WED}`);
  });

  it("after the evening, unanswered: the evening one is due and the morning one still scheduled", () => {
    const p = planPantryReminders(input(local("2026-10-13", "21:00")));
    expect(ids(p.due)).toContain(`evening:${WED}`);
    expect(ids(p.scheduled)).toContain(`morning:${WED}`);
  });

  it("the morning of the day, still unanswered: the morning one is due", () => {
    const p = planPantryReminders(input(local(WED, "09:00")));
    expect(ids(p.due)).toContain(`morning:${WED}`);
    expect(ids(p.due)).not.toContain(`evening:${WED}`);
  });

  it("answered in the evening: no morning reminder, nothing due", () => {
    const p = planPantryReminders(input(local("2026-10-13", "21:00"), { answers: [answer(`day:${WED}`)] }));
    expect(ids([...p.scheduled, ...p.due]).filter((x) => x.includes(WED))).toEqual([]);
  });

  it("after the day has passed nothing is due for it", () => {
    const p = planPantryReminders(input(local("2026-10-15", "09:00")));
    expect(ids(p.due).filter((x) => x.includes(WED))).toEqual([]);
  });
});

describe("week start", () => {
  it("Monday is the week start, in both languages", () => {
    expect(weekStartOf("2026-10-14")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-18")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-12")).toBe("2026-10-12");
  });

  it("week start falling on today: scheduled before 10:00, due after", () => {
    expect(ids(planPantryReminders(input(local("2026-10-12", "09:00"))).scheduled)).toContain("week:2026-10-12");
    const later = planPantryReminders(input(local("2026-10-12", "11:00")));
    expect(ids(later.due)).toContain("week:2026-10-12");
    expect(ids(later.scheduled)).toContain("week:2026-10-19");
    expect(later.due.find((r) => r.id === "week:2026-10-12")!.ingredients.length).toBeGreaterThan(0);
  });

  it("an answered week is not asked again", () => {
    const p = planPantryReminders(input(local("2026-10-12", "11:00"), { answers: [answer("week:2026-10-12")] }));
    expect(ids(p.due)).not.toContain("week:2026-10-12");
  });
});

describe("settings", () => {
  it("off: nothing; each kind can be turned off on its own", () => {
    const now = local("2026-10-13", "21:00");
    expect(planPantryReminders(input(now, { settings: { ...DEFAULT_REMINDER_SETTINGS, enabled: false } }))).toEqual({ scheduled: [], due: [] });
    const noWeek = planPantryReminders(input(now, { settings: { ...DEFAULT_REMINDER_SETTINGS, weekStart: false } }));
    expect([...noWeek.due, ...noWeek.scheduled].some((r) => r.kind === "week")).toBe(false);
    const noDays = planPantryReminders(input(now, { settings: { ...DEFAULT_REMINDER_SETTINGS, pantryDays: false } }));
    expect([...noDays.due, ...noDays.scheduled].some((r) => r.kind !== "week")).toBe(false);
  });
});

describe("delivery helpers", () => {
  it("reconcile cancels stale ids and schedules missing ones; a moved fire time is rescheduled", () => {
    const p = planPantryReminders(input(local("2026-10-13", "12:00")));
    const first = reconcileReminders([], p.scheduled);
    expect(first.cancel).toEqual([]);
    const held = first.schedule.map(reminderNotificationId);
    expect(reconcileReminders(held, p.scheduled)).toEqual({ cancel: [], schedule: [] });
    // Answered: the day's two notifications go.
    const after = planPantryReminders(input(local("2026-10-13", "12:00"), { answers: [answer(`day:${WED}`)] }));
    const r = reconcileReminders(held, after.scheduled);
    expect(r.cancel.filter((x) => x.includes(WED))).toHaveLength(2);
    // Foreign notification ids (timers) are never touched.
    expect(reconcileReminders(["timer:abc"], []).cancel).toEqual([]);
  });

  it("copy names the dishes and the items", () => {
    const p = planPantryReminders(input(local("2026-10-13", "21:00")));
    const eve = p.due.find((r) => r.kind === "evening")!;
    const text = reminderText(eve, new Map([[R("Karnıyarık").id, "Karnıyarık"]]));
    expect(text.title).toBe("Yarın için evde ne var?");
    expect(text.body).toContain("Karnıyarık");
    expect(text.body).toContain("kıyma");
  });
});
