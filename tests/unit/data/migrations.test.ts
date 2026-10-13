import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, MIGRATIONS, mapRows, readSchemaVersion, runMigrations } from "@/data/migrations";
import { memoryStore } from "@/data/storage";

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
    runMigrations(store);
    const rows = JSON.parse(store.getItem("anv:t:recipes")!);
    expect(rows[0]).toEqual({ id: "a", sourceUrl: "https://www.instagram.com/reel/Cx1/", sourcePlatform: "instagram" });
    expect(rows[1]).toEqual({ id: "b", source: "Annemin defteri" });
    expect(rows[2]).toEqual({ id: "c" });
    expect(rows[3].sourceUrl).toBe("https://youtu.be/xyz");
    expect(rows[4]).toMatchObject({ sourceUrl: "https://ornek-tarifler.com/kofte", sourcePlatform: "web" });
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
