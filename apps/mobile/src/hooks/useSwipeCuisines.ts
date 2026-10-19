import { useSyncExternalStore } from "react";
import { readSwipeCuisines, writeSwipeCuisines } from "@anv/core/recipes/cuisines";
import type { Cuisine } from "@anv/core/recipes/schema";
import { useMobileData } from "@/boot";

/**
 * Eşleş's cuisine pills, per device (the app's device store, like the timer sound). Read once and
 * kept here, so the snapshot stays the same array between renders; until the store is booted, or
 * if writing fails, the choice lives in memory for the session.
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

export function useSwipeCuisines(): [Cuisine[], (next: Cuisine[]) => void] {
  const store = useMobileData()?.store ?? null;
  const selected = useSyncExternalStore(subscribe, () => current ?? (store ? (current = readSwipeCuisines(store)) : NONE));
  const set = (next: Cuisine[]) => {
    current = next;
    writeSwipeCuisines(store, next);
    listeners.forEach((l) => l());
  };
  return [selected, set];
}
