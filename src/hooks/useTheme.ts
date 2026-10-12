"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { preferences } from "@/data/preferences";
import { resolveTheme, type ThemePreference } from "@/lib/theme";

const listeners = new Set<() => void>();
let current: ThemePreference | null = null;

function read(): ThemePreference {
  if (current === null) current = preferences.getTheme();
  return current;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function apply(pref: ThemePreference) {
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  document.documentElement.setAttribute("data-theme", resolveTheme(pref, systemDark));
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, read, () => "system" as ThemePreference);

  useEffect(() => {
    apply(pref);
    if (pref !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const setTheme = useCallback((next: ThemePreference) => {
    current = next;
    preferences.setTheme(next);
    apply(next);
    listeners.forEach((l) => l());
  }, []);

  return { theme: pref, setTheme };
}
