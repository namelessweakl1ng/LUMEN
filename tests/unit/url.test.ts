import { describe, it, expect } from "vitest";
import {
  parseUrl,
  extractDomain,
  truncateUrlForDisplay,
  looksLikeUrl,
} from "@/lib/validation/url";

describe("parseUrl", () => {
  it("parses valid HTTP(S) URLs", () => {
    const u = parseUrl("https://example.com/path?q=1");
    expect(u).not.toBeNull();
    expect(u!.hostname).toBe("example.com");
    expect(u!.pathname).toBe("/path");
  });

  it("returns null for javascript: URLs", () => {
    expect(parseUrl("javascript:alert(1)")).toBeNull();
  });

  it("returns null for data: URLs", () => {
    expect(parseUrl("data:text/plain,hello")).toBeNull();
  });

  it("returns null for file: URLs", () => {
    expect(parseUrl("file:///etc/passwd")).toBeNull();
  });

  it("returns null for non-URL strings", () => {
    expect(parseUrl("not a url")).toBeNull();
    expect(parseUrl("")).toBeNull();
    expect(parseUrl(null)).toBeNull();
    expect(parseUrl(undefined)).toBeNull();
    expect(parseUrl(123)).toBeNull();
  });

  it("handles protocol-relative URLs as https", () => {
    const u = parseUrl("//example.com/path");
    expect(u).not.toBeNull();
    expect(u!.protocol).toBe("https:");
    expect(u!.hostname).toBe("example.com");
  });
});

describe("extractDomain", () => {
  it("strips leading www.", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("example.com");
  });

  it("keeps non-www subdomains", () => {
    expect(extractDomain("https://news.example.com/path")).toBe(
      "news.example.com",
    );
  });

  it("lowercases the host", () => {
    expect(extractDomain("https://EXAMPLE.COM/Path")).toBe("example.com");
  });

  it("returns null for invalid URLs", () => {
    expect(extractDomain("not a url")).toBeNull();
    expect(extractDomain(null)).toBeNull();
  });
});

describe("truncateUrlForDisplay", () => {
  it("returns short URLs unchanged", () => {
    const out = truncateUrlForDisplay("https://example.com/p");
    expect(out).toBe("https://example.com/p");
  });

  it("truncates long URLs", () => {
    const long = "https://example.com/" + "a".repeat(200);
    const out = truncateUrlForDisplay(long, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("…")).toBe(true);
  });

  it("returns the raw string if input is not a URL", () => {
    expect(truncateUrlForDisplay("not a url")).toBe("not a url");
    expect(truncateUrlForDisplay(null)).toBe("");
  });
});

describe("looksLikeUrl", () => {
  it("returns true for explicit https URLs", () => {
    expect(looksLikeUrl("https://example.com")).toBe(true);
    expect(looksLikeUrl("http://example.com/path")).toBe(true);
  });

  it("returns true for bare domains", () => {
    expect(looksLikeUrl("example.com")).toBe(true);
    expect(looksLikeUrl("news.example.com")).toBe(true);
  });

  it("returns false for multi-word queries", () => {
    expect(looksLikeUrl("how to bake bread")).toBe(false);
  });

  it("returns false for empty / whitespace", () => {
    expect(looksLikeUrl("")).toBe(false);
    expect(looksLikeUrl("   ")).toBe(false);
  });

  it("returns false for strings without a dot", () => {
    expect(looksLikeUrl("localhost")).toBe(false);
  });
});
