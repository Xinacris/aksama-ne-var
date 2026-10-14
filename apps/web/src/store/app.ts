"use client";

import { useStore } from "zustand";
import { appStore, configureApp, type AppState } from "@anv/core/store/app";
import { getData } from "@/data";

export * from "@anv/core/store/app";

configureApp({
  getData,
  onLeave: (cb) => {
    if (typeof window !== "undefined") window.addEventListener("pagehide", cb);
  },
  network:
    typeof window === "undefined"
      ? undefined
      : {
          isOnline: () => navigator.onLine,
          subscribe: (cb) => {
            window.addEventListener("online", cb);
            window.addEventListener("offline", cb);
          },
        },
});

/** React binding of the shared vanilla store (same API as zustand's `create`). */
function useAppHook(): AppState;
function useAppHook<T>(selector: (s: AppState) => T): T;
function useAppHook<T>(selector?: (s: AppState) => T) {
  return useStore(appStore, selector ?? ((s: AppState) => s as unknown as T));
}

export const useApp = Object.assign(useAppHook, {
  getState: appStore.getState,
  setState: appStore.setState,
  subscribe: appStore.subscribe,
});
