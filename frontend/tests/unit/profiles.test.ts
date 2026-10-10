import { describe, it, expect } from "vitest";
import {
  BUILTINS,
  validateProfiles,
  profileParams,
  comparisonParams,
} from "../../src/lib/search/profiles";
import { searchUrl } from "../../src/lib/search/client";
describe("local search profiles", () => {
  it("restores bounded filters and rejects corrupt storage or reserved IDs", () => {
    const p = {
      ...BUILTINS[0],
      id: "custom",
      name: " My profile ",
      site: "example.org",
      safe_search: 2,
      engines: ["wikipedia"],
    };
    expect(
      validateProfiles([
        p,
        { ...p, id: "bad", safe_search: 4 },
        { ...p, id: "balanced" },
        p,
      ]),
    ).toEqual([{ ...p, name: "My profile" }]);
    expect(validateProfiles({ profiles: [p] })).toEqual([]);
    expect(
      validateProfiles([
        { ...p, site: { bad: true }, language: 42, time_range: "forever" },
      ])[0],
    ).toMatchObject({ site: "", language: "en", time_range: "none" });
  });
  it("applies profile filters, clears stale selection and pagination, retains query", () => {
    const params = profileParams(
      { ...BUILTINS[0], site: "example.org" },
      new URLSearchParams("q=privacy&page=4&engines=github&file_type=pdf"),
    );
    expect(params.get("q")).toBe("privacy");
    expect(params.has("page")).toBe(false);
    expect(params.has("engines")).toBe(false);
    expect(params.has("file_type")).toBe(false);
    expect(params.get("site")).toBe("example.org");
  });
  it("forwards only supported query fields", () => {
    const url = searchUrl(
      new URLSearchParams(
        "q=privacy&site=example.org&destination=http://evil.test&ranking=recency",
      ),
    );
    expect(url).toContain("site=example.org");
    expect(url).toContain("ranking=recency");
    expect(url).not.toContain("destination");
  });
});
import { readPreferences } from "../../src/lib/search/preferences";
it("migrates existing new-tab preference without enabling external thumbnails", () => {
  expect(
    readPreferences(null, {
      state: { openInNewTab: false, showFavicons: true },
    }),
  ).toEqual({ openInNewTab: false, showImages: false });
  expect(
    readPreferences(
      { openInNewTab: true, showImages: true },
      { state: { openInNewTab: false } },
    ),
  ).toEqual({ openInNewTab: true, showImages: true });
  expect(
    readPreferences({ showImages: "true", openInNewTab: "false" }, null),
  ).toEqual({ showImages: false, openInNewTab: true });
});

it("converts local profiles to exact backend comparison filters", () => {
  const request = comparisonParams({
    ...BUILTINS[0],
    id: "custom",
    name: "Stored profile",
    site: " example.org , wikipedia.org ",
    exclude_site: "noise.org",
    preferred_domains: " docs.org ",
    file_type: "",
  });
  expect(request.site).toEqual(["example.org", "wikipedia.org"]);
  expect(request.exclude_site).toEqual(["noise.org"]);
  expect(request.preferred_domains).toEqual(["docs.org"]);
  expect(request.file_type).toBeNull();
  expect(request).not.toHaveProperty("id");
  expect(request).not.toHaveProperty("name");
});
