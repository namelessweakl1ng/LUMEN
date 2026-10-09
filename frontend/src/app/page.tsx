"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LumenWordmark } from "@/components/layout/wordmark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PreferencesPanel } from "@/components/search/preferences-panel";
import { SearchInput } from "@/components/search/search-input";
import { useSearch } from "@/components/search/use-search";
import { ResultsList } from "@/components/results/results-list";
import { useKeyboardShortcut } from "@/components/layout/use-keyboard-shortcut";
import { parseUrl } from "@/lib/validation/url";
import { usePreferences } from "@/lib/search/preferences-store";
import { readPreferences } from "@/lib/search/preferences";
import { readApi } from "@/lib/search/client";
import {
  BUILTINS,
  validateProfiles,
  profileParams,
  type Profile,
} from "@/lib/search/profiles";
import type { Engine, Category, CompareResponse } from "@/types/search";
import { ResearchWorkspace } from "@/features/workspaces/research-workspace";
import { recordSearch } from "@/lib/research/store";
export default function HomePage() {
  return (
    <Suspense fallback={<p>Loading Lumen…</p>}>
      <Home />
    </Suspense>
  );
}
function Home() {
  const router = useRouter(),
    sp = useSearchParams();
  const params = new URLSearchParams(sp.toString());
  const q = params.get("q") || "";
  const [input, setInput] = useState(q),
    [engines, setEngines] = useState<Engine[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [configError, setConfigError] = useState(""),
    [workspace, setWorkspace] = useState(false),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [profileName, setProfileName] = useState(""),
    [selectedProfile, setSelectedProfile] = useState("balanced"),
    [loaded, setLoaded] = useState(false),
    [preferences, setPreferences] = useState(false);
  const { showImages, setShowImages, openInNewTab, setOpenInNewTab } =
    usePreferences();
  const inputRef = useRef<HTMLInputElement | null>(null);
  useKeyboardShortcut("/", () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  });
  useKeyboardShortcut(
    "Escape",
    () => {
      setPreferences(false);
      setWorkspace(false);
    },
    { allowInInputs: true },
  );
  useEffect(() => setInput(q), [q]);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      readApi<{ engines: Engine[] }>("/api/v1/engines", {
        signal: abort.signal,
      }),
      readApi<{ categories: Category[] }>("/api/v1/categories", {
        signal: abort.signal,
      }),
    ])
      .then(([e, c]) => {
        setEngines(e.engines);
        setCategories(c.categories);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setConfigError(
            "Could not load source capabilities. Start the search service and refresh.",
          );
      });
    try {
      setProfiles(
        validateProfiles(
          JSON.parse(localStorage.getItem("lumen-profiles") || "[]"),
        ),
      );
    } catch {
      setProfiles([]);
    }
    try {
      const stored = readPreferences(
        JSON.parse(localStorage.getItem("lumen-preferences") || "null"),
        JSON.parse(localStorage.getItem("lumen-settings") || "null"),
      );
      setShowImages(stored.showImages);
      setOpenInNewTab(stored.openInNewTab);
    } catch {}
    setLoaded(true);
    return () => abort.abort();
  }, [setShowImages, setOpenInNewTab]);
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem("lumen-profiles", JSON.stringify(profiles));
      } catch {
        setConfigError(
          "Browser storage is unavailable. Profiles cannot be saved on this device.",
        );
      }
    }
  }, [profiles, loaded]);
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(
          "lumen-preferences",
          JSON.stringify({ showImages, openInNewTab }),
        );
      } catch {
        setConfigError(
          "Browser storage is unavailable. Preferences cannot be saved on this device.",
        );
      }
    }
  }, [showImages, openInNewTab, loaded]);
  const update = (key: string, value: string) => {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    p.delete("page");
    router.replace(`/?${p}`, { scroll: false });
  };
  const { data, error, loading } = useSearch(params);
  const category = params.get("category") || "general";
  const selected = (params.get("engines") || "").split(",").filter(Boolean);
  const available = engines.filter(
    (e) =>
      e.configured &&
      e.enabled &&
      e.categories.includes(category as Engine["categories"][number]),
  );
  const currentProfile = (): Profile => ({
    ...BUILTINS[0],
    id: crypto.randomUUID(),
    name: profileName.trim().slice(0, 80) || "Custom",
    category: category as Profile["category"],
    engines: selected,
    ranking: (params.get("ranking") || "balanced") as Profile["ranking"],
    safe_search: Number(
      params.get("safe_search") || 1,
    ) as Profile["safe_search"],
    language: params.get("language") || "en",
    time_range: (params.get("time_range") || "none") as Profile["time_range"],
    site: params.get("site") || "",
    exclude_site: params.get("exclude_site") || "",
    file_type: params.get("file_type") || "",
    preferred_domains: params.get("preferred_domains") || "",
  });
  const allProfiles = [...BUILTINS, ...profiles];
  useEffect(() => {
    if (data) void recordSearch(data.query).catch(() => {});
  }, [data]);
  const submit = (value: string) => {
    update("q", value);
  };
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-4">
          <Link href="/" aria-label="Lumen home">
            <LumenWordmark size="sm" />
          </Link>
          <span className="text-xs text-muted-foreground">
            INDEPENDENT METASEARCH
          </span>
          <div className="ml-auto flex items-center gap-3">
            <button
              className="lumen-button"
              onClick={() => setWorkspace(!workspace)}
              aria-expanded={workspace}
            >
              Workspace
            </button>
            <button
              className="lumen-button"
              aria-expanded={preferences}
              onClick={() => setPreferences(!preferences)}
            >
              Settings
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        {preferences && (
          <PreferencesPanel
            engines={engines}
            showImages={showImages}
            onShowImages={setShowImages}
            openInNewTab={openInNewTab}
            onOpenInNewTab={setOpenInNewTab}
            onClose={() => setPreferences(false)}
            onDefaults={() => {
              setSelectedProfile("balanced");
              setShowImages(false);
              setOpenInNewTab(true);
              router.replace(
                `/?${profileParams(BUILTINS[0], new URLSearchParams(sp.toString()))}`,
                { scroll: false },
              );
            }}
          />
        )}
        {workspace && <ResearchWorkspace onClose={() => setWorkspace(false)} />}
        <div className={q ? "" : "mx-auto max-w-3xl pt-[8vh]"}>
          {!q && (
            <div className="mb-8">
              <h1 className="text-4xl font-medium tracking-tight">
                Find the signal.
              </h1>
              <p className="mt-3 text-muted-foreground">
                Search open knowledge, code and research. Keep what matters on
                your device.
              </p>
            </div>
          )}
          <SearchInput
            value={input}
            onValueChange={setInput}
            onSubmit={submit}
            inputRef={inputRef}
            loading={loading}
            label="Search sources"
            placeholder="Search sources"
          />
          <div
            className="mt-4 flex flex-wrap gap-2"
            role="group"
            aria-label="Search categories"
          >
            {categories.map((c) => (
              <button
                key={c.id}
                disabled={!c.available}
                title={c.reason}
                className="lumen-button"
                aria-pressed={category === c.id}
                onClick={() => {
                  const p = new URLSearchParams(sp.toString());
                  p.set("category", c.id);
                  p.delete("engines");
                  p.delete("page");
                  router.replace(`/?${p}`, { scroll: false });
                }}
              >
                {c.name || c.id}
                {!c.available ? " · unavailable" : ""}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <label className="text-xs">
              Profile
              <select
                className="lumen-control ml-2"
                aria-label="Search profile"
                value={selectedProfile}
                onChange={(e) => {
                  setSelectedProfile(e.target.value);
                  const profile = allProfiles.find(
                    (p) => p.id === e.target.value,
                  );
                  if (profile)
                    router.replace(
                      `/?${profileParams(profile, new URLSearchParams(sp.toString()))}`,
                      { scroll: false },
                    );
                }}
              >
                {allProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {configError && (
            <p role="alert" className="mt-4 text-sm">
              {configError}
            </p>
          )}
          <details className="mt-5 border-y py-4">
            <summary className="cursor-pointer text-sm font-medium">
              Search controls & profiles
            </summary>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <input
                className="lumen-control"
                aria-label="Profile name"
                placeholder="Profile name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
              <button
                className="lumen-button"
                disabled={!profileName.trim() || profiles.length >= 50}
                onClick={() => {
                  const p = currentProfile();
                  setProfiles([...profiles, p]);
                  setSelectedProfile(p.id);
                  setProfileName("");
                }}
              >
                Save profile
              </button>
              <button
                className="lumen-button"
                disabled={
                  !profiles.some((p) => p.id === selectedProfile) ||
                  !profileName.trim()
                }
                onClick={() => {
                  setProfiles(
                    profiles.map((p) =>
                      p.id === selectedProfile
                        ? { ...p, name: profileName.trim().slice(0, 80) }
                        : p,
                    ),
                  );
                  setProfileName("");
                }}
              >
                Rename profile
              </button>
              <button
                className="lumen-button"
                disabled={!profiles.some((p) => p.id === selectedProfile)}
                onClick={() => {
                  setProfiles(
                    profiles.map((p) =>
                      p.id === selectedProfile
                        ? { ...currentProfile(), id: p.id, name: p.name }
                        : p,
                    ),
                  );
                }}
              >
                Update profile from controls
              </button>
              <button
                className="lumen-button"
                disabled={!profiles.some((p) => p.id === selectedProfile)}
                onClick={() => {
                  setProfiles(profiles.filter((p) => p.id !== selectedProfile));
                  setSelectedProfile("balanced");
                }}
              >
                Delete profile
              </button>
            </div>
            <fieldset className="mt-5">
              <legend className="text-xs font-medium">
                Sources · empty selection uses all configured sources in this
                category
              </legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {engines
                  .filter((e) =>
                    e.categories.includes(
                      category as Engine["categories"][number],
                    ),
                  )
                  .map((e) => (
                    <label
                      key={e.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        disabled={!e.configured || !e.enabled}
                        checked={selected.includes(e.id)}
                        onChange={(ev) =>
                          update(
                            "engines",
                            (ev.target.checked
                              ? [...selected, e.id]
                              : selected.filter((id) => id !== e.id)
                            ).join(","),
                          )
                        }
                      />
                      {e.name}
                      {!e.configured ? " (not configured)" : ""}
                    </label>
                  ))}
              </div>
            </fieldset>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Select
                label="Time range"
                value={params.get("time_range") || "none"}
                options={["none", "day", "week", "month", "year"]}
                change={(v) => update("time_range", v)}
              />
              <Select
                label="Language"
                value={params.get("language") || "en"}
                options={["en", "hi", "fr", "de", "es", "ja", "zh"]}
                change={(v) => update("language", v)}
              />
              <Select
                label="Safe search"
                value={params.get("safe_search") || "1"}
                options={["0", "1", "2"]}
                change={(v) => update("safe_search", v)}
              />
              <Select
                label="Ranking"
                value={params.get("ranking") || "balanced"}
                options={["balanced", "relevance", "recency"]}
                change={(v) => update("ranking", v)}
              />
              {[
                ["site", "Include domains"],
                ["exclude_site", "Exclude domains"],
                ["file_type", "File type"],
                ["preferred_domains", "Preferred domains"],
              ].map(([key, label]) => (
                <label key={key} className="text-xs">
                  {label}
                  <input
                    className="lumen-control mt-1 w-full"
                    aria-label={label}
                    value={params.get(key) || ""}
                    placeholder={
                      key === "file_type" ? "pdf" : "example.org, example.com"
                    }
                    onChange={(e) => update(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Domain, file and time filters may be applied locally to returned
              results. Language and safe search depend on source support. Source
              capabilities:{" "}
              {available
                .map(
                  (e) =>
                    `${e.name} (${e.filters.join(", ") || "no upstream filters"})`,
                )
                .join("; ") || "none available"}
              . Exact filter behavior appears with each search.
            </p>
          </details>
        </div>
        {q && (
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <ResultsList
                data={data}
                loading={loading}
                error={error}
                query={q}
                showImages={showImages}
                openInNewTab={openInNewTab}
              />
              {data && (
                <nav
                  className="mt-5 flex items-center gap-3"
                  aria-label="Pagination"
                >
                  <button
                    className="lumen-button"
                    disabled={data.page <= 1}
                    onClick={() => {
                      const p = new URLSearchParams(sp.toString());
                      p.set("page", String(data.page - 1));
                      router.replace(`/?${p}`);
                    }}
                  >
                    Previous
                  </button>
                  <span className="text-xs">Page {data.page}</span>
                  <button
                    className="lumen-button"
                    disabled={!data.has_more}
                    onClick={() => {
                      const p = new URLSearchParams(sp.toString());
                      p.set("page", String(data.page + 1));
                      router.replace(`/?${p}`);
                    }}
                  >
                    Next
                  </button>
                </nav>
              )}
            </div>
            <Compare query={q} profiles={allProfiles} />
          </div>
        )}
      </main>
      <footer className="border-t px-5 py-5 text-center text-xs text-muted-foreground">
        Lumen · no accounts · no query logs · research stays on your device · /
        to focus search
      </footer>
    </div>
  );
}
function Select({
  label,
  value,
  options,
  labels,
  change,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  change: (v: string) => void;
}) {
  return (
    <label className="text-xs">
      {label}
      <select
        aria-label={label}
        className="lumen-control mt-1 w-full"
        value={value}
        onChange={(e) => change(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] || o}
          </option>
        ))}
      </select>
    </label>
  );
}
function Compare({ query, profiles }: { query: string; profiles: Profile[] }) {
  const [left, setLeft] = useState("balanced"),
    [right, setRight] = useState("research"),
    [data, setData] = useState<CompareResponse>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    abort.current?.abort();
    setData(undefined);
    setBusy(false);
    setError("");
    return () => abort.current?.abort();
  }, [query]);
  async function compare() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    setData(undefined);
    const toQuery = (id: string) => {
      const p = profiles.find((p) => p.id === id) || profiles[0];
      const { id: unusedId, name: unusedName, ...options } = p;
      void unusedId;
      void unusedName;
      return {
        ...options,
        site: options.site
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        exclude_site: options.exclude_site
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        preferred_domains: options.preferred_domains
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        file_type: options.file_type || null,
      };
    };
    try {
      const result = await readApi<CompareResponse>("/api/v1/search/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: query,
          left: toQuery(left),
          right: toQuery(right),
        }),
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setData(result);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Comparison failed");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const names = profiles.map((p) => p.id);
  const labels = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
  return (
    <aside className="self-start border p-4" aria-label="Search comparison">
      <h2 className="font-medium">Compare profiles</h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Compare actual returned sources, overlap and latency for this query.
      </p>
      <div className="mt-4 space-y-3">
        <Select
          label="Left profile"
          value={left}
          options={names}
          labels={labels}
          change={(v) => {
            abort.current?.abort();
            setBusy(false);
            setData(undefined);
            setLeft(v);
          }}
        />
        <Select
          label="Right profile"
          value={right}
          options={names}
          labels={labels}
          change={(v) => {
            abort.current?.abort();
            setBusy(false);
            setData(undefined);
            setRight(v);
          }}
        />
        <button
          className="lumen-button"
          disabled={busy}
          onClick={() => void compare()}
        >
          {busy ? "Comparing…" : "Compare"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
      )}
      {data && (
        <div className="mt-4 text-xs" data-testid="comparison-results">
          <p>
            Overlap: {(data.overlap * 100).toFixed(1)}% · {data.shared.length}{" "}
            shared URLs
          </p>
          <p className="mt-2">
            Shared sources:{" "}
            {data.left.engine_status
              .filter((s) =>
                data.right.engine_status.some((r) => r.engine === s.engine),
              )
              .map((s) => s.engine)
              .join(", ") || "none"}
          </p>
          <table className="mt-3 w-full text-left">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Left</th>
                <th>Right</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Returned</td>
                <td>{data.left.result_count}</td>
                <td>{data.right.result_count}</td>
              </tr>
              <tr>
                <td>Latency</td>
                <td>{Math.round(data.left.timing_ms)} ms</td>
                <td>{Math.round(data.right.timing_ms)} ms</td>
              </tr>
              <tr>
                <td>Unique</td>
                <td>{data.left_only.length}</td>
                <td>{data.right_only.length}</td>
              </tr>
              <tr>
                <td>Partial</td>
                <td>{String(data.left.partial)}</td>
                <td>{String(data.right.partial)}</td>
              </tr>
            </tbody>
          </table>
          {[
            ["Left", data.left],
            ["Right", data.right],
          ].map(([name, response]) => {
            const result = response as CompareResponse["left"];
            return (
              <details key={String(name)} className="mt-3">
                <summary>{String(name)} results and source status</summary>
                <p>
                  {result.engine_status
                    .map((s) => `${s.engine}: ${s.status}`)
                    .join(" · ")}
                </p>
                <ul>
                  {result.results.map((r) => (
                    <li key={r.id} className="mt-2">
                      <a
                        href={parseUrl(r.url)?.href || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        #{r.rank} {r.title}
                      </a>
                      <span className="ml-2">
                        {data.shared.includes(r.url)
                          ? "shared"
                          : `${String(name).toLowerCase()} only`}{" "}
                        · {r.source_engines.join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}
    </aside>
  );
}
