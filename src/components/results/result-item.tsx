"use client";

import * as React from "react";
import type { SearchResult } from "@/types/search";
import { truncateUrlForDisplay } from "@/lib/validation/url";
import { Copy, ExternalLink, Check } from "lucide-react";

export interface ResultItemProps {
  result: SearchResult;
  /** When true, target="_blank" rel="noopener". */
  openInNewTab: boolean;
  /** When true, show a favicon to the left of the domain. */
  showFavicon: boolean;
}

/**
 * A single search result.
 *
 * Layout (vertical):
 *   domain                  [copy] [open]
 *   Title (as a link)
 *   /url/path (truncated)
 *   snippet text…
 *
 * No rounded card. Separated from the next result by spacing and a
 * thin top border (added by the parent list).
 */
export function ResultItem({ result, openInNewTab, showFavicon }: ResultItemProps) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard may be unavailable; do nothing.
    }
  };

  return (
    <article className="py-4">
      {/* Domain + favicon + actions */}
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {showFavicon && <Favicon domain={result.domain} />}
        <span className="font-mono lowercase">{result.domain}</span>
        {result.source && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate">{result.source}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy URL for ${result.title}`}
            title="Copy URL"
            className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
            style={{ borderRadius: "2px" }}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
            ) : (
              <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
          </button>
          {openInNewTab && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${result.title} in a new tab`}
              title="Open in new tab"
              className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
              style={{ borderRadius: "2px" }}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-[15px] leading-snug">
        <a
          href={result.url}
          target={openInNewTab ? "_blank" : undefined}
          rel={openInNewTab ? "noopener noreferrer" : undefined}
          className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:underline"
        >
          {result.title}
        </a>
      </h3>

      {/* URL */}
      <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
        {truncateUrlForDisplay(result.url, 90)}
      </div>

      {/* Snippet */}
      {result.snippet && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {result.snippet}
        </p>
      )}

      {/* Thumbnail for image/video results */}
      {result.thumbnail && (
        <div className="mt-3">
          <img
            src={result.thumbnail}
            alt=""
            className="max-h-40 max-w-full object-cover"
            style={{ borderRadius: "2px", border: "1px solid var(--border)" }}
            loading="lazy"
            onError={(e) => {
              // Hide the image if it fails to load — never break the result.
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
    </article>
  );
}

/**
 * Favicons are loaded from Google's favicon service as a reasonable
 * default. If Google is unreachable the image fails silently — we
 * never let a favicon failure break a result. Users who prefer zero
 * third-party requests can disable favicons in Settings.
 *
 * Note: this is the ONE third-party resource Lumen ever requests
 * directly from the browser, and only when the user has explicitly
 * opted in. All other traffic goes through the SearXNG proxy.
 */
function Favicon({ domain }: { domain: string }) {
  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}`}
      alt=""
      width={12}
      height={12}
      className="h-3 w-3 flex-none"
      style={{ borderRadius: "1px" }}
      loading="lazy"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
