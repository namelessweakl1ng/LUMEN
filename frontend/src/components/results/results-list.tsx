import type { SearchResponse } from "@/types/search";
import { ResultItem } from "./result-item";
export function ResultsList({
  data,
  loading,
  error,
  query,
  showImages,
  openInNewTab,
}: {
  data?: SearchResponse;
  loading: boolean;
  error?: string;
  query: string;
  showImages?: boolean;
  openInNewTab?: boolean;
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
      <p role="status" className="py-4 text-xs text-muted-foreground">
        {data.result_count} returned results · {Math.round(data.timing_ms)} ms
        {data.cached ? " · cached" : ""}
        {data.partial ? " · partial results" : ""}
      </p>
      <details className="text-xs">
        <summary className="cursor-pointer">
          Source status and applied filters
        </summary>
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
            <ResultItem
              key={r.id}
              result={r}
              query={query}
              showImages={showImages}
              openInNewTab={openInNewTab}
            />
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
