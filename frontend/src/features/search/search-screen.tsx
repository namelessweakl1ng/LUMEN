"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, ArrowRight } from "lucide-react";
import { SearchInput } from "@/components/search/search-input";
import { useKeyboardShortcut } from "@/components/layout/use-keyboard-shortcut";
import { useSearch } from "@/components/search/use-search";
import { ResultsList } from "@/components/results/results-list";
import { SourceSelection, AdvancedFilters } from "./search-filters";
import { useSources, useProfiles } from "./search-context";
import { prepareSearch } from "@/lib/search/execution";
import { supportsDateFilter } from "@/lib/search/capabilities";
import { profileParams } from "@/lib/search/profiles";
import { usePreferences } from "@/lib/search/preferences-store";
import { recordSearch } from "@/lib/research/store";
import type { SearchCategory } from "@/types/search";
export function SearchScreen({ landing = false }: { landing?: boolean }) {
  const sp = useSearchParams(),
    router = useRouter(),
    q = sp.get("q") || "",
    params = new URLSearchParams(sp.toString());
  const [input, setInput] = useState(q),
    [filters, setFilters] = useState(false),
    [sourcesOpen, setSourcesOpen] = useState(false),
    ref = useRef<HTMLInputElement>(null);
  const {
      engines,
      categories,
      error: sourceError,
      loading: sourceLoading,
    } = useSources(),
    { profiles } = useProfiles();
  const prepared = prepareSearch(params, engines);
  const executionParams = new URLSearchParams(prepared.params);
  if (sourceLoading || prepared.blocked) executionParams.delete("q");
  const { data, error, loading } = useSearch(executionParams),
    { showImages, openInNewTab } = usePreferences();
  useEffect(() => setInput(q), [q]);
  useEffect(() => {
    if (data) void recordSearch(data.query).catch(() => {});
  }, [data]);
  useKeyboardShortcut("/", () => {
    ref.current?.focus();
    ref.current?.select();
  });
  useKeyboardShortcut(
    "Escape",
    () => {
      setFilters(false);
      setSourcesOpen(false);
    },
    { allowInInputs: true },
  );
  const navigate = (p: URLSearchParams) =>
    router.push(`/search?${p}`, { scroll: false });
  const update = (key: string, value: string) => {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    if (key !== "page") p.delete("page");
    p.delete("profile");
    if (key === "category") {
      p.delete("engines");
      p.delete("profile");
    }
    if (key === "category" || key === "engines")
      navigate(prepareSearch(p, engines).params);
    else navigate(p);
  };
  const category = sp.get("category") || "general",
    selected = (sp.get("engines") || "").split(",").filter(Boolean);
  const available = engines.filter(
    (e) =>
      e.enabled &&
      e.configured &&
      e.categories.includes(category as SearchCategory),
  );
  const active = selected.length
    ? available.filter((e) => selected.includes(e.id))
    : available;
  const supported = (field: string) =>
    active.length > 0 && active.every((e) => e.filters.includes(field));
  const supportsDate = supportsDateFilter(active);
  const submit = (value: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set("q", value);
    p.delete("page");
    navigate(p);
  };
  const executionNotice = !sourceLoading &&
    (prepared.unavailable.length > 0 || prepared.cleared.length > 0) && (
      <p className="notice mb-5" role="status">
        {prepared.blocked
          ? "All selected sources are unavailable. Edit your profile or select an available source to search."
          : prepared.unavailable.length
            ? `Unavailable sources omitted: ${prepared.unavailable.join(", ")}. Results use the remaining selected sources.`
            : ""}
        {prepared.cleared.length > 0 &&
          ` Unsupported filters cleared for this search: ${prepared.cleared.join(", ")}.`}
      </p>
    );
  const controls = (
    <div className="search-controls">
      <label>
        Category
        <select
          aria-label="Category"
          className="lumen-control"
          value={category}
          onChange={(e) => update("category", e.target.value)}
        >
          {categories
            .filter((c) => c.available)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.id.charAt(0).toUpperCase() + c.id.slice(1)}
              </option>
            ))}
          {!categories.length && <option value="general">General</option>}
        </select>
      </label>
      <label>
        Profile
        <select
          aria-label="Search profile"
          className="lumen-control"
          value={sp.get("profile") || ""}
          onChange={(e) => {
            const p = profiles.find((p) => p.id === e.target.value);
            if (p) {
              const out = profileParams(p, new URLSearchParams(sp.toString()));
              out.set("profile", p.id);
              navigate(out);
            }
          }}
        >
          <option value="">Custom selection</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="lumen-button"
        aria-expanded={sourcesOpen}
        aria-controls="source-selection"
        onClick={() => setSourcesOpen(!sourcesOpen)}
      >
        Sources{selected.length ? ` · ${selected.length}` : ""}
      </button>
      <button
        className="lumen-button"
        aria-expanded={filters}
        aria-controls="search-filters"
        onClick={() => setFilters(!filters)}
      >
        <SlidersHorizontal size={15} />
        Filters{selected.length ? ` · ${selected.length} sources` : ""}
      </button>
      {q && (
        <Link
          className="lumen-button"
          href={`/compare?q=${encodeURIComponent(q)}`}
        >
          Compare
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
  const sourceSelection = sourcesOpen && (
    <SourceSelection
      available={available}
      selected={selected}
      sourceLoading={sourceLoading}
      update={update}
    />
  );
  const advanced = filters && (
    <AdvancedFilters
      sp={params}
      supported={supported}
      supportsDate={supportsDate}
      q={q}
      navigate={navigate}
      update={update}
    />
  );
  if (landing && !q)
    return (
      <main className="landing">
        <p className="eyebrow">A quieter place to search</p>
        <h1>
          Follow your curiosity.
          <br />
          Find the signal.
        </h1>
        <p className="landing-description">
          Search open knowledge, code and news.
          <br />
          Keep what matters in your own workspace.
        </p>
        <div className="landing-search">
          <SearchInput
            value={input}
            onValueChange={setInput}
            onSubmit={submit}
            inputRef={ref}
          />
          {controls}
          {executionNotice}
          {sourceSelection}
          {advanced}
          {sourceError && (
            <p role="alert" className="notice">
              {sourceError}
            </p>
          )}
        </div>
        <div className="landing-bottom">
          <div className="landing-links">
            <Link href="/workspace">Open workspace →</Link>
            <Link href="/profiles">Explore profiles →</Link>
            <Link href="/settings">Search preferences →</Link>
          </div>
          <p className="text-xs text-muted-foreground">
            <kbd className="border px-1.5 py-1">/</kbd> to focus · Enter to
            search
          </p>
        </div>
      </main>
    );
  return (
    <main className="lumen-page search-page">
      <div className="search-top">
        <h1 className="sr-only">Search</h1>
        <SearchInput
          value={input}
          onValueChange={setInput}
          onSubmit={submit}
          inputRef={ref}
          loading={loading}
        />
        {controls}
        {executionNotice}
        {sourceError && (
          <p role="alert" className="notice mb-5">
            {sourceError}
          </p>
        )}
        {sourceSelection}
        {advanced}
      </div>
      <div className="results-column">
        {!q ? (
          <div className="empty-state">
            <h2 className="page-heading">What are you looking for?</h2>
            <p className="page-description">
              Enter a query above to search available sources.
            </p>
          </div>
        ) : (
          <ResultsList
            data={data}
            error={error}
            loading={loading}
            query={q}
            showImages={showImages}
            openInNewTab={openInNewTab}
          />
        )}{" "}
        {data && (
          <div className="mt-6 flex gap-3">
            {data.page > 1 && (
              <button
                className="lumen-button"
                onClick={() => update("page", String(data.page - 1))}
              >
                Previous page
              </button>
            )}
            {data.has_more && (
              <button
                className="lumen-button"
                onClick={() => update("page", String(data.page + 1))}
              >
                Next page
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
