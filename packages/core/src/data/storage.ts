import { labelRecord } from "../i18n";

/**
 * Minimal key-value contract the LocalStorage adapter is written against,
 * so tests can inject an in-memory or failing store.
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export type StorageErrorCode = "quota" | "unavailable" | "corrupt";

/** Calm, non-blaming messages surfaced in the UI (catalog: errors.storage.*). */
export const STORAGE_ERROR_MESSAGE = labelRecord<StorageErrorCode>("errors.storage", ["quota", "unavailable", "corrupt"]);

export class StorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    cause?: unknown,
  ) {
    super(STORAGE_ERROR_MESSAGE[code]);
    this.name = "StorageError";
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

export function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const name = (e as { name?: string }).name ?? "";
  const code = (e as { code?: number }).code;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014;
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    keys: () => [...m.keys()],
  };
}
