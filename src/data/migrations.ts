import type { KeyValueStore } from "./storage";
import { STORAGE_PREFIX } from "./sync";

export const META_KEY = `${STORAGE_PREFIX}meta`;
export const CURRENT_SCHEMA_VERSION = 2;

export interface Migration {
  version: number;
  description: string;
  up(store: KeyValueStore): void;
}

function readJsonArray(store: KeyValueStore, key: string): Record<string, unknown>[] | null {
  const raw = store.getItem(key);
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Ordered list of schema migrations. Version 1 is the initial layout;
 * version 2 adds `dinnerTime` to households (default 19:30, as in the design).
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Initial schema",
    up: () => {},
  },
  {
    version: 2,
    description: "Households get a dinner time (default 19:30)",
    up: (store) => {
      const key = `${STORAGE_PREFIX}t:households`;
      const rows = readJsonArray(store, key);
      if (!rows) return;
      store.setItem(key, JSON.stringify(rows.map((r) => ({ dinnerTime: "19:30", ...r }))));
    },
  },
];

export interface MigrationResult {
  from: number;
  to: number;
  applied: number[];
}

export function readSchemaVersion(store: KeyValueStore): number {
  const raw = store.getItem(META_KEY);
  if (!raw) return 0;
  try {
    const v = JSON.parse(raw) as { schemaVersion?: unknown };
    return typeof v.schemaVersion === "number" ? v.schemaVersion : 0;
  } catch {
    return 0;
  }
}

export function runMigrations(store: KeyValueStore, migrations: Migration[] = MIGRATIONS): MigrationResult {
  const from = readSchemaVersion(store);
  const applied: number[] = [];
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  for (const m of sorted) {
    if (m.version <= from) continue;
    m.up(store);
    applied.push(m.version);
    store.setItem(META_KEY, JSON.stringify({ schemaVersion: m.version }));
  }
  const to = sorted.length ? Math.max(from, sorted[sorted.length - 1].version) : from;
  if (applied.length === 0 && from === 0 && to === 0) {
    store.setItem(META_KEY, JSON.stringify({ schemaVersion: 0 }));
  }
  return { from, to, applied };
}
