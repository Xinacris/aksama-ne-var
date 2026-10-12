import { describe, expect, it } from "vitest";
import type { Member, PrepTask } from "@/data/models";
import {
  dayPartTime,
  dontForget,
  generatePrepTasks,
  offsetLabel,
  prepDueAt,
  reminderMeta,
  reminderSentence,
  tasksDueOn,
  topReminder,
} from "@/domain/prep";
import { item, R, recipesById, user } from "./helpers";

const members: Member[] = [
  { id: "m1", householdId: "h", userId: "ali", role: "owner", color: "#55612A", createdBy: "ali", createdAt: "1", updatedAt: "1" },
  { id: "m2", householdId: "h", userId: "zeynep", role: "member", color: "#9A5512", createdBy: "zeynep", createdAt: "2", updatedAt: "2" },
];

const local = (d: Date) => `${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

describe("prep scheduling", () => {
  it("computes due times from offsets and dinner time", () => {
    expect(local(prepDueAt("2026-10-12", "morning", "19:30"))).toBe("12 09:00");
    expect(local(prepDueAt("2026-10-12", "-60min", "19:30"))).toBe("12 18:30");
    expect(local(prepDueAt("2026-10-12", "-45min", "19:30"))).toBe("12 18:45");
    expect(local(prepDueAt("2026-10-15", "night-before", "19:30"))).toBe("14 21:00");
    expect(local(prepDueAt("2026-11-01", "night-before", "20:00"))).toBe("31 21:00");
  });

  it("labels offsets like the design timeline", () => {
    expect(offsetLabel("morning")).toBe("Sabah");
    expect(offsetLabel("-60min")).toBe("1 sa önce");
    expect(offsetLabel("-45min")).toBe("45 dk önce");
    expect(offsetLabel("-90min")).toBe("1 sa 30 dk önce");
    expect(offsetLabel("night-before")).toBe("Akşamdan");
  });

  it("generates tasks for a menu, alternating members in time order", () => {
    const items = [item("2026-10-12", "ana", "İzmir köfte"), item("2026-10-12", "yaninda", "Tereyağlı pirinç pilavı")];
    const tasks = generatePrepTasks({
      householdId: "h",
      items,
      recipesById,
      members,
      existing: [],
      dinnerTime: "19:30",
      createdBy: "ali",
    });
    expect(tasks.map((t) => [t.label, t.assigneeId])).toEqual([
      ["Kıymayı buzluktan çıkar", "ali"],
      ["Köfte harcını yoğur, buzdolabında dinlendir", "zeynep"],
      ["Pirinci ılık tuzlu suda beklet", "ali"],
    ]);
    expect(tasks[0].freezer).toBe(true);
    expect(tasks.every((t) => t.status === "pending")).toBe(true);
  });

  it("preserves completion state when regenerating", () => {
    const items = [item("2026-10-12", "ana", "İzmir köfte")];
    const first = generatePrepTasks({ householdId: "h", items, recipesById, members, existing: [], dinnerTime: "19:30", createdBy: "ali" });
    const done: PrepTask = { ...first[0], id: "t1", createdAt: "", updatedAt: "", status: "done", doneBy: "ali", doneAt: "2026-10-12T06:12:00.000Z" };
    const again = generatePrepTasks({ householdId: "h", items, recipesById, members, existing: [done], dinnerTime: "19:30", createdBy: "ali" });
    expect(again[0]).toMatchObject({ id: "t1", status: "done", doneBy: "ali" });
  });

  it("skips recipes that were deleted", () => {
    const items = [{ ...item("2026-10-12", "ana", "İzmir köfte"), recipeId: "gone" }];
    expect(generatePrepTasks({ householdId: "h", items, recipesById, members, existing: [], dinnerTime: "19:30", createdBy: "ali" })).toEqual([]);
  });

  it("works for a solo household and no members", () => {
    const items = [item("2026-10-12", "ana", "İzmir köfte")];
    const solo = generatePrepTasks({ householdId: "h", items, recipesById, members: [members[0]], existing: [], dinnerTime: "19:30", createdBy: "ali" });
    expect(solo.every((t) => t.assigneeId === "ali")).toBe(true);
    const none = generatePrepTasks({ householdId: "h", items, recipesById, members: [], existing: [], dinnerTime: "19:30", createdBy: "ali" });
    expect(none.every((t) => t.assigneeId === null)).toBe(true);
  });
});

describe("reminders", () => {
  const items = [item("2026-10-12", "ana", "İzmir köfte"), item("2026-10-13", "ana", "Kuru fasulye")];
  const drafts = generatePrepTasks({ householdId: "h", items, recipesById, members, existing: [], dinnerTime: "19:30", createdBy: "ali" });
  const tasks: PrepTask[] = drafts.map((d, i) => ({ ...d, id: `t${i}`, createdAt: "", updatedAt: "" }));

  it("shows night-before tasks on the evening before", () => {
    const today = tasksDueOn(tasks, "2026-10-12").map((t) => t.label);
    expect(today).toContain("Fasulyeyi ıslatmaya koy");
    expect(today[0]).toBe("Kıymayı buzluktan çıkar");
  });

  it("picks the earliest pending task, else the last completed", () => {
    const at = new Date(2026, 9, 12, 8, 0);
    expect(topReminder(tasks, "2026-10-12", at)?.label).toBe("Kıymayı buzluktan çıkar");
    const allDone = tasks.map((t) => ({ ...t, status: "done" as const, doneAt: t.dueAt, doneBy: "ali" }));
    expect(topReminder(allDone, "2026-10-12", new Date(2026, 9, 13, 1, 0))?.label).toBe("Fasulyeyi ıslatmaya koy");
    expect(topReminder([], "2026-10-12", at)).toBeNull();
  });

  it("keeps a just-completed task in the banner so it can be undone", () => {
    const doneAt = new Date(2026, 9, 12, 9, 12).toISOString();
    const withDone = tasks.map((t) => (t.label === "Kıymayı buzluktan çıkar" ? { ...t, status: "done" as const, doneAt, doneBy: "ali" } : t));
    expect(topReminder(withDone, "2026-10-12", new Date(2026, 9, 12, 9, 30))?.label).toBe("Kıymayı buzluktan çıkar");
    expect(topReminder(withDone, "2026-10-12", new Date(2026, 9, 12, 15, 0))?.label).toBe("Köfte harcını yoğur, buzdolabında dinlendir");
  });

  it("writes the design's reminder sentence", () => {
    const t = tasks.find((x) => x.label === "Kıymayı buzluktan çıkar")!;
    expect(reminderSentence(t, R("İzmir köfte"), "2026-10-12")).toBe(
      "Akşama İzmir köfte var, kıymayı buzluktan çıkarmayı unutma.",
    );
    const f = tasks.find((x) => x.label === "Fasulyeyi ıslatmaya koy")!;
    expect(reminderSentence(f, R("Kuru fasulye"), "2026-10-12")).toBe(
      "Yarın akşama kuru fasulye var, fasulyeyi ıslatmaya koymayı unutma.",
    );
    const users = new Map([["ali", user("ali", "Ali")], ["zeynep", user("zeynep", "Zeynep")]]);
    expect(reminderMeta(t, users)).toBe("Sabah 09:00 · Ali'nin işi");
  });

  it("builds negative infinitives with vowel harmony", () => {
    expect(dontForget("Patlıcanları alacalı soyup tuzla")).toBe("patlıcanları alacalı soyup tuzlamayı unutma");
    expect(dontForget("Pirinci ılık tuzlu suda beklet")).toBe("pirinci ılık tuzlu suda bekletmeyi unutma");
    expect(dayPartTime(new Date(2026, 9, 12, 18, 30))).toBe("Akşam 18:30");
  });
});
