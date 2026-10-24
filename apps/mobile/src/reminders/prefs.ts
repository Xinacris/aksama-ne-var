import { useMemo, useSyncExternalStore } from "react";
import { PANTRY_DISMISSED_KEY, PANTRY_REMINDERS_KEY, addToIdSet, readIdSet, readReminderSettings, writeReminderSettings } from "@anv/core/lib/devicePrefs";
import type { ReminderSettings } from "@anv/core/domain/pantryReminders";
import { useMobileData } from "@/boot";

/** Until the device store is booted (and in tests), choices live in memory for the session. */
const memory = new Map<string, string>();
const memoryStore = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v) };

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const notify = () => listeners.forEach((l) => l());

/** "Evde ne var" reminders on this phone (Ayarlar), on by default. */
export function useReminderSettings(): [ReminderSettings, (next: ReminderSettings) => void] {
  const store = useMobileData()?.store ?? memoryStore;
  // The raw string is the snapshot (stable between renders); parsed once per change.
  const raw = useSyncExternalStore(subscribe, () => store.getItem(PANTRY_REMINDERS_KEY) ?? "");
  const settings = useMemo(() => readReminderSettings({ getItem: () => raw || null }), [raw]);
  const set = (next: ReminderSettings) => {
    writeReminderSettings(store, next);
    notify();
  };
  return [settings, set];
}

/** Reminder ids whose banner was closed with "Sonra" on this phone. */
export function useDismissedReminders(): [string[], (id: string) => void] {
  const store = useMobileData()?.store ?? memoryStore;
  const raw = useSyncExternalStore(subscribe, () => store.getItem(PANTRY_DISMISSED_KEY) ?? "[]");
  const ids = useMemo(() => readIdSet({ getItem: () => raw }, PANTRY_DISMISSED_KEY), [raw]);
  const dismiss = (id: string) => {
    addToIdSet(store, PANTRY_DISMISSED_KEY, id);
    notify();
  };
  return [ids, dismiss];
}
