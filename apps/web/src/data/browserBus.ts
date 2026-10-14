import { newSyncId, STORAGE_PREFIX, type SyncBus, type SyncMessage } from "@anv/core/data/sync";

const CHANNEL = "anv-sync";
type Listener = (msg: SyncMessage) => void;

/** Cross-tab bus: BroadcastChannel (fast path) and the `storage` event (fallback). */
export function createBrowserBus(): SyncBus {
  const tabId = newSyncId();
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
