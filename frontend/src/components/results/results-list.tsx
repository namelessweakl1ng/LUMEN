import type { SearchResponse } from "@/types/search";
import { ResultItem } from "./result-item";
export function ResultsList({
  data,
  loading,
  error,
  query,
  showImages,
  openInNewTab,
  sharedUrls,
}: {
  data?: SearchResponse;
  loading: boolean;
  error?: string;
  query: string;
  showImages?: boolean;
  openInNewTab?: boolean;
  sharedUrls?: string[];
}) {
  if (loading)
    return (
      <p role="status" className="py-8 text-sm">
        Searching sources…
      </p>
    );
  if (error)
    return (
      <p role="alert" className="py-8 text-destructive">
        {error}
      </p>
    );
  if (!data) return null;
  return (
    <section aria-label="Search results">
      <p role="status" className="results-status">
        {data.result_count} results · {(data.timing_ms / 1000).toFixed(2)} s ·{" "}
        {data.engine_status
          .filter((s) => s.status === "success")
          .map((s) => s.engine)
          .join(" · ")}
        {data.cached ? " · cached" : ""}
      </p>
      {data.partial && (
        <p className="notice mb-4">
          Some sources could not respond. Results from available sources are
          shown.
        </p>
      )}
      <details className="text-xs text-muted-foreground mb-2">
        <summary className="cursor-pointer">Search diagnostics</summary>
        <ul className="my-2 space-y-1">
          {data.engine_status.map((s) => (
            <li key={s.engine}>
              {s.engine}: {s.status} · {Math.round(s.latency_ms)} ms {s.message}
            </li>
          ))}
        </ul>
        <ul>
          {Object.entries(data.applied_filters).map(([key, value]) => (
            <li key={key}>
              {key.replaceAll("_", " ")}: <FilterValue value={value} />
            </li>
          ))}
        </ul>
      </details>
      {data.results.length ? (
        <div
          className={
            data.category === "images"
              ? "grid grid-cols-1 gap-6 sm:grid-cols-2"
              : ""
          }
        >
          {data.results.map((r) => (
            <div key={r.id}>
              {sharedUrls && (
                <p className="eyebrow mt-5">
                  {sharedUrls.includes(r.url) || sharedUrls.includes(r.id)
                    ? "Shared result"
                    : "Unique to this profile"}
                </p>
              )}
              <ResultItem
                result={r}
                query={query}
                showImages={showImages}
                openInNewTab={openInNewTab}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8">
          No results. Try a different source or relax your filters.
        </p>
      )}
      {data.suggestions.length > 0 && (
        <p className="mt-4 text-sm">
          Suggestions: {data.suggestions.join(", ")}
        </p>
      )}
    </section>
  );
}

function FilterValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "")
    return <span>none</span>;
  if (Array.isArray(value))
    return <span>{value.length ? value.map(String).join(", ") : "none"}</span>;
  if (typeof value === "object")
    return (
      <ul className="ml-4">
        {Object.entries(value).map(([key, nested]) => (
          <li key={key}>
            {key.replaceAll("_", " ")}: <FilterValue value={nested} />
          </li>
        ))}
      </ul>
    );
  return <span>{String(value)}</span>;
}
