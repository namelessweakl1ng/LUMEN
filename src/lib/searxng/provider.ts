import type {
  SearchCategory,
  SearchOptions,
  SearchOutcome,
  SearchResult,
  SearchResponse,
  TimeRange,
} from "@/types/search";
import type { SearchProvider } from "@/lib/search/provider";
import { extractDomain, parseUrl } from "@/lib/validation/url";

/**
 * SearXNG response shape — only the fields we actually read. Anything
 * else is ignored. SearXNG's `/search` endpoint returns this when
 * `format=json` is requested.
 *
 * Reference: https://docs.searxng.org/dev/search_api.html
 */
interface SearXNGResultRaw {
  url?: unknown;
  title?: unknown;
  content?: unknown;
  engine?: unknown;
  category?: unknown;
  publishedDate?: unknown;
  thumbnail?: unknown;
  img_src?: unknown;
  // SearXNG ships many other fields (score, positions, pretty_url, …)
  // which we intentionally ignore.
}

interface SearXNGResponseRaw {
  results?: SearXNGResultRaw[];
  unresponsive_engines?: unknown;
  number_of_results?: unknown;
  corrections?: unknown[];
  suggestions?: unknown[];
  error?: unknown;
}

const SEARCH_TIMEOUT_MS = 8_000;

/** Map Lumen categories to SearXNG categories. 1:1 today, but kept
 *  explicit so future divergence is obvious. */
const CATEGORY_MAP: Record<SearchCategory, string> = {
  general: "general",
  news: "news",
  images: "images",
  videos: "videos",
};

const TIME_MAP: Record<Exclude<TimeRange, "none">, string> = {
  day: "day",
  week: "week",
  month: "month",
  year: "year",
};

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function asString(v: unknown): string | undefined {
  return isString(v) ? v : undefined;
}

/**
 * Stable, dependency-free hash for result IDs. We don't need crypto
 * strength — just uniqueness within a single response.
 */
function hashId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  // unsigned base36
  return (h >>> 0).toString(36);
}

function normalizeResult(
  raw: SearXNGResultRaw,
  fallbackCategory: SearchCategory,
): SearchResult | null {
  const url = asString(raw.url);
  if (!url) return null;
  const parsed = parseUrl(url);
  if (!parsed) return null;

  const title = (asString(raw.title) ?? "").trim();
  // SearXNG sometimes returns empty titles for image results. We
  // still surface them but use the URL as a fallback so the result
  // remains clickable and screen-reader-friendly.
  const displayTitle = title.length > 0 ? title : parsed.hostname;

  const snippet = (asString(raw.content) ?? "").trim();
  const source = asString(raw.engine);
  const categoryRaw = asString(raw.category);
  const category: SearchCategory =
    categoryRaw && (categoryRaw in CATEGORY_MAP)
      ? (categoryRaw as SearchCategory)
      : fallbackCategory;
  const publishedAt = asString(raw.publishedDate);
  const thumbnail = asString(raw.thumbnail) ?? asString(raw.img_src);

  return {
    id: hashId(url + "|" + displayTitle),
    title: displayTitle,
    url: parsed.toString(),
    domain: extractDomain(parsed.toString()) ?? parsed.hostname,
    snippet,
    source,
    category,
    publishedAt,
    thumbnail: thumbnail && parseUrl(thumbnail) ? thumbnail : undefined,
  };
}

function normalizeResponse(
  raw: SearXNGResponseRaw,
  options: SearchOptions,
  timingMs: number,
): SearchResponse {
  const category = options.category ?? "general";
  const rawResults = Array.isArray(raw.results) ? raw.results : [];
  const results: SearchResult[] = [];
  for (const r of rawResults) {
    const normalized = normalizeResult(r, category);
    if (normalized) results.push(normalized);
  }
  // SearXNG sometimes returns duplicate URLs across engines; dedupe
  // by URL keeping the first occurrence (which is typically ranked
  // higher).
  const seen = new Set<string>();
  const deduped = results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions
        .map(asString)
        .filter((s): s is string => typeof s === "string")
        .slice(0, 10)
    : [];

  const totalRaw = raw.number_of_results;
  const total =
    typeof totalRaw === "number" && Number.isFinite(totalRaw)
      ? totalRaw
      : undefined;

  return {
    query: options.query,
    results: deduped,
    suggestions,
    total,
    page: options.page ?? 1,
    category,
    timing: Math.round(timingMs) / 1000,
    empty: deduped.length === 0,
  };
}

