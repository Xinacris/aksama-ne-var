import { KeyValueAdapter } from "./adapters/keyValue";
import type { Repos } from "./repos";
import { catalogRecipes as builtinRecipes } from "../recipes/catalog";
import { SessionStore } from "./session";
import { memoryStore, type KeyValueStore } from "./storage";
import { createLocalBus, type SyncBus } from "./sync";

export interface DataContext {
  repos: Repos;
  bus: SyncBus;
  session: SessionStore;
}

/**
 * Build a data context over any key-value stores. `tab` holds the per-tab
 * session (sessionStorage on the web); a phone passes the same store twice.
 */
export function createDataContext(opts: {
  store: KeyValueStore;
  tab?: KeyValueStore;
  bus?: SyncBus;
  onCorrupt?: (table: string) => void;
}): DataContext {
  const bus = opts.bus ?? createLocalBus();
  return {
    repos: new KeyValueAdapter({ store: opts.store, bus, builtinRecipes, onCorrupt: opts.onCorrupt }),
    bus,
    session: new SessionStore(opts.tab ?? opts.store, opts.store),
  };
}

/** Test helper: an isolated context over in-memory stores. */
export function createMemoryData(): DataContext {
  return createDataContext({ store: memoryStore(), tab: memoryStore() });
}
