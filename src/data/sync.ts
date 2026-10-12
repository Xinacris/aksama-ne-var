/**
 * Cross-tab sync bus. Every write publishes a change event; other tabs in
 * the same browser receive it through BroadcastChannel (fast path) and the
 * `storage` event (fallback). Presence heartbeats travel on the same channel.
 */

export const STORAGE_PREFIX = "anv:";
const CHANNEL = "anv-sync";

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

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/** In-process bus: used on the server, in tests, and as the local echo. */
export function createLocalBus(): SyncBus {
  const listeners = new Set<Listener>();
  return {
    tabId: randomId(),
    publish: (msg) => listeners.forEach((l) => l(msg)),
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    close: () => listeners.clear(),
  };
}

export function createBrowserBus(): SyncBus {
  const tabId = randomId();
  const listeners = new Set<Listener>();
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
  const deliver = (msg: SyncMessage) => {
    if (msg.origin === tabId) return;
    listeners.forEach((l) => l(msg));
  };
  const onChannel = (e: MessageEvent<SyncMessage>) => deliver(e.data);
  channel?.addEventListener("message", onChannel);

  // Fallback / complement: storage events fire in other tabs on every write.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null) {
      deliver({ kind: "change", tables: ["*"], origin: "storage" });
      return;
    }
    if (!e.key.startsWith(STORAGE_PREFIX + "t:")) return;
    deliver({ kind: "change", tables: [e.key.slice((STORAGE_PREFIX + "t:").length)], origin: "storage" });
  };
  window.addEventListener("storage", onStorage);

  return {
    tabId,
    publish: (msg) => {
      try {
        channel?.postMessage(msg);
      } catch {
        // channel closed — storage events still carry data changes
      }
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    close: () => {
      channel?.removeEventListener("message", onChannel);
      channel?.close();
      window.removeEventListener("storage", onStorage);
      listeners.clear();
    },
  };
}
