import type { SearchOptions, SearchOutcome } from "@/types/search";
import type { SearchProvider } from "@/lib/search/provider";
import { SearXNGSearchProvider } from "@/lib/searxng/provider";

/**
 * Lightweight in-memory rate limiter.
 *
 * For a household of 1–10 users on a single long-running Node process
 * this is perfectly adequate. In a serverless deployment (Vercel) each
 * instance has its own counter — that's an acceptable trade-off for a
 * private low-traffic app. We document this limitation in README.
 *
 * Algorithm: fixed window per minute. Allow `limit` requests per
 * client-identifier per window.
 */
class FixedWindowLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}
  /** Returns true if the request is allowed; false if rate-limited. */
  check(key: string): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }
}

interface CacheEntry {
  response: SearchOutcome;
  expiresAt: number;
}

/**
 * Tiny TTL cache. We cache only successful lookups for a short window
 * (default 60s) to avoid hammering SearXNG when a user hits reload or
 * flips between categories. Failures are NOT cached.
 */
class TtlCache {
  private store = new Map<string, CacheEntry>();
  constructor(private readonly ttlMs: number) {}
  get(key: string): SearchOutcome | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.response;
  }
  set(key: string, value: SearchOutcome) {
    if (!value.ok) return; // never cache errors
    this.store.set(key, { response: value, expiresAt: Date.now() + this.ttlMs });
  }
  clear() {
    this.store.clear();
  }
}

export interface SearchServiceOptions {
  provider?: SearchProvider;
  /** Requests per minute per client. Default: 60. */
  rateLimitPerMinute?: number;
  /** Cache TTL in ms. Default: 60_000. */
  cacheTtlMs?: number;
}

function cacheKey(options: SearchOptions): string {
  return [
    options.query,
    options.category ?? "general",
    options.timeRange ?? "none",
    options.language ?? "auto",
    options.safeSearch ?? 1,
    options.page ?? 1,
  ].join("|");
}

export class SearchService {
  private readonly provider: SearchProvider;
  private readonly limiter: FixedWindowLimiter;
  private readonly cache: TtlCache;

  constructor(opts: SearchServiceOptions = {}) {
    this.provider =
      opts.provider ??
      new SearXNGSearchProvider({
        baseUrl: process.env.SEARXNG_URL ?? "",
        authSecret: process.env.SEARXNG_AUTH_SECRET,
        timeoutMs: process.env.SEARXNG_TIMEOUT_MS
          ? Number(process.env.SEARXNG_TIMEOUT_MS)
          : undefined,
      });
    this.limiter = new FixedWindowLimiter(
      opts.rateLimitPerMinute ??
        (process.env.LUMEN_RATE_LIMIT_PER_MINUTE
          ? Number(process.env.LUMEN_RATE_LIMIT_PER_MINUTE)
          : 60),
      60_000,
    );
    this.cache = new TtlCache(
      opts.cacheTtlMs ??
        (process.env.LUMEN_CACHE_TTL_MS
          ? Number(process.env.LUMEN_CACHE_TTL_MS)
          : 60_000),
    );
  }

  /**
   * Run a search. Returns a SearchOutcome — never throws.
   *
   * The optional `clientKey` is used for rate limiting. The API layer
   * should pass a hashed IP or session id (never the raw IP).
   */
  async search(
    options: SearchOptions,
    clientKey = "default",
  ): Promise<SearchOutcome> {
    const key = cacheKey(options);
    const cached = this.cache.get(key);
    if (cached) return cached;

    if (!this.limiter.check(clientKey)) {
      return {
        ok: false,
        error: {
          message: "Too many searches. Try again in a moment.",
          code: "RATE_LIMITED",
          retryable: true,
        },
      };
    }

    const outcome = await this.provider.search(options);
    if (outcome.ok) this.cache.set(key, outcome);
    return outcome;
  }

  /** Test hook. */
  clearCache() {
    this.cache.clear();
  }
}

/**
 * Process-wide singleton. Re-using one instance means the rate
 * limiter and cache survive between requests on a long-running
 * server. On serverless each cold start gets a fresh instance —
 * documented in README.
 */
let singleton: SearchService | null = null;
export function getSearchService(): SearchService {
  if (!singleton) {
    singleton = new SearchService();
  }
  return singleton;
}
