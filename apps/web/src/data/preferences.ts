import {
  PANTRY_DISMISSED_KEY,
  PANTRY_NOTIFIED_KEY,
  addToIdSet,
  readIdSet,
  readReminderSettings,
  readTimerSound,
  takeAlarmHint,
  writeReminderSettings,
  writeTimerSound,
} from "@anv/core/lib/devicePrefs";
import type { ReminderSettings } from "@anv/core/domain/pantryReminders";
import { THEME_STORAGE_KEY, type ThemePreference } from "@anv/core/lib/theme";
import { readSwipeCuisines, writeSwipeCuisines } from "@anv/core/recipes/cuisines";
import type { Cuisine } from "@anv/core/recipes/schema";

function local(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Device-level preferences (not synced across household members). */
export const preferences = {
  getTheme(): ThemePreference {
    try {
      const v = window.localStorage.getItem(THEME_STORAGE_KEY);
      return v === "light" || v === "dark" || v === "system" ? v : "system";
    } catch {
      return "system";
    }
  },
  setTheme(pref: ThemePreference): void {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      // Storage may be unavailable (private mode); the choice still applies for this page.
    }
  },
  /** "Zamanlayıcı sesi": on unless turned off. */
  getTimerSound(): boolean {
    return readTimerSound(local());
  },
  setTimerSound(on: boolean): void {
    writeTimerSound(local(), on);
  },
  /** Eşleş's cuisine pills (unknown keys dropped; no storage = this page only). */
  getSwipeCuisines(): Cuisine[] {
    return readSwipeCuisines(local());
  },
  setSwipeCuisines(selected: readonly Cuisine[]): void {
    writeSwipeCuisines(local(), selected);
  },
  /** "Evde ne var" reminders (on by default). */
  getReminderSettings(): ReminderSettings {
    return readReminderSettings(local());
  },
  setReminderSettings(v: ReminderSettings): void {
    writeReminderSettings(local(), v);
  },
  /** Reminder ids whose banner was closed with "Sonra" in this browser. */
  getPantryDismissed(): string[] {
    return readIdSet(local(), PANTRY_DISMISSED_KEY);
  },
  dismissPantry(id: string): string[] {
    return addToIdSet(local(), PANTRY_DISMISSED_KEY, id);
  },
  /** Reminder ids already shown as a browser notification. */
  getPantryNotified(): string[] {
    return readIdSet(local(), PANTRY_NOTIFIED_KEY);
  },
  markPantryNotified(id: string): void {
    addToIdSet(local(), PANTRY_NOTIFIED_KEY, id);
  },
  /** True once per browser: the "notifications are off" hint. */
  takeAlarmHint(): boolean {
    return takeAlarmHint(local());
  },
};
