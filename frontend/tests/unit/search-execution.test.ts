import { describe, expect, it } from "vitest";
import { prepareSearch, prepareProfile } from "../../src/lib/search/execution";
import { BUILTINS } from "../../src/lib/search/profiles";
import type { Engine } from "../../src/types/search";
const engines: Engine[] = [
  {
    id: "github",
    name: "GitHub",
    categories: ["developer"],
    configured: true,
    enabled: true,
    requires_auth: false,
    filters: [],
    rate_limit_per_minute: 30,
  },
  {
    id: "commons",
    name: "Commons",
    categories: ["images"],
    configured: true,
    enabled: true,
    requires_auth: false,
    filters: [],
    rate_limit_per_minute: 30,
  },
];
describe("source-aware execution copies", () => {
  it("clears incompatible filters when moving to images, preserving query and local filters", () => {
    const input = new URLSearchParams(
      "q=cat&category=images&time_range=week&language=fr&file_type=pdf&safe_search=2&site=example.org",
    );
    const result = prepareSearch(input, engines);
    expect(result.params.get("q")).toBe("cat");
    expect(result.params.get("site")).toBe("example.org");
    for (const key of ["time_range", "language", "file_type", "safe_search"])
      expect(result.params.has(key)).toBe(false);
    expect(result.cleared).toHaveLength(4);
    expect(input.get("time_range")).toBe("week");
  });
  it("keeps local date filtering for dated sources", () => {
    expect(
      prepareSearch(
        new URLSearchParams(
          "category=developer&engines=github&time_range=week",
        ),
        engines,
      ).params.get("time_range"),
    ).toBe("week");
  });
  it("omits retired engines from mixed execution without changing stored data", () => {
    const profile = {
      ...BUILTINS[1],
      id: "custom",
      engines: ["brave", "github"],
    };
    const result = prepareProfile(profile, engines);
    expect(result.blocked).toBe(false);
    expect(result.unavailable).toEqual(["brave"]);
    expect(result.profile.engines).toEqual(["github"]);
    expect(profile.engines).toEqual(["brave", "github"]);
  });
  it("blocks all unavailable choices instead of silently selecting default sources", () => {
    const result = prepareSearch(
      new URLSearchParams("q=test&category=developer&engines=brave,commons"),
      engines,
    );
    expect(result.blocked).toBe(true);
    expect(result.unavailable).toEqual(["brave", "commons"]);
    expect(result.params.get("engines")).toBe("brave,commons");
  });
});
