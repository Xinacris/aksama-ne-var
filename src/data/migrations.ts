import type { KeyValueStore } from "./storage";
import { STORAGE_PREFIX } from "./sync";

export const META_KEY = `${STORAGE_PREFIX}meta`;
export const CURRENT_SCHEMA_VERSION = 4;

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

type Row = Record<string, unknown>;

/**
 * Rewrite every row of a stored table. Missing or unreadable tables are left
 * alone (the table layer quarantines corrupt data on read).
 */
export function mapRows(store: KeyValueStore, table: string, fn: (row: Row) => Row): void {
  const key = `${STORAGE_PREFIX}t:${table}`;
  const rows = readJsonArray(store, key);
  if (!rows) return;
  store.setItem(key, JSON.stringify(rows.map((r) => (r && typeof r === "object" ? fn(r) : r))));
}

/** Platform of a recipe link, frozen here so later detector changes never rewrite history. */
function platformOf(url: string): "instagram" | "youtube" | "tiktok" | "web" {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").replace(/^m\./, "");
  } catch {
    return "web";
  }
  if (host === "instagram.com" || host === "instagr.am") return "instagram";
  if (host === "youtube.com" || host === "youtu.be" || host === "music.youtube.com") return "youtube";
  if (host.endsWith("tiktok.com")) return "tiktok";
  return "web";
}

/**
 * Ordered list of schema migrations. Version 1 is the initial layout;
 * version 2 adds `dinnerTime` to households (default 19:30, as in the design);
 * version 3 moves link-shaped recipe `source` text into `sourceUrl` + `sourcePlatform`;
 * version 4 makes leftovers a choice (recipe policy, household lunch setting, per-evening choice).
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
  {
    version: 3,
    description: "Recipes keep their link, author and platform separately (recipe import)",
    up: (store) =>
      mapRows(store, "recipes", (r) => {
        const src = typeof r.source === "string" ? r.source.trim() : "";
        if (r.sourceUrl || !/^https?:\/\/\S+$/i.test(src)) return r;
        const { source: _old, ...rest } = r;
        void _old;
        return { ...rest, sourceUrl: src, sourcePlatform: platformOf(src) };
      }),
  },
  {
    version: 4,
    description: "Leftovers become a choice: recipe policy + days, household lunch setting, per-evening choice",
    up: (store) => {
      // Custom recipes: "ertesi güne artar" meant next-day lunch, exactly what `lunch` does now.
      mapRows(store, "recipes", (r) => {
        if (r.leftoverPolicy) return r;
        const { leftoverFriendly, ...rest } = r;
        return { ...rest, leftoverPolicy: leftoverFriendly === true ? "lunch" : "none", leftoverDays: 2 };
      });
      // Households: someone eats lunch at home every day (the old assumption).
      mapRows(store, "households", (h) => ({ lunchAtHome: "yes", lunchDays: [], ...h }));
      // Evenings keep exactly what they showed: true → next-day lunch, false → no leftover.
      mapRows(store, "planDays", (d) => {
        if ("leftoverChoice" in d) return d;
        const { leftovers, ...rest } = d;
        return { ...rest, leftoverChoice: leftovers === true ? "lunch" : "none", leftoverChoiceBy: null };
      });
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
