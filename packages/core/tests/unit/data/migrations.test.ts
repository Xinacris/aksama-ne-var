import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, MIGRATIONS, mapRows, readSchemaVersion, runMigrations } from "@/data/migrations";
import { importLogSchema, recipeSchema } from "@/data/models";
import { builtinRecipes } from "@/data/seed/recipes";
import { memoryStore } from "@/data/storage";

/** Older migration tests stop at v9 so later additions (v10 `lang`) do not change what they check. */
const upTo = (v: number) => MIGRATIONS.filter((m) => m.version <= v);

describe("migrations", () => {
  it("brings a fresh store to the current version", () => {
    const store = memoryStore();
    const r = runMigrations(store);
    expect(r.from).toBe(0);
    expect(r.applied).toEqual(MIGRATIONS.map((m) => m.version));
    expect(readSchemaVersion(store)).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("is idempotent", () => {
    const store = memoryStore();
    runMigrations(store);
    expect(runMigrations(store).applied).toEqual([]);
  });

  it("adds dinnerTime to v1 households without overwriting existing values", () => {
    const store = memoryStore({
      "anv:meta": JSON.stringify({ schemaVersion: 1 }),
      "anv:t:households": JSON.stringify([{ id: "a" }, { id: "b", dinnerTime: "20:00" }]),
    });
    const r = runMigrations(store);
    expect(r.applied).toEqual(MIGRATIONS.filter((m) => m.version > 1).map((m) => m.version));
    const rows = JSON.parse(store.getItem("anv:t:households")!);
    expect(rows[0].dinnerTime).toBe("19:30");
    expect(rows[1].dinnerTime).toBe("20:00");
  });

  it("v3: moves link-shaped recipe sources into sourceUrl + sourcePlatform", () => {
    const store = memoryStore({
      "anv:meta": JSON.stringify({ schemaVersion: 2 }),
      "anv:t:recipes": JSON.stringify([
        { id: "a", source: "https://www.instagram.com/reel/Cx1/" },
        { id: "b", source: "Annemin defteri" },
        { id: "c" },
        { id: "d", source: "https://youtu.be/abc", sourceUrl: "https://youtu.be/xyz" },
        { id: "e", source: "https://ornek-tarifler.com/kofte" },
      ]),
    });
    runMigrations(store, MIGRATIONS.filter((m) => m.version <= 3));
    const rows = JSON.parse(store.getItem("anv:t:recipes")!);
    expect(rows[0]).toEqual({ id: "a", sourceUrl: "https://www.instagram.com/reel/Cx1/", sourcePlatform: "instagram" });
    expect(rows[1]).toEqual({ id: "b", source: "Annemin defteri" });
    expect(rows[2]).toEqual({ id: "c" });
    expect(rows[3].sourceUrl).toBe("https://youtu.be/xyz");
    expect(rows[4]).toMatchObject({ sourceUrl: "https://ornek-tarifler.com/kofte", sourcePlatform: "web" });
  });

  it("v4: leftovers become choices, old data shows exactly what it did", () => {
    const store = memoryStore({
      "anv:meta": JSON.stringify({ schemaVersion: 3 }),
      "anv:t:recipes": JSON.stringify([
        { id: "a", leftoverFriendly: true },
        { id: "b", leftoverFriendly: false },
        { id: "c", leftoverPolicy: "store", leftoverDays: 3 },
      ]),
      "anv:t:households": JSON.stringify([{ id: "h", dinnerTime: "19:30" }]),
      "anv:t:planDays": JSON.stringify([
        { id: "d1", leftovers: true },
        { id: "d2", leftovers: false },
      ]),
    });
    expect(runMigrations(store, upTo(9)).applied).toEqual([4, 5, 6, 7, 8, 9]);
    expect(JSON.parse(store.getItem("anv:t:recipes")!)).toEqual([
      { id: "a", leftoverPolicy: "lunch", leftoverDays: 2 },
      { id: "b", leftoverPolicy: "none", leftoverDays: 2 },
      { id: "c", leftoverPolicy: "store", leftoverDays: 3 },
    ]);
    expect(JSON.parse(store.getItem("anv:t:households")!)).toEqual([{ id: "h", dinnerTime: "19:30", lunchAtHome: "yes", lunchDays: [] }]);
    expect(JSON.parse(store.getItem("anv:t:planDays")!)).toEqual([
      { id: "d1", leftoverChoice: "lunch", leftoverChoiceBy: null },
      { id: "d2", leftoverChoice: "none", leftoverChoiceBy: null },
    ]);
  });

  it("v1 data migrates all the way and reads back through the current schemas", async () => {
    const { KeyValueAdapter } = await import("@/data/adapters/keyValue");
    const { createLocalBus } = await import("@/data/sync");
    const store = memoryStore({
      "anv:meta": JSON.stringify({ schemaVersion: 1 }),
      "anv:t:households": JSON.stringify([{ id: "h", name: "Ev", inviteCode: "k7m2-tq", createdBy: "u", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" }]),
      "anv:t:planDays": JSON.stringify([
        { id: "d", householdId: "h", date: "2026-10-11", status: "cooked", approvals: [], leftovers: true, returnedRecipeIds: [], cookedAt: null, createdBy: "u", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
      ]),
      "anv:t:recipes": JSON.stringify([
        { id: "r", householdId: "h", name: "Annemin dolması", course: "ana", prepMinutes: 0, cookMinutes: 0, servings: 4, tags: [], ingredients: [], prepItems: [], steps: [], leftoverFriendly: true, freezerItem: null, source: "https://www.instagram.com/reel/Cx1/", createdBy: "u", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
      ]),
    });
    const repos = new KeyValueAdapter({ store, bus: createLocalBus(), builtinRecipes: [] });
    expect((await repos.households.get("h"))?.lunchAtHome).toBe("yes");
    expect((await repos.plan.listDays("h"))[0].leftoverChoice).toBe("lunch");
    expect(await repos.recipes.get("r")).toMatchObject({ leftoverPolicy: "lunch", sourceUrl: "https://www.instagram.com/reel/Cx1/", sourcePlatform: "instagram" });
  });

  it("v5: adds cooking sessions without touching existing tables", () => {
    const store = memoryStore({ "anv:meta": JSON.stringify({ schemaVersion: 4 }), "anv:t:planDays": "[]" });
    expect(runMigrations(store, upTo(9)).applied).toEqual([5, 6, 7, 8, 9]);
    expect(store.getItem("anv:t:planDays")).toBe("[]");
    expect(store.getItem("anv:t:cookingSessions")).toBeNull();
  });

  it("v6: import log path → provider (llm was always Claude)", () => {
    const old = [
      { id: "a", householdId: "h", platform: "tiktok", path: "llm", createdBy: "u", createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z" },
      { id: "b", householdId: "h", platform: null, path: "rules", createdBy: "u", createdAt: "2026-10-02T10:00:00.000Z", updatedAt: "2026-10-02T10:00:00.000Z" },
    ];
    const store = memoryStore({ "anv:meta": JSON.stringify({ schemaVersion: 5 }), "anv:t:importLog": JSON.stringify(old) });
    expect(runMigrations(store, upTo(9)).applied).toEqual([6, 7, 8, 9]);
    const rows = JSON.parse(store.getItem("anv:t:importLog")!);
    expect(rows).toEqual([
      { id: "a", householdId: "h", platform: "tiktok", provider: "claude", createdBy: "u", createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z" },
      { id: "b", householdId: "h", platform: null, provider: "rules", createdBy: "u", createdAt: "2026-10-02T10:00:00.000Z", updatedAt: "2026-10-02T10:00:00.000Z" },
    ]);
  });

  it("v7: built-in rows reset to Artmaz; household recipes keep their choice", () => {
    const old = [
      { id: "kuru-fasulye", householdId: null, leftoverPolicy: "store", leftoverDays: 3 },
      { id: "tavuk-sote", householdId: null, leftoverPolicy: "lunch", leftoverDays: 2 },
      { id: "u1", householdId: "h", leftoverPolicy: "store", leftoverDays: 4 },
      { id: "u2", householdId: "h", leftoverPolicy: "lunch", leftoverDays: 2 },
    ];
    const store = memoryStore({ "anv:meta": JSON.stringify({ schemaVersion: 6 }), "anv:t:recipes": JSON.stringify(old) });
    expect(runMigrations(store, upTo(9)).applied).toEqual([7, 8, 9]);
    expect(JSON.parse(store.getItem("anv:t:recipes")!)).toEqual([
      { id: "kuru-fasulye", householdId: null, leftoverPolicy: "none", leftoverDays: 3 },
      { id: "tavuk-sote", householdId: null, leftoverPolicy: "none", leftoverDays: 2 },
      { id: "u1", householdId: "h", leftoverPolicy: "store", leftoverDays: 4 },
      { id: "u2", householdId: "h", leftoverPolicy: "lunch", leftoverDays: 2 },
    ]);
  });

  it("v8: a v7 recipe reads back unchanged (no waiting, no thumbnail) and validates", () => {
    const row = { ...builtinRecipes[0], id: "u1", householdId: "00000000-0000-4000-8000-000000000001", createdBy: "00000000-0000-4000-8000-000000000002" };
    const store = memoryStore({ "anv:meta": JSON.stringify({ schemaVersion: 7 }), "anv:t:recipes": JSON.stringify([row]) });
    expect(runMigrations(store, upTo(9)).applied).toEqual([8, 9]);
    const [back] = JSON.parse(store.getItem("anv:t:recipes")!);
    expect(back).toEqual(row);
    expect(recipeSchema.safeParse(back).success).toBe(true);
    expect(back.waitMinutes).toBeUndefined();
    expect(recipeSchema.safeParse({ ...row, waitMinutes: 30, sourceThumbnailUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg" }).success).toBe(true);
  });

  it("v9: v8 import log and recipes stay valid; 'web' provider and writtenRecipeUrl accepted", () => {
    const log = { id: "00000000-0000-4000-8000-000000000003", householdId: "00000000-0000-4000-8000-000000000001", platform: "youtube", provider: "gemini", createdBy: "00000000-0000-4000-8000-000000000002", createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z" };
    const store = memoryStore({ "anv:meta": JSON.stringify({ schemaVersion: 8 }), "anv:t:importLog": JSON.stringify([log]) });
    expect(runMigrations(store, upTo(9)).applied).toEqual([9]);
    expect(JSON.parse(store.getItem("anv:t:importLog")!)).toEqual([log]);
    expect(importLogSchema.safeParse(log).success).toBe(true);
    expect(importLogSchema.safeParse({ ...log, provider: "web" }).success).toBe(true);
    const recipe = { ...builtinRecipes[0], id: "u1", householdId: "00000000-0000-4000-8000-000000000001", createdBy: "00000000-0000-4000-8000-000000000002" };
    expect(recipeSchema.safeParse({ ...recipe, writtenRecipeUrl: "https://ornek-mutfak.com/tarif/x/" }).success).toBe(true);
  });

  it("mapRows leaves missing and unreadable tables alone", () => {
    const store = memoryStore({ "anv:t:recipes": "{not json" });
    mapRows(store, "recipes", () => ({ changed: true }));
    mapRows(store, "nothing", () => ({ changed: true }));
    expect(store.getItem("anv:t:recipes")).toBe("{not json");
    expect(store.getItem("anv:t:nothing")).toBeNull();
  });

  it("treats corrupt meta as version 0", () => {
    const store = memoryStore({ "anv:meta": "garbage" });
    expect(readSchemaVersion(store)).toBe(0);
    expect(runMigrations(store).to).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("runs custom migrations in version order", () => {
    const store = memoryStore();
    const order: number[] = [];
    runMigrations(store, [
      { version: 2, description: "b", up: () => void order.push(2) },
      { version: 1, description: "a", up: () => void order.push(1) },
    ]);
    expect(order).toEqual([1, 2]);
  });
});

describe("v10: recipes become bilingual", () => {
  it("sets lang 'tr' on stored recipes and keeps a lang that is already there", () => {
    const store = memoryStore({
      "anv:meta": JSON.stringify({ schemaVersion: 9 }),
      "anv:t:recipes": JSON.stringify([
        { id: "a", name: "Annemin dolması" },
        { id: "b", name: "Pancakes", lang: "en" },
      ]),
    });
    runMigrations(store);
    const rows = JSON.parse(store.getItem("anv:t:recipes")!);
    expect(rows.map((r: { lang: string }) => r.lang)).toEqual(["tr", "en"]);
    expect(readSchemaVersion(store)).toBe(10);
  });

  it("a migrated household recipe still validates, with or without translations", () => {
    const r = { ...builtinRecipes[0], householdId: "11111111-1111-4111-8111-111111111111", lang: "tr", translations: { en: { name: "Beans", steps: ["Cook."] } } };
    expect(recipeSchema.safeParse(r).success).toBe(true);
  });
});
