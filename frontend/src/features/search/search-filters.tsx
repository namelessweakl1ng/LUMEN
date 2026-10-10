"use client";
import type { Engine } from "@/types/search";
type Update = (key: string, value: string) => void;
export function SourceSelection({
  available,
  selected,
  sourceLoading,
  update,
}: {
  available: Engine[];
  selected: string[];
  sourceLoading: boolean;
  update: Update;
}) {
  return (
    <section
      id="source-selection"
      className="lumen-panel filter-panel"
      aria-label="Search sources"
    >
      <fieldset>
        <legend className="eyebrow mt-5">Search sources</legend>
        {sourceLoading ? (
          <p className="mt-3 text-sm" role="status">
            Loading sources…
          </p>
        ) : (
          <div className="source-options">
            {available.map((e) => (
              <label key={e.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(e.id)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selected, e.id]
                      : selected.filter((id) => id !== e.id);
                    update("engines", next.join(","));
                  }}
                />
                {e.name}
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          No selection uses all available sources in this category. Queries are
          sent to the selected providers.
        </p>
      </fieldset>
    </section>
  );
}
export function AdvancedFilters({
  sp,
  supported,
  supportsDate,
  q,
  navigate,
  update,
}: {
  sp: URLSearchParams;
  supported: (field: string) => boolean;
  supportsDate: boolean;
  q: string;
  navigate: (params: URLSearchParams) => void;
  update: Update;
}) {
  return (
    <section
      id="search-filters"
      aria-label="Advanced filters"
      className="lumen-panel filter-panel"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-medium">Refine your search</h2>
        <button
          className="lumen-button"
          onClick={() => {
            const p = new URLSearchParams();
            if (q) p.set("q", q);
            navigate(p);
          }}
        >
          Reset filters
        </button>
      </div>
      <div className="filter-grid">
        <label>
          Ranking
          <select
            className="lumen-control"
            aria-label="Ranking"
            value={sp.get("ranking") || "balanced"}
            onChange={(e) => update("ranking", e.target.value)}
          >
            <option value="balanced">Balanced</option>
            <option value="relevance">Relevance</option>
            <option value="recency">Recency</option>
          </select>
        </label>
        <label>
          Date range
          <select
            className="lumen-control"
            aria-label="Date range"
            disabled={!supportsDate}
            value={sp.get("time_range") || "none"}
            onChange={(e) => update("time_range", e.target.value)}
          >
            {["none", "day", "week", "month", "year"].map((v) => (
              <option value={v} key={v}>
                {v === "none" ? "Any time" : `Past ${v}`}
              </option>
            ))}
          </select>
          {!supportsDate ? (
            <small>Unavailable for the current sources</small>
          ) : (
            <small>
              Local fallback excludes undated results for sources without a date
              filter.
            </small>
          )}
        </label>
        <label>
          Language
          <select
            className="lumen-control"
            aria-label="Language"
            disabled={!supported("language")}
            value={sp.get("language") || "en"}
            onChange={(e) => update("language", e.target.value)}
          >
            <option value="en">English</option>
            <option value="de">German</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
          </select>
          {!supported("language") && (
            <small>Unavailable for the current sources</small>
          )}
        </label>
        {[
          {
            key: "site",
            name: "Include domain",
            placeholder: "example.org",
            enabled: true,
          },
          {
            key: "exclude_site",
            name: "Exclude domain",
            placeholder: "example.org",
            enabled: true,
          },
          {
            key: "file_type",
            name: "File type",
            placeholder: "pdf",
            enabled: supported("file_type"),
          },
          {
            key: "preferred_domains",
            name: "Preferred domains",
            placeholder: "example.org, wikipedia.org",
            enabled: true,
          },
        ].map((f) => (
          <label key={f.key}>
            {f.name}
            <input
              aria-label={f.name}
              className="lumen-control"
              disabled={!f.enabled}
              key={`${f.key}:${sp.get(f.key) || ""}`}
              defaultValue={sp.get(f.key) || ""}
              placeholder={f.placeholder}
              onBlur={(e) => {
                if (e.target.value !== (sp.get(f.key) || ""))
                  update(f.key, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />
            {!f.enabled && <small>Unavailable for the current sources</small>}
          </label>
        ))}
        <label>
          Safe search
          <select
            className="lumen-control"
            aria-label="Safe search"
            disabled={!supported("safe_search")}
            value={sp.get("safe_search") || "1"}
            onChange={(e) => update("safe_search", e.target.value)}
          >
            <option value="0">Off</option>
            <option value="1">Moderate</option>
            <option value="2">Strict</option>
          </select>
          {!supported("safe_search") && (
            <small>Unavailable for the current sources</small>
          )}
        </label>
      </div>
    </section>
  );
}
