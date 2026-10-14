/**
 * Sync bus contract. Every write publishes a change event; on the web other
 * tabs receive it (apps/web `createBrowserBus`), on a phone it is the local
 * echo only. Presence heartbeats travel on the same bus.
 */

export const STORAGE_PREFIX = "anv:";

export type SyncMessage =
  | { kind: "change"; tables: string[]; origin: string }
  | { kind: "presence"; userId: string; householdId: string; route: string; origin: string; at: number }
  | { kind: "leave"; userId: string; origin: string };

type Listener = (msg: SyncMessage) => void;

export interface SyncBus {
  readonly tabId: string;
  publish(msg: SyncMessage): void;
  subscribe(listener: Listener): () => void;
  close(): void;
}

export function newSyncId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/** In-process bus: used on the server, in tests, and as the local echo. */
export function createLocalBus(): SyncBus {
  const listeners = new Set<Listener>();
  return {
    tabId: newSyncId(),
    publish: (msg) => listeners.forEach((l) => l(msg)),
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    close: () => listeners.clear(),
  };
}
