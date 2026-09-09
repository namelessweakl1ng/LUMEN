import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SearXNGSearchProvider } from "@/lib/searxng/provider";
import type { SearchOptions } from "@/types/search";

const baseOptions: SearchOptions = {
  query: "linux",
  category: "general",
  timeRange: "none",
  language: "auto",
  safeSearch: 1,
  page: 1,
};

function makeProvider() {
  return new SearXNGSearchProvider({ baseUrl: "http://localhost:8080" });
}

function mockFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("SearXNGSearchProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is not configured when baseUrl is empty", async () => {
    const p = new SearXNGSearchProvider({ baseUrl: "" });
    expect(p.configured).toBe(false);
    const out = await p.search(baseOptions);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("PROVIDER_UNAVAILABLE");
    }
  });

  it("normalizes a well-formed SearXNG response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({
        results: [
          {
            url: "https://example.com/article",
            title: "Example Article",
            content: "A short snippet.",
            engine: "duckduckgo",
            category: "general",
          },
          {
            url: "https://news.example.com/story",
            title: "News Story",
            content: "News snippet.",
            engine: "bing",
          },
        ],
        suggestions: ["linux kernel", "linux distros"],
        number_of_results: 42,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    const out = await p.search(baseOptions);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.response.results.length).toBe(2);
      expect(out.response.results[0].title).toBe("Example Article");
      expect(out.response.results[0].domain).toBe("example.com");
      expect(out.response.results[0].source).toBe("duckduckgo");
      expect(out.response.results[1].domain).toBe("news.example.com");
      expect(out.response.suggestions).toEqual(["linux kernel", "linux distros"]);
      expect(out.response.total).toBe(42);
      expect(out.response.empty).toBe(false);
    }
  });

  it("deduplicates by URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({
        results: [
          { url: "https://example.com/a", title: "A", engine: "ddg" },
          { url: "https://example.com/a", title: "A duplicate", engine: "bing" },
          { url: "https://example.com/b", title: "B", engine: "ddg" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    const out = await p.search(baseOptions);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.response.results.length).toBe(2);
      expect(out.response.results[0].title).toBe("A");
    }
  });

  it("skips malformed results without failing the entire response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({
        results: [
          { url: "not a url", title: "Bad" },
          { url: "javascript:alert(1)", title: "Bad protocol" },
          { url: "https://example.com/good", title: "Good" },
          { title: "Missing URL" },
          { url: "https://example.com/no-title", content: "ok" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    const out = await p.search(baseOptions);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.response.results.length).toBe(2);
      expect(out.response.results[0].url).toBe("https://example.com/good");
      // The no-title result should fall back to the hostname.
      expect(out.response.results[1].title).toBe("example.com");
    }
  });

  it("reports empty when results array is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ results: [], suggestions: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    const out = await p.search(baseOptions);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.response.empty).toBe(true);
      expect(out.response.results.length).toBe(0);
    }
  });

  it("returns PROVIDER_UNAVAILABLE on 500", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse({}, 500));
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    const out = await p.search(baseOptions);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("PROVIDER_UNAVAILABLE");
      expect(out.error.retryable).toBe(true);
    }
  });

  it("returns RATE_LIMITED on 429", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse({}, 429));
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    const out = await p.search(baseOptions);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("RATE_LIMITED");
      expect(out.error.retryable).toBe(true);
    }
  });

  it("returns PROVIDER_MALFORMED on invalid JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    const out = await p.search(baseOptions);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("PROVIDER_MALFORMED");
    }
  });

  it("returns PROVIDER_MALFORMED when body is not an object", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse("not an object"),
    );
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    const out = await p.search(baseOptions);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("PROVIDER_MALFORMED");
    }
  });

  it("returns PROVIDER_MALFORMED when SearXNG reports an `error` field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ error: "Invalid category", results: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    const out = await p.search(baseOptions);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("PROVIDER_MALFORMED");
    }
  });

  it("returns PROVIDER_TIMEOUT on AbortError", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        // Simulate the AbortController firing immediately.
        setTimeout(() => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        }, 0);
        // Noop the signal so we don't actually need a controller:
        void init;
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const p = new SearXNGSearchProvider({
      baseUrl: "http://localhost:8080",
      timeoutMs: 10,
    });
    const out = await p.search(baseOptions);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("PROVIDER_TIMEOUT");
    }
  });

  it("returns PROVIDER_UNAVAILABLE on network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(
      new TypeError("fetch failed: ECONNREFUSED"),
    );
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    const out = await p.search(baseOptions);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("PROVIDER_UNAVAILABLE");
      expect(out.error.retryable).toBe(true);
    }
  });

  it("sends the JSON format flag and category in the request URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    await p.search({ ...baseOptions, category: "news", page: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("format=json");
    expect(url).toContain("categories=news");
    expect(url).toContain("pageno=2");
    expect(url).toContain("q=linux");
  });

  it("applies time_range only when timeRange is not 'none'", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    await p.search({ ...baseOptions, timeRange: "week" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("time_range=week");
  });

  it("does not include time_range when timeRange is 'none'", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    await p.search({ ...baseOptions, timeRange: "none" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("time_range");
  });

  it("applies language only when not 'auto'", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const p = makeProvider();
    await p.search({ ...baseOptions, language: "hi" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("language=hi");
  });
});
