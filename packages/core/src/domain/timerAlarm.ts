import type { CookingSession, CookingTimer } from "../data/models";
import { isFinished } from "./cooking";

/**
 * Timer alarm, pure parts. "Finished" comes only from the stored `endsAt`
 * (never from counting ticks), so a timer that ended while the app was closed
 * or the tab hidden is found on return. Each device keeps a small `AlarmState`:
 * which finishes it has already handled (so each one rings once) and what is
 * ringing now. Stopping writes `dismissed` to the timer, which every device
 * that sync reaches sees — there the alarm stops too.
 */

/** Ringing stops by itself after two minutes. */
export const ALARM_MAX_MS = 2 * 60_000;
/** A timer that finished longer ago than this (app closed) is shown as finished, without sound. */
export const ALARM_STALE_MS = 10 * 60_000;

/** One finish of one timer: a new `endsAt` (resume, restart, edit) is a new finish that may ring again. */
export function finishKey(t: Pick<CookingTimer, "id" | "endsAt">): string {
  return `${t.id}@${t.endsAt}`;
}

/** Finished, not paused, not dismissed. */
export function dueTimers(timers: CookingTimer[], now: Date): CookingTimer[] {
  return timers.filter((t) => !t.dismissed && isFinished(t, now)).sort((a, b) => a.endsAt.localeCompare(b.endsAt));
}

export interface AlarmState {
  /** Finish keys this device has handled (rang or found stale). */
  handled: string[];
  /** Finish keys ringing now. */
  ringing: string[];
  /** When the current ringing started (ms), for the two-minute cap. */
  since: number | null;
}

export const initialAlarm: AlarmState = { handled: [], ringing: [], since: null };

/**
 * Advance the alarm to `now`. New fresh finishes join the ringing (one sound
 * for all; the two-minute cap restarts); stale ones are only marked handled;
 * timers dismissed, deleted, paused or restarted elsewhere drop out.
 */
export function stepAlarm(state: AlarmState, timers: CookingTimer[], now: Date): AlarmState {
  const t = now.getTime();
  const due = dueTimers(timers, now);
  const dueKeys = new Set(due.map(finishKey));
  const handled = new Set(state.handled);
  const fresh: string[] = [];
  for (const d of due) {
    const k = finishKey(d);
    if (handled.has(k)) continue;
    handled.add(k);
    if (t - Date.parse(d.endsAt) <= ALARM_STALE_MS) fresh.push(k);
  }
  let ringing = [...state.ringing.filter((k) => dueKeys.has(k)), ...fresh];
  let since = fresh.length ? t : ringing.length ? state.since : null;
  if (since !== null && t - since >= ALARM_MAX_MS) {
    ringing = [];
    since = null;
  }
  // Forget keys of timers that are gone or no longer finished, so the list stays small.
  const live = new Set(timers.map(finishKey));
  const next: AlarmState = { handled: [...handled].filter((k) => live.has(k)), ringing, since };
  return sameAlarm(state, next) ? state : next;
}

/** Stop ringing on this device (the caller also dismisses the timers so other devices stop). */
export function silenceAlarm(state: AlarmState): AlarmState {
  return state.ringing.length || state.since !== null ? { ...state, ringing: [], since: null } : state;
}

function sameAlarm(a: AlarmState, b: AlarmState): boolean {
  return a.since === b.since && a.ringing.join() === b.ringing.join() && a.handled.join() === b.handled.join();
}

/** Mark every due timer dismissed — the "Durdur / Stop" write. */
export function dismissDue(timers: CookingTimer[], now: Date): CookingTimer[] {
  const due = new Set(dueTimers(timers, now).map((t) => t.id));
  return due.size ? timers.map((t) => (due.has(t.id) ? { ...t, dismissed: true } : t)) : timers;
}

