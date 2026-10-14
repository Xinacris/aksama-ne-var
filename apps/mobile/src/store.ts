import { setI18n } from "react-i18next";
import { useStore } from "zustand";
import { i18n } from "@anv/core/i18n";
import { appStore, type AppState } from "@anv/core/store/app";

export * from "@anv/core/store/app";

// react-i18next hooks read core's i18next instance (every screen imports this module, tests too).
setI18n(i18n);

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
