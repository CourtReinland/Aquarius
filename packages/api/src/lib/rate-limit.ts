/**
 * Simple in-process sliding-window rate limiter.
 * Suitable for a single API process; not shared across replicas.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000
  ) {}

  check(key: string): RateLimitResult {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const prior = this.hits.get(key) ?? [];
    const recent = prior.filter((timestamp) => timestamp > cutoff);

    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }

    recent.push(now);
    this.hits.set(key, recent);

    if (this.hits.size > this.maxKeys) {
      this.evictStale(cutoff);
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  private evictStale(cutoff: number) {
    for (const [key, timestamps] of this.hits) {
      const recent = timestamps.filter((timestamp) => timestamp > cutoff);
      if (recent.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, recent);
      }
    }
  }

  /** Test helper */
  reset() {
    this.hits.clear();
  }
}

/** Auth challenge / verify defaults: generous for humans, tight against scrapers. */
export const authIpLimiter = new SlidingWindowRateLimiter(30, 60_000);
export const authAddressLimiter = new SlidingWindowRateLimiter(10, 60_000);
