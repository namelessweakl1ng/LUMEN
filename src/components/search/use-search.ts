"use client";

import * as React from "react";
import type {
  SearchCategory,
  SearchResponse,
  TimeRange,
} from "@/types/search";

export interface UseSearchArgs {
  query: string;
  category: SearchCategory;
  timeRange: TimeRange;
  language: string;
  safeSearch: number;
  page: number;
  enabled: boolean;
}

export interface UseSearchResult {
  data?: SearchResponse;
  error?: { message: string; code: string; retryable: boolean };
  loading: boolean;
  /** Monotonic token that changes whenever a new fetch starts. Used
   *  to discard stale responses. */
  token: number;
}

/**
 * Client-side search hook.
 *
 * - Cancels stale requests when args change mid-flight.
 * - Skips the request when `enabled` is false or query is empty.
 * - Returns a stable, friendly error shape.
 */
export function useSearch(args: UseSearchArgs): UseSearchResult {
  const { query, category, timeRange, language, safeSearch, page, enabled } = args;
  const [data, setData] = React.useState<SearchResponse | undefined>(undefined);
  const [error, setError] = React.useState<UseSearchResult["error"]>(undefined);
  const [loading, setLoading] = React.useState(false);
  const [token, setToken] = React.useState(0);

  // Keep the latest args in a ref so the abort logic can read them
  // without re-subscribing on every change.
  const argsRef = React.useRef(args);
  React.useEffect(() => {
    argsRef.current = args;
  }, [args]);

  React.useEffect(() => {
    if (!enabled || query.trim().length === 0) {
      setData(undefined);
      setError(undefined);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const myToken = Date.now();
    setToken(myToken);
    setLoading(true);
    setError(undefined);

    const params = new URLSearchParams({
      q: query,
      category,
      time: timeRange,
      language,
      safe: String(safeSearch),
      page: String(page),
    });

    fetch(`/api/search?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err =
            body?.error ??
            {
              message: "Search failed.",
              code: "UNKNOWN",
              retryable: false,
            };
          throw err;
        }
        // Stale guard — discard responses from older requests.
        if (argsRef.current.query !== query) return;
        setData(body as SearchResponse);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (argsRef.current.query !== query) return;
        const friendly: string =
          err && typeof err === "object" && "message" in err
            ? (err as { message?: unknown }).message
              ? String((err as { message?: unknown }).message)
              : "Search failed."
            : "Search failed.";
        const code: string =
          err && typeof err === "object" && "code" in err
            ? String((err as { code?: unknown }).code)
            : "UNKNOWN";
        const retryable: boolean =
          err && typeof err === "object" && "retryable" in err
            ? Boolean((err as { retryable?: unknown }).retryable)
            : false;
        setError({ message: friendly, code, retryable });
      })
      .finally(() => {
        if (argsRef.current.query !== query) return;
        setLoading(false);
      });

    return () => controller.abort();
  }, [query, category, timeRange, language, safeSearch, page, enabled]);

  return { data, error, loading, token };
}
