import type { KeyValueStore } from "@anv/core/data/storage";

/** localStorage / sessionStorage as the core key-value contract (browser only). */
export function browserLocalStore(): KeyValueStore {
  return webStore(() => window.localStorage);
}

export function browserSessionStore(): KeyValueStore {
  return webStore(() => window.sessionStorage);
}

function webStore(get: () => Storage): KeyValueStore {
  return {
    getItem: (k) => get().getItem(k),
    setItem: (k, v) => get().setItem(k, v),
    removeItem: (k) => get().removeItem(k),
    keys: () => {
      const s = get();
      const out: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k !== null) out.push(k);
      }
      return out;
    },
  };
}
