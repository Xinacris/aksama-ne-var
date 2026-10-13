
/**
 * Per-household daily limit for LLM imports. In memory on the server for now
 * (resets on cold start, per instance); moves to a DB counter with Supabase.
 */
export const DAILY_LLM_LIMIT = 30;

export class DailyLimiter {
  private counts = new Map<string, { day: string; n: number }>();
  constructor(
    private readonly limit = DAILY_LLM_LIMIT,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {}

  /** Reserve one call; false when the household has used today's quota. */
  take(key: string): boolean {
    const day = this.today();
    const cur = this.counts.get(key);
    const n = cur && cur.day === day ? cur.n : 0;
    if (n >= this.limit) return false;
    this.counts.set(key, { day, n: n + 1 });
    if (this.counts.size > 5000) this.prune(day);
    return true;
  }

  private prune(day: string) {
    for (const [k, v] of this.counts) if (v.day !== day) this.counts.delete(k);
  }
}
