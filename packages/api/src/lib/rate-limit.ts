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

type RateLimitResponseContext = {
  json: (body: unknown, status?: number) => Response;
  header: (name: string, value: string) => void;
};

/** Shared 429 response for auth and paid AI routes. */
export function rateLimitResponse(
  c: RateLimitResponseContext,
  retryAfterSeconds: number,
  message = 'Rate limit exceeded. Wait before retrying.'
) {
  c.header('Retry-After', String(retryAfterSeconds));
  return c.json(
    {
      error: 'Too many requests',
      message,
      retryAfterSeconds,
    },
    429
  );
}

/** Auth challenge / verify defaults: generous for humans, tight against scrapers. */
export const authIpLimiter = new SlidingWindowRateLimiter(30, 60_000);
export const authAddressLimiter = new SlidingWindowRateLimiter(10, 60_000);

/**
 * Paid AI endpoints burn provider keys.
 * Generate is expensive (up to ~8k tokens) — strictest.
 * Summarize is cheaper — medium.
 * Blue chat is short replies — loosest of the three.
 */
export const legalGenerateIpLimiter = new SlidingWindowRateLimiter(6, 15 * 60_000);
export const legalGenerateAddressLimiter = new SlidingWindowRateLimiter(3, 15 * 60_000);

export const legalSummarizeIpLimiter = new SlidingWindowRateLimiter(20, 15 * 60_000);
export const legalSummarizeAddressLimiter = new SlidingWindowRateLimiter(10, 15 * 60_000);

export const blueChatIpLimiter = new SlidingWindowRateLimiter(40, 60_000);
export const blueChatAddressLimiter = new SlidingWindowRateLimiter(20, 60_000);

/** Test helper — clears all in-process rate limiters used by the API. */
export function __resetRateLimitersForTests() {
  authIpLimiter.reset();
  authAddressLimiter.reset();
  legalGenerateIpLimiter.reset();
  legalGenerateAddressLimiter.reset();
  legalSummarizeIpLimiter.reset();
  legalSummarizeAddressLimiter.reset();
  blueChatIpLimiter.reset();
  blueChatAddressLimiter.reset();
}
