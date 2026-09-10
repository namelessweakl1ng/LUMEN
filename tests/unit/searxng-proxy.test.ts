import { describe, expect, test, vi } from "vitest";
import {
  handleSearXNGProxyRequest,
  type SearXNGProxyOptions,
} from "@/lib/searxng/proxy";

const AUTH_SECRET = "test-secret";

function makeOptions(
  upstreamFetch: typeof fetch = vi.fn() as unknown as typeof fetch,
): SearXNGProxyOptions {
  return {
    authSecret: AUTH_SECRET,
    upstreamFetch,
  };
}

function makeRequest(
  url = "http://127.0.0.1:8787/search?q=test",
  init?: RequestInit,
): Request {
  return new Request(url, init);
}

function authenticatedRequest(
  url = "http://127.0.0.1:8787/search?q=test",
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${AUTH_SECRET}`);

  return makeRequest(url, {
    ...init,
    headers,
  });
}

describe("handleSearXNGProxyRequest", () => {
  test("accepts authenticated GET /search", async () => {
    const upstreamFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await handleSearXNGProxyRequest(
      authenticatedRequest(),
      makeOptions(upstreamFetch),
    );

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });

  test("rejects missing credentials with 401", async () => {
    const upstreamFetch = vi.fn<typeof fetch>();

    const response = await handleSearXNGProxyRequest(
      makeRequest(),
      makeOptions(upstreamFetch),
    );

    expect(response.status).toBe(401);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  test("rejects invalid credentials with 401", async () => {
    const upstreamFetch = vi.fn<typeof fetch>();

    const response = await handleSearXNGProxyRequest(
      makeRequest("http://127.0.0.1:8787/search?q=test", {
        headers: {
          Authorization: "Bearer wrong-secret",
        },
      }),
      makeOptions(upstreamFetch),
    );

    expect(response.status).toBe(401);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  test("rejects the wrong path with 404", async () => {
    const upstreamFetch = vi.fn<typeof fetch>();

    const response = await handleSearXNGProxyRequest(
      authenticatedRequest("http://127.0.0.1:8787/not-search?q=test"),
      makeOptions(upstreamFetch),
    );

    expect(response.status).toBe(404);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  test("rejects non-GET requests with 405 and Allow: GET", async () => {
    const upstreamFetch = vi.fn<typeof fetch>();

    const response = await handleSearXNGProxyRequest(
      authenticatedRequest("http://127.0.0.1:8787/search", {
        method: "POST",
      }),
      makeOptions(upstreamFetch),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  test("forwards only the allowlisted query parameters to the fixed upstream", async () => {
    const upstreamFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await handleSearXNGProxyRequest(
      authenticatedRequest(
        "http://127.0.0.1:8787/search?q=coffee&format=json&pageno=2&evil=https%3A%2F%2Fattacker.example&port=9999",
      ),
      makeOptions(upstreamFetch),
    );

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);

    const [calledUrl, init] = upstreamFetch.mock.calls[0]!;
    const upstreamUrl = new URL(String(calledUrl));

    expect(upstreamUrl.origin).toBe("http://127.0.0.1:8080");
    expect(upstreamUrl.pathname).toBe("/search");
    expect(upstreamUrl.searchParams.get("q")).toBe("coffee");
    expect(upstreamUrl.searchParams.get("format")).toBe("json");
    expect(upstreamUrl.searchParams.get("pageno")).toBe("2");
    expect(upstreamUrl.searchParams.has("evil")).toBe(false);
    expect(upstreamUrl.searchParams.has("port")).toBe(false);
    expect(init?.headers).toBeUndefined();
  });

  test("does not forward the incoming Authorization header upstream", async () => {
    const upstreamFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await handleSearXNGProxyRequest(
      authenticatedRequest(),
      makeOptions(upstreamFetch),
    );

    const [, init] = upstreamFetch.mock.calls[0]!;
    const headers = new Headers(init?.headers);

    expect(headers.has("Authorization")).toBe(false);
  });

  test("rejects /search/ instead of accepting a path variant", async () => {
    const upstreamFetch = vi.fn<typeof fetch>();

    const response = await handleSearXNGProxyRequest(
      authenticatedRequest("http://127.0.0.1:8787/search/?q=test"),
      makeOptions(upstreamFetch),
    );

    expect(response.status).toBe(404);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  test("preserves the upstream status and JSON content type", async () => {
    const upstreamFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"error":"upstream"}', {
        status: 429,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Upstream-Header": "should-not-leak",
        },
      }),
    );

    const response = await handleSearXNGProxyRequest(
      authenticatedRequest(),
      makeOptions(upstreamFetch),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Content-Type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("X-Upstream-Header")).toBeNull();
    expect(await response.text()).toBe('{"error":"upstream"}');
  });

  test("returns 502 when the upstream fetch fails", async () => {
    const upstreamFetch = vi.fn<typeof fetch>().mockRejectedValue(
      new Error("connection refused"),
    );

    const response = await handleSearXNGProxyRequest(
      authenticatedRequest(),
      makeOptions(upstreamFetch),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Upstream request failed.",
    });
  });

  test("passes an AbortSignal to the upstream request", async () => {
    const upstreamFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await handleSearXNGProxyRequest(
      authenticatedRequest(),
      makeOptions(upstreamFetch),
    );

    const [, init] = upstreamFetch.mock.calls[0]!;

    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  test("returns 504 when the upstream request times out", async () => {
    const upstreamFetch = vi.fn<typeof fetch>().mockImplementation(
      async (_input, init) => {
        await new Promise<void>((resolve, reject) => {
          const signal = init?.signal;

          if (!signal) {
            reject(new Error("missing abort signal"));
            return;
          }

          if (signal.aborted) {
            reject(new DOMException("The operation was aborted.", "AbortError"));
            return;
          }

          signal.addEventListener(
            "abort",
            () => {
              reject(
                new DOMException("The operation was aborted.", "AbortError"),
              );
            },
            { once: true },
          );
        });

        return new Response();
      },
    );

    const response = await handleSearXNGProxyRequest(
      authenticatedRequest(),
      makeOptions(upstreamFetch),
    );

    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({
      error: "Upstream request timed out.",
    });
  }, 10_000);
});
