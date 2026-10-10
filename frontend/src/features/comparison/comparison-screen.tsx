"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { prepareProfile } from "@/lib/search/execution";
import { useSources, useProfiles } from "@/features/search/search-context";
import { comparisonParams } from "@/lib/search/profiles";
import { readApi } from "@/lib/search/client";
import { ResultsList } from "@/components/results/results-list";
import type { CompareResponse } from "@/types/search";
export function ComparisonScreen() {
  const sp = useSearchParams(),
    { profiles } = useProfiles(),
    { engines, loading: sourceLoading } = useSources(),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(sp.get("q") || ""),
    [left, setLeft] = useState("balanced"),
    [right, setRight] = useState("developer"),
    [data, setData] = useState<CompareResponse>(),
    [submitted, setSubmitted] = useState<{
      query: string;
      left: string;
      right: string;
    }>(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const compare = async () => {
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    const l = profiles.find((p) => p.id === left),
      r = profiles.find((p) => p.id === right);
    if (!l || !r || sourceLoading) return;
    const lp = prepareProfile(l, engines),
      rp = prepareProfile(r, engines);
    if (lp.blocked || rp.blocked) {
      setError(
        "All selected sources are unavailable in a profile. Edit it before comparing.",
      );
      return;
    }
    const messages = [lp, rp]
      .flatMap((p, i) => [
        p.unavailable.length
          ? `${i === 0 ? l.name : r.name}: unavailable sources omitted (${p.unavailable.join(", ")}).`
          : "",
        p.cleared.length
          ? `Unsupported filters cleared: ${p.cleared.join(", ")}.`
          : "",
      ])
      .filter(Boolean);
    setNotice(messages.join(" "));

    setLoading(true);
    setError("");
    setData(undefined);
    try {
      const response = await readApi<CompareResponse>(
        "/api/v1/search/compare",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: query.trim(),
            left: comparisonParams(lp.profile),
            right: comparisonParams(rp.profile),
          }),
          signal: abort.signal,
        },
      );
      if (!abort.signal.aborted) {
        setSubmitted({
          query: response.left.query,
          left: l.name,
          right: r.name,
        });
        setData(response);
      }
    } catch (e) {
      if (!abort.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Comparison failed. Try again.",
        );
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  };
  return (
    <main className="lumen-page">
      <p className="eyebrow">Search tools / Profile comparison</p>
      <h1 className="page-heading mt-3">Two perspectives. One query.</h1>
      <p className="page-description max-w-2xl">
        Compare source coverage and ranking side by side. Response time
        describes speed, not search quality.
      </p>
      <form
        className="lumen-panel mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          void compare();
        }}
      >
        <label className="block text-xs mb-2" htmlFor="compare-query">
          Query
        </label>
        <input
          id="compare-query"
          className="lumen-control w-full"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          required
          maxLength={500}
          placeholder="What would you like to compare?"
        />
        <div className="flex flex-wrap gap-5 items-end mt-5">
          <label className="flex flex-col gap-2 text-xs">
            Left profile
            <select
              aria-label="Left profile"
              className="lumen-control"
              value={left}
              onChange={(e) => setLeft(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs">
            Right profile
            <select
              aria-label="Right profile"
              className="lumen-control"
              value={right}
              onChange={(e) => setRight(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="lumen-button lumen-primary"
            disabled={loading || sourceLoading || !query.trim()}
          >
            {loading ? "Comparing…" : "Compare profiles"}
          </button>
        </div>
      </form>
      {notice && (
        <p role="status" className="notice mt-5">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="notice mt-5">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="py-8">
          Searching both profiles…
        </p>
      )}
      {data && (
        <>
          <div className="notice mt-6">
            {data.shared.length} shared results · {data.left_only.length} unique
            to the left · {data.right_only.length} unique to the right
          </div>
          <div className="compare-grid mt-8">
            {(["left", "right"] as const).map((side) => (
              <section
                className="compare-side"
                key={side}
                aria-label={`${side} comparison results`}
              >
                <div className="flex justify-between items-baseline border-b pb-4">
                  <h2 className="text-xl">{submitted?.[side]}</h2>
                  <span className="text-xs text-muted-foreground">
                    {(data[side].timing_ms / 1000).toFixed(2)} s
                  </span>
                </div>
                <ResultsList
                  data={data[side]}
                  loading={false}
                  query={submitted?.query || data[side].query}
                  sharedUrls={data.shared}
                />
              </section>
            ))}
          </div>
        </>
      )}
      {!data && !loading && !error && (
        <p className="empty-state text-sm text-muted-foreground">
          Choose two profiles and run a comparison to see their actual results
          and source statuses.
        </p>
      )}
    </main>
  );
}
