export type ThemePreference = "light" | "dark" | "system";

/** Storage key for the device-level theme preference. */
export const THEME_STORAGE_KEY = "anv.theme";

export function resolveTheme(pref: ThemePreference, systemDark: boolean): "light" | "dark" {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}
