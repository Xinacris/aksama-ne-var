import { useStore } from "zustand";
import { appStore, type AppState } from "@anv/core/store/app";

export * from "@anv/core/store/app";

/** React binding of the shared vanilla store (same shape as the web's `useApp`). */
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
