import { describe, expect, it } from "vitest";
import {
  supportsDateFilter,
  supportsProfileFilter,
} from "../../src/lib/search/capabilities";
import type { Engine } from "../../src/types/search";
const engine = (id: string, filters: string[] = []): Engine => ({
  id,
  name: id,
  categories: ["general"],
  enabled: true,
  configured: true,
  requires_auth: false,
  filters,
  rate_limit_per_minute: 10,
});
describe("search filter capabilities", () => {
  it("permits local domain filters independently of upstream capability", () => {
    for (const field of ["site", "exclude_site", "preferred_domains"]) {
      expect(supportsProfileFilter([engine("wikipedia")], field)).toBe(true);
      expect(supportsProfileFilter([], field)).toBe(true);
    }
  });
  it("enables date filtering for dated adapters or declared source filters", () => {
    for (const id of ["github", "crossref", "hackernews", "google_news"])
      expect(supportsDateFilter([engine(id)])).toBe(true);
    expect(supportsDateFilter([engine("other", ["time_range"])])).toBe(true);
    expect(supportsDateFilter([engine("wikipedia")])).toBe(false);
  });
  it("requires every selected source to support other upstream settings", () => {
    expect(
      supportsProfileFilter(
        [engine("a", ["language"]), engine("b")],
        "language",
      ),
    ).toBe(false);
    expect(supportsProfileFilter([engine("a", ["language"])], "language")).toBe(
      true,
    );
  });
});
