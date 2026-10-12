import type { z } from "zod";
import { isQuotaError, StorageError, type KeyValueStore } from "./storage";
import { STORAGE_PREFIX } from "./sync";

export interface TableHooks {
  onWrite(table: string): void;
  onCorrupt(table: string): void;
}

/**
 * One JSON array per table under `anv:t:<name>`. Reads validate every row
 * with zod and drop invalid ones; unreadable JSON is backed up and treated
 * as an empty table so the app keeps working.
 */
export class Table<T extends { id: string }> {
  readonly key: string;

  constructor(
    readonly name: string,
    private readonly schema: z.ZodType<T>,
    private readonly store: KeyValueStore,
    private readonly hooks: TableHooks,
  ) {
    this.key = `${STORAGE_PREFIX}t:${name}`;
  }

  all(): T[] {
    let raw: string | null;
    try {
      raw = this.store.getItem(this.key);
    } catch (e) {
      throw new StorageError("unavailable", e);
    }
    if (raw === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.quarantine(raw);
      return [];
    }
    if (!Array.isArray(parsed)) {
      this.quarantine(raw);
      return [];
    }
    const rows: T[] = [];
    let dropped = 0;
    for (const item of parsed) {
      const r = this.schema.safeParse(item);
      if (r.success) rows.push(r.data);
      else dropped++;
    }
    if (dropped > 0) this.hooks.onCorrupt(this.name);
    return rows;
  }

  find(pred: (row: T) => boolean): T[] {
    return this.all().filter(pred);
  }

  get(id: string): T | null {
    return this.all().find((r) => r.id === id) ?? null;
  }

  replace(rows: T[]): void {
    try {
      this.store.setItem(this.key, JSON.stringify(rows));
    } catch (e) {
      if (isQuotaError(e)) throw new StorageError("quota", e);
      throw new StorageError("unavailable", e);
    }
    this.hooks.onWrite(this.name);
  }

  insert(row: T): T {
    this.replace([...this.all(), row]);
    return row;
  }

  insertMany(rows: T[]): T[] {
    if (rows.length === 0) return rows;
    this.replace([...this.all(), ...rows]);
    return rows;
  }

  update(id: string, patch: Partial<T>): T {
    const rows = this.all();
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) throw new Error(`${this.name}: kayıt bulunamadı (${id})`);
    const next = { ...rows[i], ...patch, id } as T;
    rows[i] = next;
    this.replace(rows);
    return next;
  }

  remove(pred: (row: T) => boolean): number {
    const rows = this.all();
    const keep = rows.filter((r) => !pred(r));
    if (keep.length !== rows.length) this.replace(keep);
    return rows.length - keep.length;
  }

  clear(): void {
    try {
      this.store.removeItem(this.key);
    } catch (e) {
      throw new StorageError("unavailable", e);
    }
    this.hooks.onWrite(this.name);
  }

  private quarantine(raw: string) {
    try {
      this.store.setItem(`${STORAGE_PREFIX}corrupt:${this.name}:${Date.now()}`, raw);
      this.store.removeItem(this.key);
    } catch {
      // best effort
    }
    this.hooks.onCorrupt(this.name);
  }
}
