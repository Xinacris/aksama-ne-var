import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageAdapter } from "@/data/adapters/localStorage";
import { memoryStore, StorageError, type KeyValueStore } from "@/data/storage";
import { createLocalBus, type SyncMessage } from "@/data/sync";
import type { Recipe } from "@/data/models";
import { setNow } from "@/lib/clock";

const builtin: Recipe = {
  id: "mercimek-corbasi",
  householdId: null,
  name: "Mercimek çorbası",
  course: "corba",
  prepMinutes: 10,
  cookMinutes: 20,
  servings: 4,
  tags: [],
  ingredients: [],
  prepItems: [],
  steps: ["Pişir."],
  leftoverPolicy: "store",
  leftoverDays: 3,
  freezerItem: null,
  createdBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function setup(store: KeyValueStore = memoryStore()) {
  const bus = createLocalBus();
  const messages: SyncMessage[] = [];
  bus.subscribe((m) => messages.push(m));
  const onCorrupt = vi.fn();
  const repos = new LocalStorageAdapter({ store, bus, builtinRecipes: [builtin], onCorrupt });
  return { repos, store, bus, messages, onCorrupt };
}

const user = {
  email: "ali@example.com",
  name: "Ali",
  avatarInitial: "A",
  passwordHash: "h",
  passwordSalt: "s",
  onboarded: false,
};

describe("LocalStorageAdapter", () => {
  beforeEach(() => setNow("2026-10-12T09:00:00.000Z"));

  it("creates, reads and updates users with ids and timestamps", async () => {
    const { repos } = setup();
    const u = await repos.auth.createUser(user);
    expect(u.id).toMatch(/[0-9a-f-]{36}/);
    expect(u.createdAt).toBe("2026-10-12T09:00:00.000Z");
    expect(await repos.auth.findUserByEmail("ALI@example.com")).toEqual(u);
    setNow("2026-10-12T10:00:00.000Z");
    const updated = await repos.auth.updateUser(u.id, { name: "Ali Can" });
    expect(updated.name).toBe("Ali Can");
    expect(updated.updatedAt).toBe("2026-10-12T10:00:00.000Z");
    expect(updated.createdAt).toBe(u.createdAt);
  });

  it("scopes households, members and favorites", async () => {
    const { repos } = setup();
    const u = await repos.auth.createUser(user);
    const h = await repos.households.create({ name: "Ev", inviteCode: "k7m2-tq", createdBy: u.id, dinnerTime: "19:30", lunchAtHome: "yes", lunchDays: [] });
    await repos.households.addMember({ householdId: h.id, userId: u.id, role: "owner", color: "#55612A", createdBy: u.id });
    expect(await repos.households.findByInviteCode("K7M2-TQ")).toEqual(h);
    expect(await repos.households.findByInviteCode("nope")).toBeNull();
    expect((await repos.households.membershipOf(u.id))?.householdId).toBe(h.id);
    const fav = await repos.households.addFavorite({ householdId: h.id, recipeId: "x", createdBy: u.id });
    expect(await repos.households.listFavorites(h.id)).toHaveLength(1);
    await repos.households.removeFavorite(fav.id);
    expect(await repos.households.listFavorites(h.id)).toHaveLength(0);
  });

  it("merges builtin and household recipes and protects builtins", async () => {
    const { repos } = setup();
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = builtin;
    void _id;
    void _c;
    void _u;
    const r = await repos.recipes.create({ ...rest, householdId: "h1", name: "Annemin dolması", createdBy: "u1" });
    expect((await repos.recipes.list("h1")).map((x) => x.name)).toEqual(["Mercimek çorbası", "Annemin dolması"]);
    expect(await repos.recipes.list("h2")).toHaveLength(1);
    await expect(repos.recipes.update(builtin.id, { name: "x" })).rejects.toThrow();
    await repos.recipes.remove(r.id);
    expect(await repos.recipes.get(r.id)).toBeNull();
    expect(await repos.recipes.get(builtin.id)).toEqual(builtin);
  });

  it("upserts plan days per (household, date)", async () => {
    const { repos } = setup();
    const a = await repos.plan.upsertDay("h1", "2026-10-12", { approvals: ["u1"] }, "u1");
    const b = await repos.plan.upsertDay("h1", "2026-10-12", { approvals: ["u1", "u2"] }, "u2");
    expect(b.id).toBe(a.id);
    expect(b.approvals).toEqual(["u1", "u2"]);
    expect(await repos.plan.listDays("h1")).toHaveLength(1);
  });

  it("keeps one check per list row (last write wins)", async () => {
    const { repos } = setup();
    await repos.shopping.check({ householdId: "h1", itemKey: "kiyma", checkedBy: "u1", createdBy: "u1" });
    await repos.shopping.check({ householdId: "h1", itemKey: "kiyma", checkedBy: "u2", createdBy: "u2" });
    const checks = await repos.shopping.listChecks("h1");
    expect(checks).toHaveLength(1);
    expect(checks[0].checkedBy).toBe("u2");
    await repos.shopping.uncheck("h1", "kiyma");
    expect(await repos.shopping.listChecks("h1")).toHaveLength(0);
  });

  it("replaces a member's earlier swipe on the same card", async () => {
    const { repos } = setup();
    const base = { householdId: "h1", userId: "u1", recipeId: "r", date: "2026-10-13", slot: "ana" as const, createdBy: "u1" };
    await repos.swipes.addSwipe({ ...base, decision: "pass" });
    await repos.swipes.addSwipe({ ...base, decision: "like" });
    const s = await repos.swipes.listSwipes("h1");
    expect(s).toHaveLength(1);
    expect(s[0].decision).toBe("like");
  });

  it("lists activity newest first with a limit", async () => {
    const { repos } = setup();
    setNow("2026-10-12T09:00:00.000Z");
    await repos.activity.add({ householdId: "h1", actorId: "u1", type: "plan.added", data: {}, createdBy: "u1" });
    setNow("2026-10-12T10:00:00.000Z");
    await repos.activity.add({ householdId: "h1", actorId: "u2", type: "plan.approved", data: {}, createdBy: "u2" });
    const list = await repos.activity.list("h1", 1);
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe("plan.approved");
  });

  it("keeps an import log per household without links or captions", async () => {
    const { repos } = setup();
    await repos.imports.add({ householdId: "h1", platform: "tiktok", path: "llm", createdBy: "u1" });
    await repos.imports.add({ householdId: "h2", platform: null, path: "rules", createdBy: "u2" });
    const rows = await repos.imports.list("h1");
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["createdAt", "createdBy", "householdId", "id", "path", "platform", "updatedAt"]);
  });

  it("publishes one coalesced change message per tick", async () => {
    const { repos, messages } = setup();
    await repos.auth.createUser(user);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    const changes = messages.filter((m) => m.kind === "change");
    expect(changes.length).toBeGreaterThanOrEqual(1);
    expect(changes[0]).toMatchObject({ kind: "change", tables: ["users"] });
  });

  it("treats missing storage as empty", async () => {
    const { repos } = setup();
    expect(await repos.plan.listItems("h1")).toEqual([]);
    expect(await repos.auth.getUser("nope")).toBeNull();
  });

  it("quarantines corrupt JSON and keeps working", async () => {
    const store = memoryStore({ "anv:t:users": "{not json" });
    const { repos, onCorrupt } = setup(store);
    expect(await repos.auth.findUserByEmail("ali@example.com")).toBeNull();
    expect(onCorrupt).toHaveBeenCalledWith("users");
    expect(store.keys().some((k) => k.startsWith("anv:corrupt:users:"))).toBe(true);
    await repos.auth.createUser(user);
    expect(await repos.auth.findUserByEmail("ali@example.com")).not.toBeNull();
  });

  it("drops rows that fail validation", async () => {
    const store = memoryStore({ "anv:t:favorites": JSON.stringify([{ id: "x" }]) });
    const { repos, onCorrupt } = setup(store);
    expect(await repos.households.listFavorites("h1")).toEqual([]);
    expect(onCorrupt).toHaveBeenCalledWith("favorites");
  });

  it("raises a calm quota error when storage is full", async () => {
    const base = memoryStore();
    const full: KeyValueStore = {
      ...base,
      setItem: (k, v) => {
        if (k.startsWith("anv:t:")) {
          const e = new Error("full");
          e.name = "QuotaExceededError";
          throw e;
        }
        base.setItem(k, v);
      },
    };
    const { repos } = setup(full);
    const err = await repos.auth.createUser(user).catch((e) => e);
    expect(err).toBeInstanceOf(StorageError);
    expect(err.code).toBe("quota");
    expect(err.message).toMatch(/kayıt alanı doldu/);
  });

  it("reports unavailable storage", async () => {
    const broken: KeyValueStore = {
      ...memoryStore(),
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    // migrations read meta too; build adapter over a working store, then break reads
    const store = memoryStore();
    const { repos } = setup(store);
    Object.assign(store, broken);
    await expect(repos.auth.getUser("x")).rejects.toMatchObject({ code: "unavailable" });
  });

  it("resets all data but keeps schema meta", async () => {
    const { repos, store } = setup();
    await repos.auth.createUser(user);
    await repos.resetAll();
    expect(store.keys()).toEqual(["anv:meta"]);
  });

  it("exports every table", async () => {
    const { repos } = setup();
    await repos.auth.createUser(user);
    const dump = await repos.exportAll();
    expect(dump.users).toHaveLength(1);
    expect(Object.keys(dump)).toContain("planItems");
  });
});
