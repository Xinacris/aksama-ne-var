import { nowIso } from "@/lib/clock";
import { newId } from "@/lib/id";
import {
  activitySchema,
  cookLogSchema,
  favoriteSchema,
  householdSchema,
  matchSchema,
  memberSchema,
  pantryItemSchema,
  planDaySchema,
  planItemSchema,
  prepTaskSchema,
  recipeSchema,
  shoppingCheckSchema,
  shoppingItemSchema,
  swipeSchema,
  userSchema,
  type Recipe,
} from "../models";
import { runMigrations, META_KEY, type MigrationResult } from "../migrations";
import type { NewRow, Patch, Repos } from "../repos";
import type { KeyValueStore } from "../storage";
import { STORAGE_PREFIX, type SyncBus } from "../sync";
import { Table } from "../table";

export interface LocalStorageAdapterOptions {
  store: KeyValueStore;
  bus: SyncBus;
  builtinRecipes: Recipe[];
  onCorrupt?: (table: string) => void;
}

function stamp<T>(row: NewRow<T> & { id?: string }): T {
  const t = nowIso();
  return { ...row, id: row.id ?? newId(), createdAt: t, updatedAt: t } as T;
}

function touch<T>(patch: Patch<T>): Patch<T> & { updatedAt: string } {
  return { ...patch, updatedAt: nowIso() };
}

/**
 * Persists every repository in localStorage (one JSON array per table)
 * and announces writes on the sync bus so other tabs refresh.
 */
export class LocalStorageAdapter implements Repos {
  readonly migration: MigrationResult;
  private readonly tables;
  private pending = new Set<string>();
  private flushScheduled = false;

  constructor(private readonly opts: LocalStorageAdapterOptions) {
    this.migration = runMigrations(opts.store);
    const hooks = {
      onWrite: (name: string) => this.announce(name),
      onCorrupt: (name: string) => opts.onCorrupt?.(name),
    };
    const t = <S extends { id: string }>(name: string, schema: import("zod").ZodType<S>) =>
      new Table<S>(name, schema, opts.store, hooks);
    this.tables = {
      users: t("users", userSchema),
      households: t("households", householdSchema),
      members: t("members", memberSchema),
      favorites: t("favorites", favoriteSchema),
      recipes: t("recipes", recipeSchema),
      planItems: t("planItems", planItemSchema),
      planDays: t("planDays", planDaySchema),
      cookLog: t("cookLog", cookLogSchema),
      shoppingItems: t("shoppingItems", shoppingItemSchema),
      shoppingChecks: t("shoppingChecks", shoppingCheckSchema),
      pantry: t("pantry", pantryItemSchema),
      prepTasks: t("prepTasks", prepTaskSchema),
      swipes: t("swipes", swipeSchema),
      matches: t("matches", matchSchema),
      activity: t("activity", activitySchema),
    };
  }

