import { createDataContext, type DataContext } from "@anv/core/data/context";
import { setPasswordCrypto } from "@anv/core/lib/crypto";
import { appStore, configureApp, setDataContext } from "@anv/core/store/app";
import type { KeyValueStore } from "@anv/core/data/storage";
import { hydrateAsyncStore } from "./asyncStore";
import { mobilePasswordCrypto } from "./crypto";

export interface MobileData {
  ctx: DataContext;
  /** The same hydrated store (device preferences: theme, language). */
  store: KeyValueStore;
  flush(): Promise<void>;
}

let booted: Promise<MobileData> | null = null;

/**
 * Read AsyncStorage into memory, wire the shared store to it and boot it.
 * Phones have one "tab": the session store and the data store are the same,
 * and the bus is the in-process echo (no other device hears it — no sync yet).
 */
export function bootMobile(): Promise<MobileData> {
  if (booted) return booted;
  booted = (async () => {
    setPasswordCrypto(mobilePasswordCrypto);
    const { store, flush } = await hydrateAsyncStore((e) => console.warn("[storage]", e));
    const ctx = createDataContext({ store });
    configureApp({ getData: () => ctx });
    await appStore.getState().boot();
    return { ctx, store, flush };
  })();
  return booted;
}

/** Tests: boot again over a fresh AsyncStorage mock. */
export function resetBootForTests() {
  booted = null;
  setDataContext(null);
}
