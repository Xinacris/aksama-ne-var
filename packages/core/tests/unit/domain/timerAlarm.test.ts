import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CookingTimer } from "@/data/models";
import { addTimerTime, isFinished, newTimer, pauseTimer, remainingSeconds, restartTimer, resumeTimer, visibleTimers } from "@/domain/cooking";
import {
  ALARM_MAX_MS,
  ALARM_TONE,
  ALARM_TONE_MS,
  alarmSchedule,
  dismissDue,
  dueTimers,
  finishKey,
  finishUuid,
  initialAlarm,
  liveFinishKeys,
  nextHandoffs,
  reconcileSchedule,
  silenceAlarm,
  stepAlarm,
  type AlarmState,
} from "@/domain/timerAlarm";
import { R } from "@/testing/builders";

const kofte = R("İzmir köfte");
const START = new Date("2026-10-14T18:00:00.000Z");
const at = (sec: number) => new Date(START.getTime() + sec * 1000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => vi.useRealTimers());

function timer(id: string, seconds: number, now = START): CookingTimer {
  return newTimer({ id, recipe: kofte, step: 0, seconds, now });
}

/** Run the alarm like a device does: a tick every `every` seconds from `from` to `to`. */
function run(state: AlarmState, timers: () => CookingTimer[], from: number, to: number, every = 1) {
  const rings: { at: number; keys: string[] }[] = [];
  for (let s = from; s <= to; s += every) {
    vi.setSystemTime(at(s));
    const next = stepAlarm(state, timers(), new Date());
    if (next.ringing.length && next.since !== state.since) rings.push({ at: s, keys: next.ringing });
    state = next;
  }
  return { state, rings };
}

describe("finished comes from endsAt", () => {
  it("is not finished before endsAt and finished at it, with no ticking in between", () => {
    const t = timer("a", 60);
    expect(isFinished(t, at(59))).toBe(false);
    expect(isFinished(t, at(60))).toBe(true);
    // App closed for an hour: one look is enough.
    expect(dueTimers([t], at(3600)).map((x) => x.id)).toEqual(["a"]);
  });

  it("rings exactly once per finish, however many ticks follow", () => {
    const t = timer("a", 30);
    const { rings, state } = run(initialAlarm, () => [t], 0, 60);
    expect(rings).toEqual([{ at: 30, keys: [finishKey(t)] }]);
    expect(state.handled).toEqual([finishKey(t)]);
  });

  it("detects a timer that ended while the tab was hidden on the first tick after return", () => {
    const t = timer("a", 30);
    vi.setSystemTime(at(5 * 60));
    const s = stepAlarm(initialAlarm, [t], new Date());
    expect(s.ringing).toEqual([finishKey(t)]);
  });

  it("does not ring on launch for a timer that finished more than 10 minutes ago — it is only shown as finished", () => {
    const t = timer("a", 30);
    vi.setSystemTime(at(30 + 11 * 60));
    const s = stepAlarm(initialAlarm, [t], new Date());
    expect(s.ringing).toEqual([]);
    expect(s.handled).toEqual([finishKey(t)]);
    expect(dueTimers([t], new Date())).toHaveLength(1);
  });

  it("two timers ending at once: one ring with both", () => {
    const a = timer("a", 60);
    const b = timer("b", 60);
    const { rings } = run(initialAlarm, () => [a, b], 0, 61);
    expect(rings).toEqual([{ at: 60, keys: [finishKey(a), finishKey(b)] }]);
  });

  it("a second timer ending during the ringing joins it and restarts the two-minute cap", () => {
    const a = timer("a", 60);
    const b = timer("b", 90);
    let s = run(initialAlarm, () => [a, b], 0, 89).state;
    expect(s.ringing).toEqual([finishKey(a)]);
    s = run(s, () => [a, b], 90, 90).state;
    expect(s.ringing).toEqual([finishKey(a), finishKey(b)]);
    expect(s.since).toBe(at(90).getTime());
  });

  it("stops by itself after two minutes and does not ring again", () => {
    const t = timer("a", 10);
    const { state, rings } = run(initialAlarm, () => [t], 0, 10 + ALARM_MAX_MS / 1000 + 30);
    expect(rings).toHaveLength(1);
    expect(state.ringing).toEqual([]);
    expect(state.since).toBeNull();
  });

  it("Stop: silenced here, dismissed everywhere; a dismissed timer never rings again", () => {
    let timers = [timer("a", 10)];
    let s = run(initialAlarm, () => timers, 0, 10).state;
    expect(s.ringing).toHaveLength(1);
    s = silenceAlarm(s);
    timers = dismissDue(timers, at(11));
    expect(timers[0].dismissed).toBe(true);
    // Another device sees the dismissed timer: its ringing ends on the next tick.
    const other = run(initialAlarm, () => [timer("a", 10)], 0, 10).state;
    expect(stepAlarm(other, timers, at(12)).ringing).toEqual([]);
    expect(run(s, () => timers, 12, 40).rings).toEqual([]);
  });

  it("a timer deleted while ringing stops the ringing", () => {
    let timers = [timer("a", 10), timer("b", 100)];
    let s = run(initialAlarm, () => timers, 0, 10).state;
    timers = timers.filter((t) => t.id !== "a");
    s = stepAlarm(s, timers, at(11));
    expect(s.ringing).toEqual([]);
    expect(s.since).toBeNull();
  });
});

