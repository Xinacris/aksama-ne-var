import { useMemo, useSyncExternalStore } from "react";
import { readHandoffs, readTimerKind, readTimerSound, takeAlarmHint, TIMER_HANDOFF_KEY, writeHandoffs, writeTimerKind, writeTimerSound, type TimerKind } from "@anv/core/lib/devicePrefs";
import { useMobileData } from "@/boot";
import { alarmKitAvailable } from "./alarmKit";

/** Until the device store is booted (and in tests), choices live in memory for the session. */
const memory = new Map<string, string>();
const memoryStore = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v) };

/** "Zamanlayıcı sesi" (device-level, default on), shared by Ayarlar and the alarm. */
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useTimerSound(): [boolean, (on: boolean) => void] {
  const store = useMobileData()?.store ?? memoryStore;
  const on = useSyncExternalStore(subscribe, () => readTimerSound(store));
  const set = (v: boolean) => {
    writeTimerSound(store, v);
    listeners.forEach((l) => l());
  };
  return [on, set];
}

const notify = () => listeners.forEach((l) => l());

/** "Zamanlayıcı türü" (device-level): only a choice where the phone has its own alarm (AlarmKit). */
export function useTimerKind(): [TimerKind, (kind: TimerKind) => void, boolean] {
  const store = useMobileData()?.store ?? memoryStore;
  const available = alarmKitAvailable();
  const kind = useSyncExternalStore(subscribe, () => readTimerKind(store, available));
  const set = (k: TimerKind) => {
    writeTimerKind(store, k);
    // Back to the app's notification: the phone's alarm no longer answers for anything.
    if (k === "notification") writeHandoffs(store, []);
    notify();
  };
  return [kind, set, available];
}

/** Finishes the phone's own alarm answers for on this device (core `nextHandoffs`). */
export function useHandoffs(): [string[], (keys: string[]) => void] {
  const store = useMobileData()?.store ?? memoryStore;
  const raw = useSyncExternalStore(subscribe, () => store.getItem(TIMER_HANDOFF_KEY) ?? "[]");
  const keys = useMemo(() => readHandoffs({ getItem: () => raw }), [raw]);
  const set = (next: string[]) => {
    if (next.join() === keys.join()) return;
    writeHandoffs(store, next);
    notify();
  };
  return [keys, set];
}

/** True the first time only (per device): the "notifications are off" hint. */
export function useTakeAlarmHint(): () => boolean {
  const store = useMobileData()?.store ?? memoryStore;
  return () => takeAlarmHint(store);
}

/** Tests: forget in-memory choices. */
export function resetAlarmPrefsForTests() {
  memory.clear();
  listeners.forEach((l) => l());
}
