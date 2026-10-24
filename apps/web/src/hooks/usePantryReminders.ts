"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DEFAULT_REMINDER_SETTINGS, planPantryReminders, type ReminderPlan, type ReminderSettings } from "@anv/core/domain/pantryReminders";
import { now } from "@anv/core/lib/clock";
import { preferences } from "@/data/preferences";
import { recipesMap, useApp } from "@/store/app";

/** Device-level reminder settings (Ayarlar), shared by every component that shows them. */
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
let settingsCache: ReminderSettings | null = null;
const settingsSnapshot = () => (settingsCache ??= preferences.getReminderSettings());

export function useReminderSettings(): [ReminderSettings, (next: ReminderSettings) => void] {
  const settings = useSyncExternalStore(subscribe, settingsSnapshot, () => DEFAULT_REMINDER_SETTINGS);
  const set = (next: ReminderSettings) => {
    settingsCache = next;
    preferences.setReminderSettings(next);
    listeners.forEach((l) => l());
  };
  return [settings, set];
}

/**
 * The household's pantry reminders right now (shared core scheduler). Re-evaluated every minute
 * so a reminder that comes due while the page is open shows up without a reload.
 */
export function usePantryReminders(): ReminderPlan {
  const [settings] = useReminderSettings();
  const status = useApp((x) => x.status);
  const planItems = useApp((x) => x.planItems);
  const planDays = useApp((x) => x.planDays);
  const recipes = useApp((x) => x.recipes);
  const pantry = useApp((x) => x.pantry);
  const answers = useApp((x) => x.pantryAnswers);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return useMemo(() => {
    void tick;
    if (status !== "ready") return { scheduled: [], due: [] };
    return planPantryReminders({ now: now(), planItems, planDays, recipesById: recipesMap(recipes), pantry, answers, settings });
  }, [status, planItems, planDays, recipes, pantry, answers, settings, tick]);
}