describe("pause, resume, restart, edit", () => {
  it("pause freezes the seconds left and never finishes; resume continues and rings once at the new end", () => {
    let t = timer("a", 60);
    t = pauseTimer(t, at(20));
    expect(remainingSeconds(t, at(500))).toBe(40);
    expect(isFinished(t, at(500))).toBe(false);
    let s = run(initialAlarm, () => [t], 0, 500, 10).state;
    expect(s.ringing).toEqual([]);
    t = resumeTimer(t, at(500));
    expect(remainingSeconds(t, at(510))).toBe(30);
    const r = run(s, () => [t], 501, 560);
    expect(r.rings).toEqual([{ at: 540, keys: [finishKey(t)] }]);
    s = r.state;
  });

  it("pausing a finished timer changes nothing", () => {
    const t = timer("a", 10);
    expect(pauseTimer(t, at(20))).toBe(t);
  });

  it("restart after it rang: rings again at the new end (new finish)", () => {
    let t = timer("a", 10);
    let s = run(initialAlarm, () => [t], 0, 12).state;
    t = restartTimer({ ...t, dismissed: true }, at(12));
    expect(t.dismissed).toBe(false);
    s = stepAlarm(s, [t], at(13));
    expect(s.ringing).toEqual([]);
    expect(run(s, () => [t], 14, 22).rings).toEqual([{ at: 22, keys: [finishKey(t)] }]);
  });

  it("edit: +1 minute on a running timer moves the end; on a finished one it counts again; never below 1 s", () => {
    let t = timer("a", 60);
    t = addTimerTime(t, 60, at(30));
    expect(remainingSeconds(t, at(30))).toBe(90);
    expect(t.seconds).toBe(90);
    const done = timer("b", 10);
    const again = addTimerTime({ ...done, dismissed: true }, 60, at(100));
    expect(again.dismissed).toBe(false);
    expect(remainingSeconds(again, at(100))).toBe(60);
    expect(remainingSeconds(addTimerTime(timer("c", 60), -600, at(0)), at(0))).toBe(1);
    const paused = addTimerTime(pauseTimer(timer("d", 60), at(10)), 30, at(20));
    expect(paused.pausedLeft).toBe(80);
  });

  it("paused timers sort with the running ones", () => {
    const run1 = timer("a", 100);
    const paused = pauseTimer(timer("b", 50), at(10));
    const done = timer("c", 5);
    expect(visibleTimers([done, paused, run1], at(20)).map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
});

describe("notification schedule", () => {
  const session = (timers: CookingTimer[], phase: "steps" | "done" = "steps") => ({ key: "2026-10-14", phase, timers });

  it("one notification per running future timer; none for paused, dismissed, finished or done sessions", () => {
    const a = timer("a", 60);
    const p = pauseTimer(timer("p", 60), at(5));
    const d = { ...timer("d", 60), dismissed: true };
    const f = timer("f", 1);
    const wanted = alarmSchedule([session([a, p, d, f]), session([timer("x", 60)], "done")], at(2));
    expect(wanted.map((w) => w.timerId)).toEqual(["a"]);
    expect(wanted[0].fireAt.toISOString()).toBe(a.endsAt);
    expect(wanted[0].sessionKey).toBe("2026-10-14");
  });

  it("reconcile: pause/edit/delete cancel the old id and schedule the new one; other app notifications are left alone", () => {
    const a = timer("a", 60);
    const first = alarmSchedule([session([a])], START);
    expect(reconcileSchedule([], first)).toEqual({ cancel: [], schedule: first });
    const edited = addTimerTime(a, 60, at(10));
    const second = alarmSchedule([session([edited])], at(10));
    const diff = reconcileSchedule([first[0].id, "reminder-1"], second);
    expect(diff.cancel).toEqual([first[0].id]);
    expect(diff.schedule.map((s) => s.id)).toEqual([second[0].id]);
    expect(reconcileSchedule([second[0].id], alarmSchedule([session([pauseTimer(edited, at(20))])], at(20))).cancel).toEqual([second[0].id]);
    expect(reconcileSchedule([second[0].id], alarmSchedule([session([])], at(20))).cancel).toEqual([second[0].id]);
  });
});

describe("tone", () => {
  it("is short, audible and ends in a pause so the loop breathes", () => {
    expect(ALARM_TONE_MS).toBeGreaterThan(500);
    expect(ALARM_TONE_MS).toBeLessThan(2000);
    expect(ALARM_TONE.at(-1)!.freq).toBe(0);
    expect(ALARM_TONE.filter((p) => p.freq).every((p) => p.freq >= 400 && p.freq <= 2000)).toBe(true);
  });
});

describe("hand-offs (phone clock, AlarmKit)", () => {
  const session = (timers: CookingTimer[], phase: "steps" | "done" = "steps") => ({ key: "2026-10-14", phase, timers });
  it("a finish handed to the phone gets no notification; +1 dk (a new end) takes it back", () => {
    const a = timer("a", 600);
    const b = timer("b", 900);
    expect(alarmSchedule([session([a, b])], START, new Set([finishKey(a)])).map((w) => w.timerId)).toEqual(["b"]);
    const longer = addTimerTime(a, 60, at(10));
    expect(alarmSchedule([session([longer, b])], at(10), new Set([finishKey(a)])).map((w) => w.timerId)).toEqual(["a", "b"]);
  });

  it("live keys leave out closed timers and finished sessions", () => {
    const a = timer("a", 600);
    const closed = { ...timer("c", 60), dismissed: true };
    expect([...liveFinishKeys([session([a, closed]), session([timer("x", 60)], "done")])]).toEqual([finishKey(a)]);
  });

  it("past finishes stay handed off, future ones follow what the native alarm covers now, closed ones are forgotten", () => {
    const a = timer("a", 60);
    const b = timer("b", 600);
    const c = timer("c", 900);
    const stored = [finishKey(a), finishKey(b), finishKey(c)];
    // 2 minutes on: a has finished (its phone alarm rang), b is still covered, c no longer is
    const later = at(120);
    expect(nextHandoffs(stored, [session([a, b, c])], later, [finishKey(b)])).toEqual([finishKey(a), finishKey(b)].sort());
    // closing a forgets it; a paused timer has no future finish to hand off
    expect(nextHandoffs(stored, [session([{ ...a, dismissed: true }, pauseTimer(b, later), c])], later, [])).toEqual([]);
    // keys of other timers are ignored
    expect(nextHandoffs([], [session([b])], later, ["x@2026-10-14T18:30:00.000Z"])).toEqual([]);
  });

  it("each finish has its own stable UUID", () => {
    const a = timer("a", 600);
    const u = finishUuid(finishKey(a));
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(finishUuid(finishKey(a))).toBe(u);
    expect(finishUuid(finishKey(addTimerTime(a, 60, START)))).not.toBe(u);
    expect(finishUuid(finishKey(timer("b", 600)))).not.toBe(u);
  });
});
