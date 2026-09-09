"use client";

import * as React from "react";
import type { SearchResponse } from "@/types/search";
import { ResultItem } from "@/components/results/result-item";
import { AlertCircle } from "lucide-react";

export interface ResultsListProps {
  data?: SearchResponse;
  loading: boolean;
  error?: { message: string; code: string; retryable: boolean };
  query: string;
  openInNewTab: boolean;
  showFavicons: boolean;
}

export function ResultsList({
  data,
  loading,
  error,
  query,
  openInNewTab,
  showFavicons,
}: ResultsListProps) {
  // Loading state — restrained, no skeleton grid.
  if (loading && !data) {
    return (
      <div
        className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <span
          className="inline-block h-3 w-3"
          style={{
            border: "1.5px solid var(--border)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "lumen-spin 0.8s linear infinite",
          }}
        />
        Searching for &ldquo;{query}&rdquo;…
      </div>
    );
  }

  // Error state — clear, non-technical message.
  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 py-6 text-sm"
      >
        <AlertCircle
          className="mt-0.5 h-4 w-4 flex-none text-destructive"
          strokeWidth={1.5}
        />
        <div className="space-y-1">
          <p className="text-foreground">{error.message}</p>
          {error.retryable && (
            <p className="text-muted-foreground">Try again in a moment.</p>
          )}
        </div>
      </div>
    );
  }

  // Empty state.
  if (data && data.empty) {
    return (
      <div className="py-8">
        <p className="text-sm text-foreground">
          No results for &ldquo;<span className="font-medium">{query}</span>&rdquo;.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try a different query, change the category, or relax filters.
        </p>
      </div>
    );
  }

  // Results.
  if (data && data.results.length > 0) {
    return (
      <div className="lumen-fade-in">
        <div
          role="region"
          aria-label="Search results"
          aria-busy={loading}
        >
          {data.results.map((r, i) => (
            <div
              key={r.id + "-" + i}
              style={{
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              <ResultItem
                result={r}
                openInNewTab={openInNewTab}
                showFavicon={showFavicons}
              />
            </div>
          ))}
        </div>
        {data.timing !== undefined && (
          <p className="mt-4 text-xs text-muted-foreground">
            Searched in {data.timing.toFixed(2)}s
          </p>
        )}
      </div>
    );
  }

  // Idle (no data, no error, not loading).
  return null;
}
