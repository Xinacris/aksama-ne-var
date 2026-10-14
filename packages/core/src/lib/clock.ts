/**
 * Single source of "now" so tests and demos can pin time.
 * Set `anv.clock` (ISO string) in sessionStorage, or call setNow() in tests.
 */
let fixed: Date | null = null;

export function setNow(d: Date | string | null) {
  fixed = d === null ? null : new Date(d);
}

export function now(): Date {
  if (fixed) return new Date(fixed);
  return new Date();
}

export function nowIso(): string {
  return now().toISOString();
}

/** Run `fn` with the clock pinned to `at`, then restore the previous setting. */
export async function withNow<T>(at: Date | string, fn: () => Promise<T>): Promise<T> {
  const prev = fixed;
  fixed = new Date(at);
  try {
    return await fn();
  } finally {
    fixed = prev;
  }
}
