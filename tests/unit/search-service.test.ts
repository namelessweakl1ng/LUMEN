import { describe, it, expect, vi } from "vitest";
import { SearchService } from "@/lib/search/service";
import type {
  SearchOutcome,
  SearchOptions,
  SearchResponse,
} from "@/types/search";
import type { SearchProvider } from "@/lib/search/provider";

function fakeProvider(outcome: SearchOutcome): SearchProvider {
  return {
    name: "fake",
    configured: true,
    search: vi.fn().mockResolvedValue(outcome),
  };
}

function okResponse(query: string, n = 3): SearchResponse {
  return {
    query,
    results: Array.from({ length: n }, (_, i) => ({
      id: `${query}-${i}`,
      title: `${query} #${i}`,
      url: `https://example.com/${encodeURIComponent(query)}/${i}`,
      domain: "example.com",
      snippet: "snippet",
      category: "general" as const,
    })),
    suggestions: [],
    page: 1,
    category: "general",
    empty: n === 0,
  };
}

const baseOpts: SearchOptions = {
  query: "linux",
  category: "general",
  timeRange: "none",
  language: "auto",
  safeSearch: 1,
  page: 1,
};

describe("SearchService", () => {
  it("caches successful lookups", async () => {
    const provider = fakeProvider({ ok: true, response: okResponse("linux") });
    const svc = new SearchService({ provider, cacheTtlMs: 10_000 });
    await svc.search(baseOpts, "client-a");
    await svc.search(baseOpts, "client-a");
    expect((provider.search as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it("does not cache errors", async () => {
    const provider = fakeProvider({
      ok: false,
      error: {
        message: "down",
        code: "PROVIDER_UNAVAILABLE",
        retryable: true,
      },
    });
    const svc = new SearchService({ provider, cacheTtlMs: 10_000 });
    await svc.search(baseOpts, "client-a");
    await svc.search(baseOpts, "client-a");
    expect((provider.search as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);
  });

  it("rate-limits after the configured limit", async () => {
    const provider = fakeProvider({ ok: true, response: okResponse("linux") });
    const svc = new SearchService({
      provider,
      rateLimitPerMinute: 3,
      cacheTtlMs: 0, // disable caching so every call hits the limiter
    });
    const r1 = await svc.search(baseOpts, "client-a");
    const r2 = await svc.search({ ...baseOpts, query: "a" }, "client-a");
    const r3 = await svc.search({ ...baseOpts, query: "b" }, "client-a");
    const r4 = await svc.search({ ...baseOpts, query: "c" }, "client-a");
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);
    expect(r4.ok).toBe(false);
    if (!r4.ok) {
      expect(r4.error.code).toBe("RATE_LIMITED");
    }
  });

  it("tracks rate limits per client", async () => {
    const provider = fakeProvider({ ok: true, response: okResponse("linux") });
    const svc = new SearchService({
      provider,
      rateLimitPerMinute: 1,
      cacheTtlMs: 0,
    });
    const a1 = await svc.search({ ...baseOpts, query: "a" }, "client-a");
    const b1 = await svc.search({ ...baseOpts, query: "b" }, "client-b");
    const a2 = await svc.search({ ...baseOpts, query: "c" }, "client-a");
    expect(a1.ok).toBe(true);
    expect(b1.ok).toBe(true);
    expect(a2.ok).toBe(false);
  });

  it("different queries don't hit the same cache entry", async () => {
    const provider = fakeProvider({ ok: true, response: okResponse("linux") });
    const svc = new SearchService({ provider, cacheTtlMs: 10_000 });
    await svc.search({ ...baseOpts, query: "linux" }, "c");
    await svc.search({ ...baseOpts, query: "windows" }, "c");
    expect((provider.search as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);
  });
});
