import { THEME_STORAGE_KEY, type ThemePreference } from "@anv/core/lib/theme";

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
};
