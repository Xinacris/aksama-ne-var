"use client";

import { create } from "zustand";
import { getData, type DataContext } from "@/data";
import type {
  Activity,
  ActivityType,
  Aisle,
  CookLog,
  CookingSession,
  Favorite,
  Household,
  ImportLog,
  LeftoverChoice,
  Match,
  Member,
  PantryItem,
  PlanDay,
  PlanItem,
  PrepTask,
  Recipe,
  ShoppingCheck,
  ShoppingItem,
  Side,
  Slot,
  Swipe,
  Unit,
  User,
} from "@/data/models";
import { STORAGE_ERROR_MESSAGE, StorageError } from "@/data/storage";
import { addDays, listWindow, toIsoDate } from "@/domain/dates";
import { isMatch } from "@/domain/matching";
import * as plan from "@/domain/plan";
import { menuFor } from "@/domain/plan";
import { leftoverSource } from "@/domain/leftovers";
import { courseToSlot } from "@/domain/matching";
import { generatePrepTasks } from "@/domain/prep";
import { consumePantry, generateList, planFinish, type ListRow } from "@/domain/shopping";
import { now, nowIso } from "@/lib/clock";
import { slugify } from "@/lib/text";
import { catalogEntry, normalizeIngredientName } from "@/data/seed/ingredients";
import * as auth from "@/services/auth";
import { AppError, messageOf } from "@/services/errors";
import * as households from "@/services/household";
import { seedDemo } from "@/services/demo";

export type SyncState = "live" | "syncing" | "offline";
export type Status = "booting" | "anon" | "no-household" | "ready";

export interface Presence {
  userId: string;
  route: string;
  at: number;
}

export interface AppData {
  household: Household | null;
  members: Member[];
  people: User[];
  recipes: Recipe[];
  favorites: Favorite[];
  planItems: PlanItem[];
  planDays: PlanDay[];
  cookLog: CookLog[];
  shoppingItems: ShoppingItem[];
  checks: ShoppingCheck[];
  pantry: PantryItem[];
  prepTasks: PrepTask[];
  swipes: Swipe[];
  matches: Match[];
  activity: Activity[];
  importLog: ImportLog[];
  cookingSessions: CookingSession[];
}

const EMPTY: AppData = {
  household: null,
  members: [],
  people: [],
  recipes: [],
  favorites: [],
  planItems: [],
  planDays: [],
  cookLog: [],
  shoppingItems: [],
  checks: [],
  pantry: [],
  prepTasks: [],
  swipes: [],
  matches: [],
  activity: [],
  importLog: [],
  cookingSessions: [],
};

export interface Notice {
  kind: "error" | "info";
  text: string;
}

export interface RecipeInput {
  name: string;
  course: Recipe["course"];
  prepMinutes: number;
  cookMinutes: number;
  /** Undefined clears it on update. */
  waitMinutes?: number;
  servings: number;
  tags: string[];
  ingredients: Recipe["ingredients"];
  prepItems: Recipe["prepItems"];
  steps: string[];
  leftoverPolicy: Recipe["leftoverPolicy"];
  leftoverDays: number;
  freezerItem: string | null;
  source?: string;
  sourceUrl?: string;
  sourceAuthor?: string;
  sourcePlatform?: Recipe["sourcePlatform"];
  sourceThumbnailUrl?: string;
  writtenRecipeUrl?: string;
}

export type InviteInfo =
  | { kind: "ok"; household: Household; owner: User | null; memberCount: number; favorites: Recipe[] }
  | { kind: "missing" }
  | { kind: "full"; household: Household }
  | { kind: "already-member"; household: Household };

export interface AppState extends AppData {
  status: Status;
  me: User | null;
  today: string;
  sync: SyncState;
  offlineWrites: number;
  presence: Record<string, Presence>;
  notice: Notice | null;
  route: string;

  boot(): Promise<void>;
  refresh(): Promise<void>;
  setRoute(route: string): void;
  dismissNotice(): void;
  setNotice(n: Notice | null): void;

  signUp(input: auth.SignUpInput): Promise<User>;
  logIn(input: { email: string; password: string }): Promise<User>;
  logOut(): void;
  updateProfile(patch: { name?: string; avatarInitial?: string }): Promise<void>;

  lookupInvite(code: string): Promise<InviteInfo>;
  createHousehold(): Promise<Household>;
  joinHousehold(code: string): Promise<Household>;
  leaveHousehold(): Promise<void>;
  setDinnerTime(time: string): Promise<void>;
  completeOnboarding(): Promise<void>;