export interface SearXNGProviderOptions {
  /** Base URL of the SearXNG instance, e.g. "http://localhost:8080".
   *  No trailing slash. */
  baseUrl: string;
  /** Optional bearer-style secret if the instance is behind a proxy
   *  that requires one. SearXNG itself doesn't use this; it's for
   *  reverse-proxy auth. */
  authSecret?: string;
  /** Override the default request timeout. */
  timeoutMs?: number;
}

export class SearXNGSearchProvider implements SearchProvider {
  readonly name = "SearXNG";
  readonly configured: boolean;
  private readonly baseUrl: string;
  private readonly authSecret?: string;
  private readonly timeoutMs: number;

  constructor(opts: SearXNGProviderOptions) {
    // Normalize: strip trailing slash.
    this.baseUrl = (opts.baseUrl ?? "").replace(/\/+$/, "");
    this.configured = this.baseUrl.length > 0 && parseUrl(this.baseUrl) !== null;
    this.authSecret = opts.authSecret;
    this.timeoutMs = opts.timeoutMs ?? SEARCH_TIMEOUT_MS;
  }

  async search(options: SearchOptions): Promise<SearchOutcome> {
    if (!this.configured) {
      return {
        ok: false,
        error: {
          message: "SearXNG is not configured.",
          code: "PROVIDER_UNAVAILABLE",
          retryable: false,
        },
      };
    }

    const url = this.buildUrl(options);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = performance.now();

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (this.authSecret) {
        headers["Authorization"] = `Bearer ${this.authSecret}`;
      }
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
        cache: "no-store",
      });
      const timingMs = performance.now() - startedAt;

      if (res.status === 429) {
        return {
          ok: false,
          error: {
            message: "SearXNG is rate-limiting requests. Try again shortly.",
            code: "RATE_LIMITED",
            retryable: true,
          },
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          error: {
            message: `SearXNG is unavailable right now. (HTTP ${res.status})`,
            code: "PROVIDER_UNAVAILABLE",
            retryable: res.status >= 500,
          },
        };
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        return {
          ok: false,
          error: {
            message: "SearXNG returned a malformed response.",
            code: "PROVIDER_MALFORMED",
            retryable: false,
          },
        };
      }

      if (typeof json !== "object" || json === null) {
        return {
          ok: false,
          error: {
            message: "SearXNG returned a malformed response.",
            code: "PROVIDER_MALFORMED",
            retryable: false,
          },
        };
      }

      const raw = json as SearXNGResponseRaw;
      // SearXNG surfaces an `error` field on bad requests (e.g. an
      // unknown category). Treat that as a malformed request rather
      // than a server error.
      if (isString(raw.error) && raw.error.length > 0) {
        return {
          ok: false,
          error: {
            message: "SearXNG reported an error. Check the query and try again.",
            code: "PROVIDER_MALFORMED",
            retryable: false,
          },
        };
      }

      const response = normalizeResponse(raw, options, timingMs);
      return { ok: true, response };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return {
          ok: false,
          error: {
            message: "SearXNG took too long to respond.",
            code: "PROVIDER_TIMEOUT",
            retryable: true,
          },
        };
      }
      // fetch throws TypeError on network failure (DNS, refused, etc.)
      return {
        ok: false,
        error: {
          message: "Couldn't reach SearXNG.",
          code: "PROVIDER_UNAVAILABLE",
          retryable: true,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(options: SearchOptions): string {
    const params = new URLSearchParams();
    params.set("q", options.query);
    params.set("format", "json");
    params.set("categories", CATEGORY_MAP[options.category ?? "general"]);
    // pageno is 1-indexed in SearXNG.
    params.set("pageno", String(Math.max(1, options.page ?? 1)));
    const time = options.timeRange ?? "none";
    if (time !== "none") {
      params.set("time_range", TIME_MAP[time]);
    }
    const lang = options.language ?? "auto";
    if (lang !== "auto") {
      params.set("language", lang);
    }
    const safe = options.safeSearch ?? 1;
    params.set("safesearch", String(safe));
    // Strip engines that consistently fail for household use; the
    // SearXNG settings file already restricts the engine set, but
    // asking for results only from engines we know work keeps the
    // JSON payload smaller.
    return `${this.baseUrl}/search?${params.toString()}`;
  }
}
