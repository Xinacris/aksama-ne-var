import { LocalStorageAdapter } from "./adapters/localStorage";
import type { Repos } from "./repos";
import { SessionStore } from "./session";
import { browserLocalStore, browserSessionStore, memoryStore } from "./storage";
import { createBrowserBus, createLocalBus, type SyncBus } from "./sync";
import { builtinRecipes } from "./seed/recipes";

export interface DataContext {
  repos: Repos;
  bus: SyncBus;
  session: SessionStore;
}

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
  const bus = createBrowserBus();
  const repos = new LocalStorageAdapter({
    store,
    bus,
    builtinRecipes,
    onCorrupt: (t) => corruptListeners.forEach((l) => l(t)),
  });
  ctx = { repos, bus, session: new SessionStore(tab, store) };
  return ctx;
}

/** Test helper: build an isolated context over in-memory stores. */
export function createMemoryData(): DataContext {
  const store = memoryStore();
  const bus = createLocalBus();
  return {
    repos: new LocalStorageAdapter({ store, bus, builtinRecipes }),
    bus,
    session: new SessionStore(memoryStore(), store),
  };
}

export function setDataForTests(next: DataContext | null) {
  ctx = next;
}