  setFavorites(recipeIds: string[]): Promise<void>;
  toggleFavorite(recipeId: string): Promise<void>;
  addStubRecipe(name: string): Promise<Recipe>;

  addToPlan(args: { date: string; slot: Slot; recipeId: string; source: PlanItem["source"]; matchId?: string }): Promise<void>;
  removeFromPlan(itemId: string): Promise<void>;
  moveItem(itemId: string, toDate: string, toSlot: Slot): Promise<void>;
  ateOut(date: string): Promise<void>;
  clearAteOut(date: string): Promise<void>;
  sendBackToMatches(date: string): Promise<void>;
  moveToTomorrow(date: string): Promise<void>;
  approve(date: string): Promise<void>;
  /** Per-evening leftover choice (null = back to the defaults). */
  setLeftoverChoice(date: string, choice: LeftoverChoice | null): Promise<void>;
  /** Put a dolapta dish on an evening (shopping list skips it). */
  placeLeftover(args: { fromDate: string; recipeId: string; toDate: string; slot?: Slot }): Promise<void>;
  setLunchAtHome(setting: Pick<Household, "lunchAtHome" | "lunchDays">): Promise<void>;

  swipe(recipeId: string, date: string, slot: Slot, decision: Swipe["decision"]): Promise<Match | null>;

  toggleCheck(row: Pick<ListRow, "key" | "name" | "checkedBy">): Promise<void>;
  addManualItem(input: { name: string; quantity: number | null; unit: Unit | null; side?: Side; aisle?: Aisle; forRecipeId?: string | null }): Promise<void>;
  removeManualItem(id: string): Promise<void>;
  finishShopping(): Promise<number>;
  markHave(name: string): Promise<void>;
  unmarkHave(name: string): Promise<void>;

  completeTask(id: string): Promise<void>;
  undoTask(id: string): Promise<void>;

  createRecipe(input: RecipeInput, opts?: { imported?: boolean }): Promise<Recipe>;
  /** Count a produced import draft (usage shown in Ayarlar). Stores no link or caption. */
  logImport(entry: { platform: ImportLog["platform"]; provider: ImportLog["provider"] }): Promise<void>;
  updateRecipe(id: string, input: RecipeInput): Promise<Recipe>;
  deleteRecipe(id: string): Promise<void>;

  /**
   * Open cooking mode: resume the household's session for this menu/recipe or start one.
   * `skipPrep` (nothing missing): a new session — or one still on "Başlamadan önce" — opens on step 1.
   */
  startCooking(key: string, recipeIds: string[], opts?: { skipPrep?: boolean }): Promise<CookingSession | null>;
  updateCooking(id: string, patch: Partial<Pick<CookingSession, "phase" | "dishIndex" | "positions" | "checked" | "timers">>): Promise<void>;
  /** "Afiyet olsun": session done; a menu's evening becomes cooked (cook log, pantry). */
  finishCooking(id: string): Promise<void>;

  loadDemo(): Promise<void>;
  exportJson(): Promise<string>;
  resetAll(): Promise<void>;
}

let data: DataContext | null = null;
function ctx(): DataContext {
  if (!data) data = getData();
  return data;
}
/** Tests inject an in-memory context. */
export function setDataContext(next: DataContext | null) {
  data = next;
}

let presenceTimer: ReturnType<typeof setInterval> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeBus: (() => void) | null = null;

