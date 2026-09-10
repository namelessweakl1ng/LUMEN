import type {
  SearchCategory,
  SafeSearchLevel,
  TimeRange,
} from "@/types/search";

/**
 * Hard ceiling on query length. SearXNG itself enforces limits, but we
 * reject absurdly long queries before doing any work.
 */
export const MAX_QUERY_LENGTH = 500;
export const MAX_PAGE_NUMBER = 50;

const VALID_CATEGORIES: readonly SearchCategory[] = [
  "general",
  "news",
  "images",
  "videos",
] as const;

const VALID_TIME_RANGES: readonly TimeRange[] = [
  "day",
  "week",
  "month",
  "year",
  "none",
] as const;

const VALID_SAFE_SEARCH: readonly SafeSearchLevel[] = [0, 1, 2] as const;

/**
 * Allowed language codes. We intentionally keep this list short — these
 * are the languages SearXNG reliably supports and that are useful to a
 * household user.
 *
 * The string "auto" lets SearXNG pick.
 */
export const ALLOWED_LANGUAGES = [
  "auto",
  "en",
  "en-US",
  "hi",
  "bn",
  "te",
  "ta",
  "mr",
  "gu",
  "kn",
  "ml",
  "pa",
  "ur",
  "fr",
  "de",
  "es",
  "it",
  "pt",
  "ru",
  "ja",
  "zh",
  "zh-CN",
  "ko",
  "ar",
] as const;

export type AllowedLanguage = (typeof ALLOWED_LANGUAGES)[number];

/**
 * Validate and normalize a raw query string. Returns null if the query
 * is unusable.
 */
export function normalizeQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_QUERY_LENGTH) return null;
  // Reject control characters (other than the space we already normalized).
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Coerce a category value. Returns the value if valid, otherwise the
 * fallback. Pass `undefined` as the fallback to detect "absent"
 * separately from "invalid" — the page uses this to decide whether to
 * fall back to a user-configured default.
 */
export function coerceCategory(
  raw: unknown,
  fallback: SearchCategory = "general",
): SearchCategory {
  if (typeof raw === "string" && (VALID_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as SearchCategory;
  }
  return fallback;
}

export function coerceTimeRange(
  raw: unknown,
  fallback: TimeRange = "none",
): TimeRange {
  if (typeof raw === "string" && (VALID_TIME_RANGES as readonly string[]).includes(raw)) {
    return raw as TimeRange;
  }
  return fallback;
}

export function coerceSafeSearch(
  raw: unknown,
  fallback: SafeSearchLevel = 1,
): SafeSearchLevel {
  if (typeof raw === "number" && (VALID_SAFE_SEARCH as readonly number[]).includes(raw)) {
    return raw as SafeSearchLevel;
  }
  if (typeof raw === "string") {
    const n = Number(raw);
    if ((VALID_SAFE_SEARCH as readonly number[]).includes(n as SafeSearchLevel)) {
      return n as SafeSearchLevel;
    }
  }
  return fallback;
}

export function coerceLanguage(
  raw: unknown,
  fallback: string = "auto",
): string {
  if (typeof raw === "string" && (ALLOWED_LANGUAGES as readonly string[]).includes(raw)) {
    return raw;
  }
  return fallback;
}

export function coercePage(raw: unknown, fallback: number = 1): number {
  if (raw === null || raw === undefined) return fallback;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), MAX_PAGE_NUMBER);
}