  /** Coalesce change events from one tick into a single bus message. */
  private announce(table: string) {
    this.pending.add(table);
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      const tables = [...this.pending];
      this.pending.clear();
      this.flushScheduled = false;
      this.opts.bus.publish({ kind: "change", tables, origin: this.opts.bus.tabId });
    });
  }

  auth: Repos["auth"] = {
    findUserByEmail: async (email) => {
      // Emails are ASCII-case-insensitive; Turkish casing would turn "I" into "ı".
      const e = email.trim().toLowerCase();
      return this.tables.users.all().find((u) => u.email.toLowerCase() === e) ?? null;
    },
    getUser: async (id) => this.tables.users.get(id),
    listUsers: async (ids) => this.tables.users.find((u) => ids.includes(u.id)),
    createUser: async (row) => this.tables.users.insert(stamp(row)),
    updateUser: async (id, patch) => this.tables.users.update(id, touch(patch)),
  };

  households: Repos["households"] = {
    get: async (id) => this.tables.households.get(id),
    findByInviteCode: async (code) => {
      const c = code.trim().toLowerCase();
      return this.tables.households.all().find((h) => h.inviteCode.toLowerCase() === c) ?? null;
    },
    create: async (row) => this.tables.households.insert(stamp(row)),
    update: async (id, patch) => this.tables.households.update(id, touch(patch)),
    listMembers: async (hid) =>
      this.tables.members
        .find((m) => m.householdId === hid)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    membershipOf: async (uid) => this.tables.members.all().find((m) => m.userId === uid) ?? null,
    addMember: async (row) => this.tables.members.insert(stamp(row)),
    removeMember: async (id) => void this.tables.members.remove((m) => m.id === id),
    listFavorites: async (hid) => this.tables.favorites.find((f) => f.householdId === hid),
    addFavorite: async (row) => this.tables.favorites.insert(stamp(row)),
    removeFavorite: async (id) => void this.tables.favorites.remove((f) => f.id === id),
  };

  recipes: Repos["recipes"] = {
    list: async (hid) => [
      ...this.opts.builtinRecipes,
      ...this.tables.recipes.find((r) => hid !== null && r.householdId === hid),
    ],
    get: async (id) => this.opts.builtinRecipes.find((r) => r.id === id) ?? this.tables.recipes.get(id),
    create: async (row) => this.tables.recipes.insert(stamp(row)),
    update: async (id, patch) => {
      if (this.opts.builtinRecipes.some((r) => r.id === id)) {
        throw new Error("Hazır tarifler düzenlenemez; kopyası oluşturulabilir.");
      }
      return this.tables.recipes.update(id, touch(patch));
    },
    remove: async (id) => void this.tables.recipes.remove((r) => r.id === id),
  };

  plan: Repos["plan"] = {
    listItems: async (hid) => this.tables.planItems.find((p) => p.householdId === hid),
    addItem: async (row) => this.tables.planItems.insert(stamp(row)),
    updateItem: async (id, patch) => this.tables.planItems.update(id, touch(patch)),
    removeItem: async (id) => void this.tables.planItems.remove((p) => p.id === id),
    listDays: async (hid) => this.tables.planDays.find((d) => d.householdId === hid),
    upsertDay: async (hid, date, patch, createdBy) => {
      const existing = this.tables.planDays.all().find((d) => d.householdId === hid && d.date === date);
      if (existing) return this.tables.planDays.update(existing.id, touch(patch));
      return this.tables.planDays.insert(
        stamp({
          householdId: hid,
          date,
          status: "open",
          approvals: [],
          leftovers: false,
          returnedRecipeIds: [],
          cookedAt: null,
          createdBy,
          ...patch,
        }),
      );
    },
    listCookLog: async (hid) => this.tables.cookLog.find((c) => c.householdId === hid),
    addCookLog: async (row) => this.tables.cookLog.insert(stamp(row)),
  };

  shopping: Repos["shopping"] = {
    listItems: async (hid) => this.tables.shoppingItems.find((i) => i.householdId === hid),
    addItem: async (row) => this.tables.shoppingItems.insert(stamp(row)),
    removeItem: async (id) => void this.tables.shoppingItems.remove((i) => i.id === id),
    listChecks: async (hid) => this.tables.shoppingChecks.find((c) => c.householdId === hid),
    check: async (row) => {
      // Last write wins: one check per (household, itemKey).
      const others = this.tables.shoppingChecks
        .all()
        .filter((c) => !(c.householdId === row.householdId && c.itemKey === row.itemKey));
      const created = stamp<import("../models").ShoppingCheck>(row);
      this.tables.shoppingChecks.replace([...others, created]);
      return created;
    },
    uncheck: async (hid, key) =>
      void this.tables.shoppingChecks.remove((c) => c.householdId === hid && c.itemKey === key),
    clearChecks: async (hid) => void this.tables.shoppingChecks.remove((c) => c.householdId === hid),
    listPantry: async (hid) => this.tables.pantry.find((p) => p.householdId === hid),
    addPantry: async (rows) => this.tables.pantry.insertMany(rows.map((r) => stamp(r))),
    removePantry: async (id) => void this.tables.pantry.remove((p) => p.id === id),
    replacePantry: async (hid, rows) => {
      const others = this.tables.pantry.all().filter((p) => p.householdId !== hid);
      this.tables.pantry.replace([...others, ...rows.map((r) => stamp<import("../models").PantryItem>(r))]);
    },
  };

  prep: Repos["prep"] = {
    list: async (hid) => this.tables.prepTasks.find((p) => p.householdId === hid),
    replaceAll: async (hid, rows) => {
      const others = this.tables.prepTasks.all().filter((p) => p.householdId !== hid);
      const created = rows.map((r) => stamp<import("../models").PrepTask>(r));
      this.tables.prepTasks.replace([...others, ...created]);
      return created;
    },
    update: async (id, patch) => this.tables.prepTasks.update(id, touch(patch)),
  };

  swipes: Repos["swipes"] = {
    listSwipes: async (hid) => this.tables.swipes.find((s) => s.householdId === hid),
    addSwipe: async (row) => {
      // One decision per (user, recipe, date, slot): replace an earlier one.
      const others = this.tables.swipes
        .all()
        .filter(
          (s) =>
            !(
              s.householdId === row.householdId &&
              s.userId === row.userId &&
              s.recipeId === row.recipeId &&
              s.date === row.date &&
              s.slot === row.slot
            ),
        );
      const created = stamp<import("../models").Swipe>(row);
      this.tables.swipes.replace([...others, created]);
      return created;
    },
    listMatches: async (hid) => this.tables.matches.find((m) => m.householdId === hid),
    addMatch: async (row) => this.tables.matches.insert(stamp(row)),
    updateMatch: async (id, patch) => this.tables.matches.update(id, touch(patch)),
  };

  activity: Repos["activity"] = {
    list: async (hid, limit) => {
      const rows = this.tables.activity
        .find((a) => a.householdId === hid)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return limit ? rows.slice(0, limit) : rows;
    },
    add: async (row) => this.tables.activity.insert(stamp(row)),
  };

  async resetAll(): Promise<void> {
    for (const k of this.opts.store.keys()) {
      if (k.startsWith(STORAGE_PREFIX) && k !== META_KEY) this.opts.store.removeItem(k);
    }
    this.opts.bus.publish({ kind: "change", tables: ["*"], origin: this.opts.bus.tabId });
  }

  async exportAll(): Promise<Record<string, unknown[]>> {
    const out: Record<string, unknown[]> = {};
    for (const [name, table] of Object.entries(this.tables)) out[name] = table.all();
    return out;
  }
}