export const useApp = create<AppState>()((set, get) => {
  /** Run an action: map storage/app errors to a calm notice, then reload. */
  async function run<T>(fn: () => Promise<T>, opts: { refresh?: boolean; rethrow?: boolean } = {}): Promise<T> {
    try {
      const out = await fn();
      if (get().sync === "offline") set((s) => ({ offlineWrites: s.offlineWrites + 1 }));
      if (opts.refresh !== false) await get().refresh();
      return out;
    } catch (e) {
      const text = e instanceof StorageError ? STORAGE_ERROR_MESSAGE[e.code] : messageOf(e);
      if (!(e instanceof AppError) || !opts.rethrow) set({ notice: { kind: "error", text } });
      if (opts.rethrow || e instanceof AppError) throw e;
      return undefined as T;
    }
  }

  function requireCtx() {
    const { me, household } = get();
    if (!me || !household) throw new AppError("no-household", "Önce bir eve katılman gerekiyor.");
    return { me, household };
  }

  async function log(type: ActivityType, payload: Activity["data"] = {}) {
    const { me, household } = get();
    if (!me || !household) return;
    await ctx().repos.activity.add({ householdId: household.id, actorId: me.id, type, data: payload, createdBy: me.id });
  }

  function planState(): plan.PlanState {
    const s = get();
    return { items: s.planItems, days: s.planDays, matches: s.matches, recipesById: recipesMap(s.recipes) };
  }

  async function applyOps(ops: plan.PlanOp[]) {
    const { me, household } = requireCtx();
    const { repos } = ctx();
    for (const o of ops) {
      switch (o.op) {
        case "addItem":
          await repos.plan.addItem({ ...o.row, householdId: household.id });
          break;
        case "updateItem":
          await repos.plan.updateItem(o.id, o.patch);
          break;
        case "removeItem":
          await repos.plan.removeItem(o.id);
          break;
        case "upsertDay":
          await repos.plan.upsertDay(household.id, o.date, o.patch, me.id);
          break;
        case "addMatch":
          await repos.swipes.addMatch({ ...o.row, householdId: household.id });
          break;
        case "updateMatch":
          await repos.swipes.updateMatch(o.id, o.patch);
          break;
        case "addCookLog":
          await repos.plan.addCookLog({ ...o.row, householdId: household.id });
          break;
      }
    }
  }

  /** Regenerate prep tasks after any plan change (completion state is kept). */
  async function syncPrepTasks() {
    const { me, household } = requireCtx();
    const { repos } = ctx();
    const [items, existing, recipes, members] = await Promise.all([
      repos.plan.listItems(household.id),
      repos.prep.list(household.id),
      repos.recipes.list(household.id),
      repos.households.listMembers(household.id),
    ]);
    const today = toIsoDate(now());
    const relevant = items.filter((i) => i.date >= addDays(today, -2));
    const drafts = generatePrepTasks({
      householdId: household.id,
      items: relevant,
      recipesById: recipesMap(recipes),
      members,
      existing,
      dinnerTime: household.dinnerTime,
      createdBy: me.id,
    });
    await repos.prep.replaceAll(household.id, drafts);
  }

  async function planChange(ops: plan.PlanOp[], activity?: [ActivityType, Activity["data"]]) {
    if (ops.length === 0) return;
    await applyOps(ops);
    await syncPrepTasks();
    if (activity) await log(activity[0], activity[1]);
  }

  /** Past planned evenings become "cooked": rotation memory + pantry use. */
  async function doRollover() {
    const { me, household } = get();
    if (!me || !household) return;
    const st = planState();
    const today = toIsoDate(now());
    const { ops, cooked } = plan.rollover(st, get().cookLog, today, me.id, nowIso());
    if (ops.length === 0) return;
    await applyOps(ops);
    let pantry = get().pantry;
    for (const c of cooked) {
      const r = st.recipesById.get(c.recipeId);
      if (!r) continue;
      const { update, remove } = consumePantry(pantry, r);
      for (const id of remove) await ctx().repos.shopping.removePantry(id);
      pantry = pantry.filter((p) => !remove.includes(p.id));
      if (update.length) {
        pantry = pantry.map((p) => update.find((u) => u.id === p.id) ?? p);
        await ctx().repos.shopping.replacePantry(
          household.id,
          pantry.map((p) => ({ householdId: p.householdId, name: p.name, quantity: p.quantity, unit: p.unit, createdBy: p.createdBy })),
        );
      }
    }
  }

  function startPresence() {
    if (presenceTimer || typeof window === "undefined") return;
    const beat = () => {
      const { me, household, route } = get();
      if (!me || !household) return;
      ctx().bus.publish({ kind: "presence", userId: me.id, householdId: household.id, route, origin: ctx().bus.tabId, at: Date.now() });
      // prune stale presence
      const cutoff = Date.now() - 12_000;
      const pres = get().presence;
      if (Object.values(pres).some((p) => p.at < cutoff)) {
        set({ presence: Object.fromEntries(Object.entries(pres).filter(([, p]) => p.at >= cutoff)) });
      }
    };
    beat();
    presenceTimer = setInterval(beat, 4000);
    window.addEventListener("pagehide", () => {
      const me = get().me;
      if (me) ctx().bus.publish({ kind: "leave", userId: me.id, origin: ctx().bus.tabId });
    });
  }

  function listenBus() {
    if (unsubscribeBus) return;
    unsubscribeBus = ctx().bus.subscribe((msg) => {
      if (msg.kind === "change") {
        if (get().sync !== "offline") set({ sync: "syncing" });
        void get()
          .refresh()
          .finally(() => {
            if (syncTimer) clearTimeout(syncTimer);
            syncTimer = setTimeout(() => {
              if (get().sync === "syncing") set({ sync: "live" });
            }, 700);
          });
      } else if (msg.kind === "presence") {
        const { household, me } = get();
        if (!household || msg.householdId !== household.id || msg.userId === me?.id) return;
        set((s) => ({ presence: { ...s.presence, [msg.userId]: { userId: msg.userId, route: msg.route, at: msg.at } } }));
      } else if (msg.kind === "leave") {
        set((s) => {
          const next = { ...s.presence };
          delete next[msg.userId];
          return { presence: next };
        });
      }
    });
    if (typeof window !== "undefined") {
      const update = () => set({ sync: navigator.onLine ? "live" : "offline", offlineWrites: navigator.onLine ? 0 : get().offlineWrites });
      window.addEventListener("online", update);
      window.addEventListener("offline", update);
      if (!navigator.onLine) set({ sync: "offline" });
    }
  }

  return {
    ...EMPTY,
    status: "booting",
    me: null,
    today: "1970-01-01",
    sync: "live",
    offlineWrites: 0,
    presence: {},
    notice: null,
    route: "/",

    async boot() {
      listenBus();
      await get().refresh();
      await doRollover();
      if (get().household) {
        await syncPrepTasks().catch(() => {});
        await get().refresh();
      }
      startPresence();
    },

    async refresh() {
      const { repos, session } = ctx();
      try {
        const me = await auth.currentUser(repos, session);
        const today = toIsoDate(now());
        if (!me) {
          set({ ...EMPTY, me: null, status: "anon", today });
          return;
        }
        const membership = await repos.households.membershipOf(me.id);
        const household = membership ? await repos.households.get(membership.householdId) : null;
        if (!household) {
          const recipes = await repos.recipes.list(null);
          set({ ...EMPTY, me, recipes, status: "no-household", today });
          return;
        }
        const hid = household.id;
        const [people, recipes, favorites, planItems, planDays, cookLog, shoppingItems, checks, pantry, prepTasks, swipes, matches, activity, importLog, cookingSessions] =
          await Promise.all([
            households.householdPeople(repos, hid),
            repos.recipes.list(hid),
            repos.households.listFavorites(hid),
            repos.plan.listItems(hid),
            repos.plan.listDays(hid),
            repos.plan.listCookLog(hid),
            repos.shopping.listItems(hid),
            repos.shopping.listChecks(hid),
            repos.shopping.listPantry(hid),
            repos.prep.list(hid),
            repos.swipes.listSwipes(hid),
            repos.swipes.listMatches(hid),
            repos.activity.list(hid, 200),
            repos.imports.list(hid),
            repos.cooking.list(hid),
          ]);
        set({
          me,
          household,
          members: people.members,
          people: people.users,
          recipes,
          favorites,
          planItems,
          planDays,
          cookLog,
          shoppingItems,
          checks,
          pantry,
          prepTasks,
          swipes,
          matches,
          activity,
          importLog,
          cookingSessions,
          status: "ready",
          today,
        });
      } catch (e) {
        const text = e instanceof StorageError ? STORAGE_ERROR_MESSAGE[e.code] : messageOf(e);
        set({ notice: { kind: "error", text } });
        if (get().status === "booting") set({ status: "anon" });
      }
    },

    setRoute(route) {
      set({ route });
    },
    dismissNotice() {
      set({ notice: null });
    },
    setNotice(n) {
      set({ notice: n });
    },

    // ───────── auth ─────────
    async signUp(input) {
      const u = await run(() => auth.signUp(ctx().repos, ctx().session, input), { rethrow: true });
      startPresence();
      return u;
    },
    async logIn(input) {
      const u = await run(() => auth.logIn(ctx().repos, ctx().session, input), { rethrow: true });
      await doRollover();
      startPresence();
      return u;
    },
    logOut() {
      const me = get().me;
      if (me) ctx().bus.publish({ kind: "leave", userId: me.id, origin: ctx().bus.tabId });
      auth.logOut(ctx().session);
      set({ ...EMPTY, me: null, status: "anon", presence: {} });
    },
    async updateProfile(patch) {
      const me = get().me;
      if (!me) return;
      await run(() => ctx().repos.auth.updateUser(me.id, patch));
    },

    // ───────── household ─────────
    async lookupInvite(code) {
      const { repos } = ctx();
      const look = await households.lookupInvite(repos, code, get().me?.id ?? null);
      if (look.kind !== "ok") return look;
      const [favs, recipes] = await Promise.all([
        repos.households.listFavorites(look.household.id),
        repos.recipes.list(look.household.id),
      ]);
      const byId = recipesMap(recipes);
      return {
        kind: "ok",
        household: look.household,
        owner: look.owner,
        memberCount: look.members.length,
        favorites: favs.map((f) => byId.get(f.recipeId)).filter((r): r is Recipe => !!r),
      };
    },
    async createHousehold() {
      const me = get().me;
      if (!me) throw new AppError("anon", "Önce giriş yapalım.");
      return run(() => households.createHousehold(ctx().repos, me), { rethrow: true });
    },
    async joinHousehold(code) {
      const me = get().me;
      if (!me) throw new AppError("anon", "Önce giriş yapalım.");
      const h = await run(() => households.joinHousehold(ctx().repos, me, code), { rethrow: true });
      await syncPrepTasks().catch(() => {});
      await get().refresh();
      return h;
    },
    async leaveHousehold() {
      const me = get().me;
      if (!me) return;
      await run(() => households.leaveHousehold(ctx().repos, me));
    },
    async setDinnerTime(time) {
      const { household } = requireCtx();
      await run(async () => {
        await ctx().repos.households.update(household.id, { dinnerTime: time });
        await get().refresh();
        await syncPrepTasks();
      });
    },
    async completeOnboarding() {
      const me = get().me;
      if (!me || me.onboarded) return;
      await run(() => ctx().repos.auth.updateUser(me.id, { onboarded: true }));
    },

    // ───────── favorites ─────────
    async setFavorites(recipeIds) {
      const { me, household } = requireCtx();
      await run(async () => {
        const current = await ctx().repos.households.listFavorites(household.id);
        const want = new Set(recipeIds);
        for (const f of current) if (!want.has(f.recipeId)) await ctx().repos.households.removeFavorite(f.id);
        const have = new Set(current.map((f) => f.recipeId));
        for (const id of recipeIds) {
          if (!have.has(id)) await ctx().repos.households.addFavorite({ householdId: household.id, recipeId: id, createdBy: me.id });
        }
      });
    },
    async toggleFavorite(recipeId) {
      const { me, household } = requireCtx();
      await run(async () => {
        const f = get().favorites.find((x) => x.recipeId === recipeId);
        if (f) await ctx().repos.households.removeFavorite(f.id);
        else await ctx().repos.households.addFavorite({ householdId: household.id, recipeId, createdBy: me.id });
      });
    },
    async addStubRecipe(name) {
      const { me, household } = requireCtx();
      const clean = name.trim();
      return run(async () => {
        const existing = get().recipes.find((r) => r.name.toLocaleLowerCase("tr") === clean.toLocaleLowerCase("tr"));
        if (existing) return existing;
        return ctx().repos.recipes.create({
          householdId: household.id,
          name: clean.charAt(0).toLocaleUpperCase("tr") + clean.slice(1),
          course: "ana",
          prepMinutes: 0,
          cookMinutes: 0,
          servings: 4,
          tags: [],
          ingredients: [],
          prepItems: [],
          steps: [],
          leftoverPolicy: "none",
          leftoverDays: 2,
          freezerItem: null,
          stub: true,
          createdBy: me.id,
        });
      });
    },

    // ───────── plan ─────────
    async addToPlan(args) {
      const { me } = requireCtx();
      await run(() =>
        planChange(plan.addToPlan(planState(), { ...args, by: me.id }), ["plan.added", { recipeId: args.recipeId, date: args.date }]),
      );
    },
    async removeFromPlan(itemId) {
      const { me } = requireCtx();
      const it = get().planItems.find((i) => i.id === itemId);
      await run(() =>
        planChange(plan.removeFromPlan(planState(), itemId, me.id), ["plan.removed", { recipeId: it?.recipeId ?? null, date: it?.date ?? null }]),
      );
    },
    async moveItem(itemId, toDate, toSlot) {
      const { me } = requireCtx();
      const it = get().planItems.find((i) => i.id === itemId);
      await run(() =>
        planChange(plan.moveItem(planState(), itemId, toDate, toSlot, me.id), ["plan.moved", { recipeId: it?.recipeId ?? null, date: toDate }]),
      );
    },
    async ateOut(date) {
      const { me } = requireCtx();
      await run(() => planChange(plan.markAteOut(planState(), date, me.id), ["plan.ateOut", { date }]));
    },
    async clearAteOut(date) {
      await run(() => planChange(plan.clearAteOut(date)));
    },
    async sendBackToMatches(date) {
      const { me } = requireCtx();
      await run(() => planChange(plan.sendBackToMatches(planState(), date, me.id), ["plan.changed", { date }]));
    },
    async moveToTomorrow(date) {
      const { me } = requireCtx();
      await run(() => planChange(plan.moveDayToTomorrow(planState(), date, me.id), ["plan.changed", { date }]));
    },
    async approve(date) {
      const { me } = requireCtx();
      await run(async () => {
        await applyOps(plan.approve(planState(), date, me.id));
        await log("plan.approved", { date });
      });
    },
    async setLeftoverChoice(date, choice) {
      const { me } = requireCtx();
      const recipeId = leftoverSource(menuFor(get().planItems, date))?.recipeId ?? null;
      await run(async () => {
        await applyOps(plan.setLeftoverChoice(date, choice, me.id));
        await log("leftover.set", { date, recipeId, choice });
      });
    },
    async placeLeftover({ fromDate, recipeId, toDate, slot }) {
      const { me } = requireCtx();
      const r = get().recipes.find((x) => x.id === recipeId);
      const target = slot ?? (r ? courseToSlot(r.course) : null) ?? "ana";
      await run(() =>
        planChange(plan.placeLeftover(planState(), { fromDate, recipeId, toDate, slot: target, by: me.id }), [
          "plan.added",
          { recipeId, date: toDate, leftover: 1 },
        ]),
      );
    },
    async setLunchAtHome(setting) {
      const { household } = requireCtx();
      await run(() => ctx().repos.households.update(household.id, { lunchAtHome: setting.lunchAtHome, lunchDays: [...setting.lunchDays].sort() }));
    },

    // ───────── swipes ─────────
    async swipe(recipeId, date, slot, decision) {
      const { me, household } = requireCtx();
      return run(async () => {
        const { repos } = ctx();
        await repos.swipes.addSwipe({ householdId: household.id, userId: me.id, recipeId, date, slot, decision, createdBy: me.id });
        if (decision !== "like") return null;
        const swipes = await repos.swipes.listSwipes(household.id);
        const memberIds = get().members.map((m) => m.userId);
        if (!isMatch(swipes, recipeId, date, slot, memberIds)) return null;
        const matches = await repos.swipes.listMatches(household.id);
        const existing = matches.find((m) => m.recipeId === recipeId && m.date === date && m.slot === slot);
        if (existing) return existing;
        const m = await repos.swipes.addMatch({
          householdId: household.id,
          recipeId,
          date,
          slot,
          status: "open",
          placedDate: null,
          returnedFrom: null,
          createdBy: me.id,
        });
        await log("match.made", { recipeId, date });
        return m;
      });
    },

    // ───────── shopping ─────────
    async toggleCheck(row) {
      const { me, household } = requireCtx();
      await run(async () => {
        if (row.checkedBy) await ctx().repos.shopping.uncheck(household.id, row.key);
        else {
          await ctx().repos.shopping.check({ householdId: household.id, itemKey: row.key, checkedBy: me.id, createdBy: me.id });
          await log("shopping.checked", { itemName: row.name });
        }
      });
    },
    async addManualItem(input) {
      const { me, household } = requireCtx();
      const name = normalizeIngredientName(input.name);
      if (!name) throw new AppError("invalid", "Ürünün adını yazar mısın?");
      const entry = catalogEntry(name);
      await run(async () => {
        await ctx().repos.shopping.addItem({
          householdId: household.id,
          name,
          quantity: input.quantity,
          unit: input.unit,
          side: input.side ?? entry?.side ?? "market",
          aisle: input.aisle ?? entry?.aisle ?? "Diğer",
          forRecipeId: input.forRecipeId ?? null,
          createdBy: me.id,
        });
        await log("shopping.added", { itemName: name });
      });
    },
    async removeManualItem(id) {
      await run(() => ctx().repos.shopping.removeItem(id));
    },
    async finishShopping() {
      const { me, household } = requireCtx();
      return run(async () => {
        const rows = selectList(get());
        const f = planFinish(rows);
        if (f.boughtCount === 0) return 0;
        await ctx().repos.shopping.addPantry(f.pantryAdds.map((p) => ({ ...p, householdId: household.id, createdBy: me.id })));
        for (const id of f.manualToRemove) await ctx().repos.shopping.removeItem(id);
        await ctx().repos.shopping.clearChecks(household.id);
        await log("shopping.finished", { count: f.boughtCount });
        return f.boughtCount;
      });
    },
    async markHave(name) {
      const { me, household } = requireCtx();
      await run(async () => {
        if (get().pantry.some((p) => p.name === name && p.quantity === null)) return;
        await ctx().repos.shopping.addPantry([{ householdId: household.id, name, quantity: null, unit: null, createdBy: me.id }]);
      });
    },
    async unmarkHave(name) {
      await run(async () => {
        for (const p of get().pantry.filter((x) => x.name === name)) await ctx().repos.shopping.removePantry(p.id);
      });
    },

    // ───────── prep ─────────
    async completeTask(id) {
      const { me } = requireCtx();
      const t = get().prepTasks.find((x) => x.id === id);
      await run(async () => {
        await ctx().repos.prep.update(id, { status: "done", doneBy: me.id, doneAt: nowIso() });
        await log("prep.done", { label: t?.label ?? "", recipeId: t?.recipeId ?? null });
      });
    },
    async undoTask(id) {
      await run(() => ctx().repos.prep.update(id, { status: "pending", doneBy: null, doneAt: null }));
    },

    // ───────── recipes ─────────
    async createRecipe(input, opts) {
      const { me, household } = requireCtx();
      return run(async () => {
        const r = await ctx().repos.recipes.create({ ...input, householdId: household.id, createdBy: me.id, stub: false });
        await log(opts?.imported ? "recipe.imported" : "recipe.created", { recipeId: r.id, platform: input.sourcePlatform ?? null });
        return r;
      });
    },
    async logImport(entry) {
      const { me, household } = requireCtx();
      await run(() => ctx().repos.imports.add({ householdId: household.id, platform: entry.platform, provider: entry.provider, createdBy: me.id }));
    },
    async updateRecipe(id, input) {
      return run(async () => {
        const r = await ctx().repos.recipes.update(id, { ...input, stub: false });
        await log("recipe.updated", { recipeId: id });
        await syncPrepTasks();
        return r;
      });
    },
    async deleteRecipe(id) {
      await run(async () => {
        await ctx().repos.recipes.remove(id);
        await syncPrepTasks();
      });
    },

    // ───────── cooking ─────────
    async startCooking(key, recipeIds, opts = {}) {
      const { me, household } = requireCtx();
      return run(async () => {
        const repos = ctx().repos;
        const sessions = (await repos.cooking.list(household.id)).filter((c) => c.key === key);
        const open = sessions.find((c) => c.finishedAt === null);
        if (open) {
          // The menu may have changed since: keep positions, refresh the dish list.
          const patch: Partial<CookingSession> = {};
          if (open.recipeIds.join() !== recipeIds.join()) Object.assign(patch, { recipeIds, dishIndex: Math.min(open.dishIndex, Math.max(0, recipeIds.length - 1)) });
          if (opts.skipPrep && open.phase === "prep") patch.phase = "steps";
          return Object.keys(patch).length ? repos.cooking.update(open.id, patch) : open;
        }
        const recent = sessions.find((c) => c.finishedAt && now().getTime() - Date.parse(c.finishedAt) < 6 * 3600_000);
        if (recent) return recent;
        for (const old of sessions) await repos.cooking.remove(old.id);
        const created = await repos.cooking.create({
          householdId: household.id,
          key,
          userId: me.id,
          recipeIds,
          phase: opts.skipPrep ? "steps" : "prep",
          dishIndex: 0,
          positions: {},
          checked: [],
          timers: [],
          finishedAt: null,
          createdBy: me.id,
        });
        const isMenu = /^\d{4}-\d{2}-\d{2}$/.test(key);
        await log("cooking.started", { key, date: isMenu ? key : null, recipeId: isMenu ? null : (recipeIds[0] ?? null) });
        return created;
      });
    },
    async updateCooking(id, patch) {
      await run(() => ctx().repos.cooking.update(id, patch));
    },
    async finishCooking(id) {
      const { me, household } = requireCtx();
      await run(async () => {
        const session = get().cookingSessions.find((c) => c.id === id);
        if (!session) return;
        await ctx().repos.cooking.update(id, { phase: "done", finishedAt: nowIso(), timers: session.timers.map((t) => ({ ...t, dismissed: true })) });
        if (/^\d{4}-\d{2}-\d{2}$/.test(session.key)) {
          const { ops, cooked } = plan.markCooked(planState(), get().cookLog, session.key, me.id, nowIso());
          await applyOps(ops);
          let pantry = get().pantry;
          for (const c of cooked) {
            const r = recipesMap(get().recipes).get(c.recipeId);
            if (!r) continue;
            const { update, remove } = consumePantry(pantry, r);
            for (const pid of remove) await ctx().repos.shopping.removePantry(pid);
            pantry = pantry.filter((p) => !remove.includes(p.id)).map((p) => update.find((u) => u.id === p.id) ?? p);
          }
          if (pantry !== get().pantry) {
            await ctx().repos.shopping.replacePantry(
              household.id,
              pantry.map((p) => ({ householdId: p.householdId, name: p.name, quantity: p.quantity, unit: p.unit, createdBy: p.createdBy })),
            );
          }
        }
        await log("cooking.finished", { key: session.key, date: /^\d{4}-\d{2}-\d{2}$/.test(session.key) ? session.key : null, recipeId: session.recipeIds.length === 1 ? session.recipeIds[0] : null });
      });
    },

    // ───────── data ─────────
    async loadDemo() {
      await run(async () => {
        const userId = await seedDemo(ctx().repos, toIsoDate(now()));
        ctx().session.set(userId);
      });
      await syncPrepTasksSafe();
      await markDemoTasks();
      await get().refresh();
    },
    async exportJson() {
      const dump = await ctx().repos.exportAll();
      const scrubbed = {
        ...dump,
        users: (dump.users as User[]).map((u) => ({ ...u, passwordHash: "[gizli]", passwordSalt: "[gizli]" })),
      };
      return JSON.stringify({ app: "aksama-ne-var", exportedAt: nowIso(), data: scrubbed }, null, 2);
    },
    async resetAll() {
      await run(async () => {
        await ctx().repos.resetAll();
        ctx().session.clear();
      });
      set({ ...EMPTY, me: null, status: "anon", presence: {} });
    },
  };

  async function syncPrepTasksSafe() {
    try {
      await get().refresh();
      await syncPrepTasks();
    } catch {
      // ignore: demo still usable without tasks
    }
  }

  /** Demo: the morning freezer task is already done by Ali at 09:12, like the design. */
  async function markDemoTasks() {
    const { household, people } = get();
    if (!household) return;
    const today = toIsoDate(now());
    const tasks = await ctx().repos.prep.list(household.id);
    const ali = people[0];
    const kiyma = tasks.find((t) => t.date === today && t.label === "Kıymayı buzluktan çıkar");
    const doneAt = new Date(now());
    doneAt.setHours(9, 12, 0, 0);
    if (kiyma && ali && now().getTime() >= doneAt.getTime()) {
      await ctx().repos.prep.update(kiyma.id, { status: "done", doneBy: ali.id, doneAt: doneAt.toISOString() });
    }
  }
});

