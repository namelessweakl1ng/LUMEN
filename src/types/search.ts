/**
 * Application-level search types.
 *
 * These types are the ONLY search shape the frontend should depend on.
 * The SearXNG provider is responsible for translating raw SearXNG
 * responses into these types — the rest of the app never sees
 * SearXNG-specific fields.
 */

export type SearchCategory = "general" | "news" | "images" | "videos";

export type TimeRange = "day" | "week" | "month" | "year" | "none";

export type SafeSearchLevel = 0 | 1 | 2;

export interface SearchOptions {
  query: string;
  category?: SearchCategory;
  timeRange?: TimeRange;
  language?: string;
  safeSearch?: SafeSearchLevel;
  page?: number;
}

export interface SearchResult {
  /** Stable identifier derived from url+title hash. */
  id: string;
  title: string;
  url: string;
  /** Display domain, e.g. "example.com" (no scheme, no www). */
  domain: string;
  snippet: string;
  /** Source engine name as reported by the provider, e.g. "DuckDuckGo". */
  source?: string;
  category: SearchCategory;
  publishedAt?: string;
  thumbnail?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  suggestions: string[];
  total?: number;
  page: number;
  category: SearchCategory;
  /** Wall-clock seconds spent by the provider. */
  timing?: number;
  /** True when the provider reported no results at all. */
  empty: boolean;
}

export interface SearchError {
  message: string;
  /** Stable machine code for client switching. */
  code:
    | "QUERY_INVALID"
    | "PROVIDER_UNAVAILABLE"
    | "PROVIDER_TIMEOUT"
    | "PROVIDER_MALFORMED"
    | "RATE_LIMITED"
    | "UNKNOWN";
  /** Whether retrying the same request could plausibly succeed. */
  retryable: boolean;
}

export type SearchOutcome =
  | { ok: true; response: SearchResponse }
  | { ok: false; error: SearchError };
