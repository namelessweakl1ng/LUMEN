"use client";

import * as React from "react";

export interface PaginationProps {
  page: number;
  /** Whether the current response indicated more results are likely.
   *  SearXNG doesn't give us a precise total, so we infer: if the last
   *  page returned a full page of results, a next page is plausible. */
  hasNext: boolean;
  onPageChange: (page: number) => void;
}

/**
 * Minimal prev/next pagination.
 *
 * No giant numbered button list. Keeps focus on content. Keyboard
 * accessible.
 */
export function Pagination({ page, hasNext, onPageChange }: PaginationProps) {
  if (page <= 1 && !hasNext) return null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex items-center gap-3 border-t pt-4"
      style={{ borderTopColor: "var(--border)" }}
    >
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm text-foreground disabled:text-muted-foreground disabled:cursor-not-allowed hover:bg-muted"
        style={{
          border: "1px solid var(--border)",
          borderRadius: "2px",
        }}
        aria-label="Previous page"
      >
        ← Prev
      </button>
      <span className="text-xs text-muted-foreground" aria-current="page">
        Page {page}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
        className="px-3 py-1.5 text-sm text-foreground disabled:text-muted-foreground disabled:cursor-not-allowed hover:bg-muted"
        style={{
          border: "1px solid var(--border)",
          borderRadius: "2px",
        }}
        aria-label="Next page"
      >
        Next →
      </button>
    </nav>
  );
}
