import { createDataContext, type DataContext } from "@anv/core/data/context";
import { memoryStore } from "@anv/core/data/storage";
import { createBrowserBus } from "./browserBus";
import { browserLocalStore, browserSessionStore } from "./browserStorage";

export { createMemoryData, type DataContext } from "@anv/core/data/context";

let ctx: DataContext | null = null;
const corruptListeners = new Set<(table: string) => void>();

export function onCorruptData(cb: (table: string) => void) {
  corruptListeners.add(cb);
  return () => corruptListeners.delete(cb);
}

/** Lazily created per tab; never called during server rendering. */
export function getData(): DataContext {
  if (ctx) return ctx;
  if (typeof window === "undefined") throw new Error("getData() is client-only");
  let store;
  let tab;
  try {
    store = browserLocalStore();
    store.keys();
    tab = browserSessionStore();
  } catch {
    store = memoryStore();
    tab = memoryStore();
  }
  ctx = createDataContext({ store, tab, bus: createBrowserBus(), onCorrupt: (t) => corruptListeners.forEach((l) => l(t)) });
  return ctx;
}

export function setDataForTests(next: DataContext | null) {
  ctx = next;
}
