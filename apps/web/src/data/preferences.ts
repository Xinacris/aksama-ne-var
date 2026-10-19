import { readTimerSound, takeAlarmHint, writeTimerSound } from "@anv/core/lib/devicePrefs";
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
  /** True once per browser: the "notifications are off" hint. */
  takeAlarmHint(): boolean {
    return takeAlarmHint(local());
  },
};
