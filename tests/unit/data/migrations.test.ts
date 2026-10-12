import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, MIGRATIONS, readSchemaVersion, runMigrations } from "@/data/migrations";
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
    expect(r.applied).toEqual([2]);
    const rows = JSON.parse(store.getItem("anv:t:households")!);
    expect(rows[0].dinnerTime).toBe("19:30");
    expect(rows[1].dinnerTime).toBe("20:00");
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
