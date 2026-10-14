import type { KeyValueStore } from "./storage";
import { STORAGE_PREFIX } from "./sync";

const TAB_KEY = `${STORAGE_PREFIX}session`;
const LAST_KEY = `${STORAGE_PREFIX}lastSession`;

/**
 * Per-tab session: sessionStorage holds the active user id so two tabs can
 * be logged in as different household members. localStorage remembers the
 * last user so a brand-new tab (or a browser restart) stays logged in.
 */
export class SessionStore {
  constructor(
    private readonly tab: KeyValueStore,
    private readonly shared: KeyValueStore,
  ) {}

  get(): string | null {
    try {
      return this.tab.getItem(TAB_KEY) ?? this.shared.getItem(LAST_KEY);
    } catch {
      return null;
    }
  }

  set(userId: string): void {
    try {
      this.tab.setItem(TAB_KEY, userId);
      this.shared.setItem(LAST_KEY, userId);
    } catch {
      // ignore: session simply won't persist
    }
  }

  clear(): void {
    try {
      const current = this.tab.getItem(TAB_KEY);
      this.tab.removeItem(TAB_KEY);
      if (!current || this.shared.getItem(LAST_KEY) === current) this.shared.removeItem(LAST_KEY);
    } catch {
      // ignore
    }
  }
}