// ───────────────────────── selectors ─────────────────────────

const recipeMapCache = new WeakMap<Recipe[], Map<string, Recipe>>();
export function recipesMap(recipes: Recipe[]): Map<string, Recipe> {
  let m = recipeMapCache.get(recipes);
  if (!m) {
    m = new Map(recipes.map((r) => [r.id, r]));
    recipeMapCache.set(recipes, m);
  }
  return m;
}

export function usersMap(people: User[]): Map<string, User> {
  return new Map(people.map((u) => [u.id, u]));
}

/** Recipe ids whose ingredients feed this week's list (planned + recently returned matches). */
export function listSourceRecipes(s: Pick<AppState, "planItems" | "planDays" | "matches" | "recipes" | "today">): Recipe[] {
  const byId = recipesMap(s.recipes);
  const window = new Set(listWindow(s.today));
  const out: Recipe[] = [];
  // Leftover items are already cooked: nothing to buy for them.
  const items = s.planItems
    .filter((i) => i.source !== "leftover" && window.has(i.date) && s.planDays.find((d) => d.date === i.date)?.status !== "ate-out")
    .sort((a, b) => a.date.localeCompare(b.date) || slotOrder(a.slot) - slotOrder(b.slot));
  for (const i of items) {
    const r = byId.get(i.recipeId);
    if (r) out.push(r);
  }
  const weekAgo = addDays(s.today, -7);
  for (const m of s.matches) {
    if (m.status === "returned" && m.returnedFrom && m.returnedFrom >= weekAgo) {
      const r = byId.get(m.recipeId);
      if (r) out.push(r);
    }
  }
  return out;
}

function slotOrder(s: Slot) {
  return ["corba", "ana", "yaninda", "salata"].indexOf(s);
}

const listCache = new WeakMap<object, ListRow[]>();
export function selectList(s: AppState): ListRow[] {
  const key = s.planItems;
  const hit = listCache.get(key);
  if (hit && (hit as ListRow[] & { __deps?: unknown[] }).__deps?.every((d, i) => d === listDeps(s)[i])) return hit;
  const rows = generateList({
    planned: listSourceRecipes(s),
    pantry: s.pantry,
    manualItems: s.shoppingItems,
    checks: s.checks,
    recipesById: recipesMap(s.recipes),
  });
  (rows as ListRow[] & { __deps?: unknown[] }).__deps = listDeps(s);
  listCache.set(key, rows);
  return rows;
}
function listDeps(s: AppState): unknown[] {
  return [s.planItems, s.planDays, s.matches, s.recipes, s.pantry, s.shoppingItems, s.checks, s.today];
}

export function slugForRecipe(name: string) {
  return slugify(name);
}
