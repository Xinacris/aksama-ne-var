import { useSyncExternalStore } from "react";
import { readTimerSound, takeAlarmHint, writeTimerSound } from "@anv/core/lib/devicePrefs";
import { useMobileData } from "@/boot";

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
