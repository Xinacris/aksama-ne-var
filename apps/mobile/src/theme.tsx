import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { palette, type Palette } from "@anv/core/design/tokens";
import { resolveTheme, THEME_STORAGE_KEY, type ThemePreference } from "@anv/core/lib/theme";
import type { KeyValueStore } from "@anv/core/data/storage";

interface ThemeValue {
  colors: Palette;
  scheme: "light" | "dark";
  preference: ThemePreference;
  setPreference(p: ThemePreference): void;
}

const ThemeContext = createContext<ThemeValue>({
  colors: palette.light,
  scheme: "light",
  preference: "system",
  setPreference: () => {},
});

function readPref(store: KeyValueStore | null): ThemePreference {
  const v = store?.getItem(THEME_STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

/** Light/dark from the system, with the same "Açık / Koyu / Sistem" override as the web (same storage key). */
export function ThemeProvider({ store, children }: { store: KeyValueStore | null; children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>(() => readPref(store));
  const value = useMemo<ThemeValue>(() => {
    const scheme = resolveTheme(preference, system === "dark");
    return {
      colors: palette[scheme],
      scheme,
      preference,
      setPreference: (p) => {
        setPref(p);
        store?.setItem(THEME_STORAGE_KEY, p);
      },
    };
  }, [preference, system, store]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
