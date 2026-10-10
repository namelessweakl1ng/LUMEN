import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../../src/app/api/v1/[...path]/route";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const context = (...path: string[]) => ({ params: Promise.resolve({ path }) });
describe("fixed backend boundary", () => {
  it("replaces supplied identity headers with a signed browser session", async () => {
    vi.stubEnv("LUMEN_PROXY_SECRET", "s".repeat(32));
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    const response = await GET(new NextRequest("http://frontend/api/v1/search?q=python", {
      headers: { "X-Lumen-Identity": "forged", "X-Forwarded-For": "203.0.113.1" },
    }), context("search"));
    const headers = fetch.mock.calls[0][1].headers;
    expect(headers["X-Lumen-Identity"]).toMatch(/^[a-f0-9]{32}\.\d+\.[a-f0-9]{64}$/);
    expect(headers["X-Forwarded-For"]).toBeUndefined();
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(response.headers.get("Set-Cookie")).toContain("SameSite=lax");
  });
  it("rejects unknown destinations and wrong method without an outbound request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await GET(
          new NextRequest("http://localhost/api/v1/diagnostics"),
          context("diagnostics"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await POST(
          new NextRequest("http://localhost/api/v1/search", {
            method: "POST",
            body: "{}",
          }),
          context("search"),
        )
      ).status,
    ).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses server-configured origin and never forwards browser auth or cookies", async () => {
    vi.stubEnv("LUMEN_BACKEND_URL", "http://backend:8000");
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('{"results":[]}', {
          status: 429,
          headers: { "Retry-After": "12", "Set-Cookie": "secret=never" },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await GET(
      new NextRequest("http://frontend/api/v1/search?q=privacy", {
        headers: {
          Authorization: "Bearer client-secret",
          Cookie: "client-secret",
        },
      }),
      context("search"),
    );
    expect(String(fetch.mock.calls[0][0])).toBe(
      "http://backend:8000/api/v1/search?q=privacy",
    );
    expect(fetch.mock.calls[0][1]).toMatchObject({
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
    });
    expect(result.status).toBe(429);
    expect(result.headers.get("Retry-After")).toBe("12");
    expect(result.headers.get("Set-Cookie")).toBeNull();
    expect(result.headers.get("Cache-Control")).toBe("no-store");
  });
  it("bounds comparison request body before making network calls", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await POST(
      new NextRequest("http://frontend/api/v1/search/compare", {
        method: "POST",
        body: "a".repeat(65537),
      }),
      context("search", "compare"),
    );
    expect(response.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
});
