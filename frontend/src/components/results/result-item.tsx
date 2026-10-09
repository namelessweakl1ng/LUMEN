"use client";
import { useState } from "react";
import type { SearchResult } from "@/types/search";
import { SaveResultButton } from "@/features/workspaces/save-result-button";
import { parseUrl } from "@/lib/validation/url";
function text(value: unknown): string {
  return typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.filter((v) => typeof v === "string").join(", ")
      : "";
}
export function ResultItem({
  result,
  query,
  showImages = false,
  openInNewTab = true,
}: {
  result: SearchResult;
  query?: string;
  showImages?: boolean;
  openInNewTab?: boolean;
}) {
  const [copied, setCopied] = useState(false),
    [image, setImage] = useState(false),
    [imageError, setImageError] = useState(false);
  const url = parseUrl(result.url),
    thumbnail = parseUrl(result.thumbnail_url),
    metadata = result.metadata;
  const licenseUrl = parseUrl(metadata.license_url),
    discussion = parseUrl(metadata.discussion_url);
  return (
    <article className="border-b py-5" data-testid="search-result">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{result.domain}</span>
        <span>via {result.source_engines.join(", ")}</span>
        <span className="ml-auto">#{result.rank}</span>
        <SaveResultButton result={result} query={query} />
        <button
          className="lumen-button"
          onClick={() => {
            navigator.clipboard
              .writeText(result.url)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
          aria-label={`Copy URL for ${result.title}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* External thumbnails are opt-in to preserve browser privacy. */}
      {/* eslint-disable @next/next/no-img-element */}
      {thumbnail && !imageError && (
        <div className="mt-3">
          {image || showImages ? (
            <img
              src={thumbnail.href}
              alt={result.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-48 w-full object-contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <button className="lumen-button" onClick={() => setImage(true)}>
              Load thumbnail · contacts image host
            </button>
          )}
        </div>
      )}
      <h3 className="mt-2 text-lg font-medium">
        {url ? (
          <a
            href={url.href}
            rel="noopener noreferrer"
            target={openInNewTab ? "_blank" : undefined}
            className="hover:underline"
          >
            {result.title}
          </a>
        ) : (
          result.title
        )}
      </h3>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
        {result.url}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {result.snippet}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {typeof metadata.stars === "number" && (
          <span>★ {metadata.stars.toLocaleString()} stars</span>
        )}
        {text(metadata.language) && <span>{text(metadata.language)}</span>}
        {text(metadata.authors) && (
          <span>Authors: {text(metadata.authors)}</span>
        )}
        {text(metadata.venue) && (
          <span>Published in {text(metadata.venue)}</span>
        )}
        {text(metadata.doi) && <span>DOI: {text(metadata.doi)}</span>}
        {typeof metadata.points === "number" && (
          <span>{metadata.points} points</span>
        )}
        {text(metadata.author) && <span>By {text(metadata.author)}</span>}
        {discussion && (
          <a
            className="underline"
            href={discussion.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            Discussion
          </a>
        )}
        {result.published_at && (
          <time dateTime={result.published_at}>
            Published / updated {result.published_at.slice(0, 10)}
          </time>
        )}
      </div>
      {text(metadata.license) && (
        <p className="mt-2 text-xs">
          {licenseUrl ? (
            <a
              href={licenseUrl.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {text(metadata.license)}
            </a>
          ) : (
            text(metadata.license)
          )}
          {text(metadata.attribution) && ` · ${text(metadata.attribution)}`}
          {text(metadata.credit) && ` · ${text(metadata.credit)}`}
        </p>
      )}
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">
          Why this result? · score {result.score.toFixed(3)}
        </summary>
        <Ranking explanation={result.ranking_explanation} />
      </details>
    </article>
  );
}
function Ranking({ explanation }: { explanation: Record<string, unknown> }) {
  const labels: Record<string, string> = {
    relevance: "Query relevance",
    recency: "Recency",
    source_position: "Source position",
    domain_preference: "Preferred domain",
    source_agreement: "Agreeing sources",
    agreement_bonus: "Source agreement bonus",
  };
  const weights =
    explanation.weights && typeof explanation.weights === "object"
      ? (explanation.weights as Record<string, unknown>)
      : {};
  return (
    <div className="mt-2">
      <p>Strategy: {text(explanation.strategy) || "balanced"}</p>
      <dl className="mt-2 grid grid-cols-2 gap-1">
        {Object.entries(labels).flatMap(([key, label]) =>
          typeof explanation[key] === "number"
            ? [
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {(explanation[key] as number).toFixed(3)}
                    {typeof weights[key] === "number"
                      ? ` × weight ${weights[key]}`
                      : ""}
                  </dd>
                </div>,
              ]
            : [],
        )}
      </dl>
    </div>
  );
}
