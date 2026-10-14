import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KeyValueStore } from "@anv/core/data/storage";

/** Keys the app owns: tables and sessions (`anv:`), device preferences (`anv.`). */
const OURS = (k: string) => k.startsWith("anv:") || k.startsWith("anv.");

export interface HydratedStore {
  store: KeyValueStore;
  /** Resolves when every write so far has reached AsyncStorage. */
  flush(): Promise<void>;
}

/**
 * The repositories are synchronous (localStorage-shaped); AsyncStorage is not.
 * At startup every key we own is read into memory once; afterwards reads come
 * from memory and each write goes to memory at once and to AsyncStorage in
 * order (a promise chain), so a later write can never land before an earlier one.
 */
export async function hydrateAsyncStore(onError?: (e: unknown) => void): Promise<HydratedStore> {
  const keys = (await AsyncStorage.getAllKeys()).filter(OURS);
  const pairs = keys.length ? await AsyncStorage.multiGet(keys) : [];
  const mem = new Map<string, string>();
  for (const [k, v] of pairs) if (v !== null) mem.set(k, v);

  let chain: Promise<void> = Promise.resolve();
  const enqueue = (op: () => Promise<void>) => {
    chain = chain.then(op).catch((e) => onError?.(e));
  };

  return {
    store: {
      getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k, v) => {
        mem.set(k, v);
        enqueue(() => AsyncStorage.setItem(k, v));
      },
      removeItem: (k) => {
        mem.delete(k);
        enqueue(() => AsyncStorage.removeItem(k));
      },
      keys: () => [...mem.keys()],
    },
    flush: () => chain,
  };
}