export interface ScheduledAlarm {
  /** Stable per finish: rescheduling after pause/edit gives a new id. */
  id: string;
  sessionKey: string;
  timerId: string;
  label: string;
  fireAt: Date;
}

/**
 * Local notifications a device should have scheduled for `now`: one per
 * running timer that ends in the future, in unfinished sessions. Paused,
 * dismissed, finished or deleted timers have none — reconcile against this.
 * `handedOff`: finish keys another alarm on this device takes care of (the
 * phone's Clock app, AlarmKit), so the same finish doesn't ring twice.
 */
export function alarmSchedule(sessions: Pick<CookingSession, "key" | "phase" | "timers">[], now: Date, handedOff: ReadonlySet<string> = new Set()): ScheduledAlarm[] {
  const out: ScheduledAlarm[] = [];
  for (const s of sessions) {
    if (s.phase === "done") continue;
    for (const t of s.timers) {
      if (t.dismissed || t.pausedLeft != null) continue;
      const at = Date.parse(t.endsAt);
      if (at <= now.getTime()) continue;
      if (handedOff.has(finishKey(t))) continue;
      out.push({ id: `timer-${finishKey(t)}`, sessionKey: s.key, timerId: t.id, label: t.label, fireAt: new Date(at) });
    }
  }
  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/** What to change: cancel scheduled ids not wanted any more, schedule the missing ones. */
export function reconcileSchedule(scheduled: string[], wanted: ScheduledAlarm[]): { cancel: string[]; schedule: ScheduledAlarm[] } {
  const want = new Set(wanted.map((w) => w.id));
  const have = new Set(scheduled);
  return { cancel: scheduled.filter((id) => id.startsWith("timer-") && !want.has(id)), schedule: wanted.filter((w) => !have.has(w.id)) };
}

/** Finish keys of every timer that still exists, for forgetting old hand-offs. */
export function liveFinishKeys(sessions: Pick<CookingSession, "phase" | "timers">[]): Set<string> {
  return new Set(sessions.filter((s) => s.phase !== "done").flatMap((s) => s.timers.filter((t) => !t.dismissed).map(finishKey)));
}

/**
 * The finishes another alarm on this device answers for, after a change. Finishes already past
 * stay handed off (the phone's alarm rang for them; the app must not ring again on reopening).
 * Future ones are exactly what the native side covers now (`nativeFuture`): a timer it no
 * longer covers (permission withdrawn, sound off, type switched) goes back to the notification.
 * Keys of closed or deleted timers are forgotten.
 */
export function nextHandoffs(stored: Iterable<string>, sessions: Pick<CookingSession, "phase" | "timers">[], now: Date, nativeFuture: Iterable<string>): string[] {
  const running = sessions.filter((s) => s.phase !== "done").flatMap((s) => s.timers.filter((t) => !t.dismissed && t.pausedLeft == null));
  const past = new Set(running.filter((t) => Date.parse(t.endsAt) <= now.getTime()).map(finishKey));
  const future = new Set(running.filter((t) => Date.parse(t.endsAt) > now.getTime()).map(finishKey));
  const out = new Set([...stored].filter((k) => past.has(k)));
  for (const k of nativeFuture) if (future.has(k)) out.add(k);
  return [...out].sort();
}

/**
 * A stable UUID for one finish (`id@endsAt`), so a native alarm (AlarmKit) can be found and
 * cancelled from the timer alone, with nothing stored. Four 32-bit FNV-1a hashes with different
 * seeds (32-bit maths: the web targets ES2017, no BigInt); the version and variant bits are set
 * so the result parses as a UUID everywhere.
 */
export function finishUuid(key: string): string {
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  const hex = [0x811c9dc5, 0x050c5d1f, 0x9e3779b9, 0x2545f491].map(fnv).join("").split("");
  hex[12] = "8"; // version 8: custom
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16); // RFC 4122 variant
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export { ALARM_TONE, ALARM_TONE_MS, ALARM_VIBRATION } from "./alarmTone";
