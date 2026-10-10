import { describe, expect, it } from "vitest";
import { sessionIdentity } from "../../src/lib/search/proxy-identity";

describe("anonymous authenticated proxy sessions", () => {
  const secret = "s".repeat(32);
  it("preserves a valid session and signs each request", () => {
    const first = sessionIdentity(undefined, secret, 1000);
    const next = sessionIdentity(first.value, secret, 1001);
    expect(first.fresh).toBe(true);
    expect(next.fresh).toBe(false);
    expect(next.value).toBe(first.value);
    expect(next.header).not.toBe(first.header);
    expect(next.header.split(".")[0]).toBe(first.header.split(".")[0]);
  });
  it("replaces tampered, expired and arbitrarily chosen identities", () => {
    const first = sessionIdentity(undefined, secret, 1000);
    for (const invalid of [first.value + "x", "a".repeat(32), first.value.replace(/.$/, "z")]) {
      const next = sessionIdentity(invalid, secret, 1001);
      expect(next.fresh).toBe(true);
      expect(next.value).not.toBe(first.value);
    }
    expect(sessionIdentity(first.value, secret, 1000 + 30 * 86400).fresh).toBe(true);
  });
});
