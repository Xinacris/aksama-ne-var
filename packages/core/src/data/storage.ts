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

/** Turkish, calm, non-blaming messages surfaced in the UI. */
export const STORAGE_ERROR_MESSAGE: Record<StorageErrorCode, string> = {
  quota: "Tarayıcının kayıt alanı doldu. Eski verileri dışa aktarıp sıfırlamak yer açar.",
  unavailable: "Tarayıcı şu an kayıt yapmamıza izin vermiyor. Gizli pencere olabilir mi?",
  corrupt: "Kayıtlı verilerin bir kısmı okunamadı; o kısmı temiz bir sayfayla açtık.",
};

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
