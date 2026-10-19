import { useSyncExternalStore } from "react";
import type { Cuisine } from "@anv/core/recipes/schema";
import { preferences } from "@/data/preferences";

/**
 * Eşleş's cuisine pills, per browser. Read once from localStorage and kept here, so the snapshot
 * stays the same array between renders and the choice still works when storage is unavailable.
 */
const NONE: Cuisine[] = [];
let current: Cuisine[] | null = null;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const snapshot = () => (current ??= preferences.getSwipeCuisines());

export function useSwipeCuisines(): [Cuisine[], (next: Cuisine[]) => void] {
  // Server render shows all cuisines; the stored choice appears after hydration.
  const selected = useSyncExternalStore(subscribe, snapshot, () => NONE);
  const set = (next: Cuisine[]) => {
    current = next;
    preferences.setSwipeCuisines(next);
    listeners.forEach((l) => l());
  };
  return [selected, set];
}
