import { describe, expect, it } from "vitest";
import { memoryStore } from "@/data/storage";
import { readHandoffs, readTimerKind, TIMER_HANDOFF_KEY, writeHandoffs, writeTimerKind } from "@/lib/devicePrefs";

describe("timer kind", () => {
  it("defaults to the phone clock where there is one, and is only ever the notification where there isn't", () => {
    const store = memoryStore();
    expect(readTimerKind(store, true)).toBe("phoneClock");
    expect(readTimerKind(store, false)).toBe("notification");
    writeTimerKind(store, "notification");
    expect(readTimerKind(store, true)).toBe("notification");
    writeTimerKind(store, "phoneClock");
    expect(readTimerKind(store, false)).toBe("notification");
  });
});

describe("hand-offs", () => {
  it("round-trips and ignores junk", () => {
    const store = memoryStore();
    expect(readHandoffs(store)).toEqual([]);
    writeHandoffs(store, ["a@2026-10-14T18:10:00.000Z"]);
    expect(readHandoffs(store)).toEqual(["a@2026-10-14T18:10:00.000Z"]);
    store.setItem(TIMER_HANDOFF_KEY, "{not json");
    expect(readHandoffs(store)).toEqual([]);
    store.setItem(TIMER_HANDOFF_KEY, JSON.stringify([1, "b@x"]));
    expect(readHandoffs(store)).toEqual(["b@x"]);
  });
});

describe("pantry reminder settings (Round 3.5)", () => {
  it("are on by default, survive a round trip and bad data", async () => {
    const { readReminderSettings, writeReminderSettings, addToIdSet, readIdSet, PANTRY_REMINDERS_KEY } = await import("@/lib/devicePrefs");
    const m = new Map<string, string>();
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(readReminderSettings(store)).toEqual({ enabled: true, weekStart: true, pantryDays: true });
    writeReminderSettings(store, { enabled: true, weekStart: false, pantryDays: true });
    expect(readReminderSettings(store).weekStart).toBe(false);
    m.set(PANTRY_REMINDERS_KEY, "{broken");
    expect(readReminderSettings(store).enabled).toBe(true);
    expect(readReminderSettings(null).enabled).toBe(true);
    addToIdSet(store, "ids", "a");
    addToIdSet(store, "ids", "b");
    addToIdSet(store, "ids", "a");
    expect(readIdSet(store, "ids")).toEqual(["b", "a"]);
  });
});
