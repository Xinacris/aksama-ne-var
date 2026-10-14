import { describe, expect, it, vi } from "vitest";
import { SessionStore } from "@anv/core/data/session";
import { memoryStore } from "@anv/core/data/storage";
import { createLocalBus } from "@anv/core/data/sync";
import { createBrowserBus } from "@/data/browserBus";

describe("SessionStore", () => {
  it("prefers the tab session and falls back to the last session", () => {
    const shared = memoryStore();
    const tabA = new SessionStore(memoryStore(), shared);
    const tabB = new SessionStore(memoryStore(), shared);
    tabA.set("ali");
    expect(tabB.get()).toBe("ali"); // new tab inherits last login
    tabB.set("zeynep");
    expect(tabA.get()).toBe("ali"); // per-tab session kept
    expect(tabB.get()).toBe("zeynep");
  });

  it("clears only its own login from the shared fallback", () => {
    const shared = memoryStore();
    const tabA = new SessionStore(memoryStore(), shared);
    const tabB = new SessionStore(memoryStore(), shared);
    tabA.set("ali");
    tabB.set("zeynep");
    tabA.clear();
    expect(tabA.get()).toBe("zeynep");
    tabB.clear();
    expect(tabB.get()).toBeNull();
  });
});

describe("sync bus", () => {
  it("local bus delivers to subscribers", () => {
    const bus = createLocalBus();
    const cb = vi.fn();
    const off = bus.subscribe(cb);
    bus.publish({ kind: "change", tables: ["x"], origin: "o" });
    off();
    bus.publish({ kind: "change", tables: ["y"], origin: "o" });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("browser bus relays storage events from other tabs", () => {
    const bus = createBrowserBus();
    const cb = vi.fn();
    bus.subscribe(cb);
    window.dispatchEvent(new StorageEvent("storage", { key: "anv:t:planItems" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls[0][0]).toMatchObject({ kind: "change", tables: ["planItems"] });
    expect(cb.mock.calls[1][0]).toMatchObject({ tables: ["*"] });
    bus.close();
  });

  it("browser bus ignores its own messages and relays others via BroadcastChannel", async () => {
    const a = createBrowserBus();
    const b = createBrowserBus();
    const onA = vi.fn();
    const onB = vi.fn();
    a.subscribe(onA);
    b.subscribe(onB);
    a.publish({ kind: "change", tables: ["matches"], origin: a.tabId });
    await new Promise((r) => setTimeout(r, 20));
    expect(onA).not.toHaveBeenCalled();
    expect(onB).toHaveBeenCalledWith(expect.objectContaining({ tables: ["matches"] }));
    a.close();
    b.close();
  });
});
