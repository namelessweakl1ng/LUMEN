import { z } from "zod";
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
export const DEFAULT_PAGE_SIZE = 10;

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
 * are the languages SearXNG reliably supports via its `auto-detect`
 * locale mechanism and that are useful to a household user.
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

export function coerceCategory(raw: unknown): SearchCategory {
  if (typeof raw === "string" && (VALID_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as SearchCategory;
  }
  return "general";
}

export function coerceTimeRange(raw: unknown): TimeRange {
  if (typeof raw === "string" && (VALID_TIME_RANGES as readonly string[]).includes(raw)) {
    return raw as TimeRange;
  }
  return "none";
}

export function coerceSafeSearch(raw: unknown): SafeSearchLevel {
  if (typeof raw === "number" && (VALID_SAFE_SEARCH as readonly number[]).includes(raw)) {
    return raw as SafeSearchLevel;
  }
  if (typeof raw === "string") {
    const n = Number(raw);
    if ((VALID_SAFE_SEARCH as readonly number[]).includes(n as SafeSearchLevel)) {
      return n as SafeSearchLevel;
    }
  }
  return 1;
}

export function coerceLanguage(raw: unknown): string {
  if (typeof raw === "string" && (ALLOWED_LANGUAGES as readonly string[]).includes(raw)) {
    return raw;
  }
  return "auto";
}

export function coercePage(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_PAGE_NUMBER);
}

/**
 * Zod schema for the public search API. Used by the route handler to
 * validate query-string parameters before invoking the provider.
 */
export const searchRequestSchema = z.object({
  q: z.string().max(MAX_QUERY_LENGTH),
  category: z.enum(VALID_CATEGORIES as unknown as [SearchCategory, ...SearchCategory[]]).default("general"),
  time: z.enum(VALID_TIME_RANGES as unknown as [TimeRange, ...TimeRange[]]).default("none"),
  language: z.string().default("auto"),
  safe: z.union([z.number(), z.string()]).default(1),
  page: z.union([z.number(), z.string()]).default(1),
});
