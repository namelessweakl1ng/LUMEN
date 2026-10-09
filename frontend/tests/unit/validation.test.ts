import { describe, it, expect } from "vitest";
import {
  normalizeQuery,
  coerceCategory,
  coerceTimeRange,
  coerceSafeSearch,
  coerceLanguage,
  coercePage,
  MAX_QUERY_LENGTH,
} from "@/lib/validation/search";

describe("normalizeQuery", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeQuery("  hello   world  ")).toBe("hello world");
  });

  it("returns null for empty input", () => {
    expect(normalizeQuery("")).toBeNull();
    expect(normalizeQuery("   ")).toBeNull();
    expect(normalizeQuery(null)).toBeNull();
    expect(normalizeQuery(undefined)).toBeNull();
    expect(normalizeQuery(123)).toBeNull();
  });

  it("rejects queries that exceed the max length", () => {
    const tooLong = "a".repeat(MAX_QUERY_LENGTH + 1);
    expect(normalizeQuery(tooLong)).toBeNull();
  });

  it("accepts the maximum length", () => {
    const max = "a".repeat(MAX_QUERY_LENGTH);
    expect(normalizeQuery(max)).toBe(max);
  });

  it("rejects control characters", () => {
    expect(normalizeQuery("hello\u0000world")).toBeNull();
    expect(normalizeQuery("hello\u007F")).toBeNull();
  });
});

describe("coerceCategory", () => {
  it("accepts valid categories", () => {
    expect(coerceCategory("general")).toBe("general");
    expect(coerceCategory("news")).toBe("news");
    expect(coerceCategory("images")).toBe("images");
    expect(coerceCategory("videos")).toBe("videos");
  });

  it("defaults to general for invalid input", () => {
    expect(coerceCategory("music")).toBe("general");
    expect(coerceCategory(null)).toBe("general");
    expect(coerceCategory(undefined)).toBe("general");
    expect(coerceCategory(123)).toBe("general");
  });
});

describe("coerceTimeRange", () => {
  it("accepts valid ranges", () => {
    expect(coerceTimeRange("day")).toBe("day");
    expect(coerceTimeRange("week")).toBe("week");
    expect(coerceTimeRange("month")).toBe("month");
    expect(coerceTimeRange("year")).toBe("year");
    expect(coerceTimeRange("none")).toBe("none");
  });

  it("defaults to none for invalid input", () => {
    expect(coerceTimeRange("hour")).toBe("none");
    expect(coerceTimeRange(null)).toBe("none");
  });
});

describe("coerceSafeSearch", () => {
  it("accepts valid levels", () => {
    expect(coerceSafeSearch(0)).toBe(0);
    expect(coerceSafeSearch(1)).toBe(1);
    expect(coerceSafeSearch(2)).toBe(2);
  });

  it("accepts string-encoded numbers", () => {
    expect(coerceSafeSearch("0")).toBe(0);
    expect(coerceSafeSearch("1")).toBe(1);
    expect(coerceSafeSearch("2")).toBe(2);
  });

  it("defaults to moderate (1) for invalid input", () => {
    expect(coerceSafeSearch(3)).toBe(1);
    expect(coerceSafeSearch("off")).toBe(1);
    expect(coerceSafeSearch(null)).toBe(1);
  });
});

describe("coerceLanguage", () => {
  it("accepts valid language codes", () => {
    expect(coerceLanguage("auto")).toBe("auto");
    expect(coerceLanguage("en")).toBe("en");
    expect(coerceLanguage("hi")).toBe("hi");
    expect(coerceLanguage("zh-CN")).toBe("zh-CN");
  });

  it("defaults to auto for invalid input", () => {
    expect(coerceLanguage("klingon")).toBe("auto");
    expect(coerceLanguage(null)).toBe("auto");
  });
});

describe("coercePage", () => {
  it("accepts positive integers", () => {
    expect(coercePage(1)).toBe(1);
    expect(coercePage("1")).toBe(1);
    expect(coercePage("5")).toBe(5);
  });

  it("defaults to 1 for invalid input", () => {
    expect(coercePage(0)).toBe(1);
    expect(coercePage(-3)).toBe(1);
    expect(coercePage("abc")).toBe(1);
    expect(coercePage(null)).toBe(1);
    expect(coercePage(NaN)).toBe(1);
  });

  it("caps at MAX_PAGE_NUMBER", () => {
    expect(coercePage(9999)).toBe(50);
    expect(coercePage("9999")).toBe(50);
  });
});
