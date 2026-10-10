"use client";
import Link from "next/link";
import { supportsProfileFilter } from "@/lib/search/capabilities";
import { useState } from "react";
import { useProfiles, useSources } from "@/features/search/search-context";
import { profileParams, type Profile } from "@/lib/search/profiles";
import type { SearchCategory, TimeRange } from "@/types/search";
export function ProfilesPage() {
  const {
    builtins,
    customProfiles,
    saveProfile,
    deleteProfile,
    restoreDefaults,
    error,
  } = useProfiles();
  const { engines, categories, loading, error: sourceError } = useSources();
  const [draft, setDraft] = useState<Profile | null>(null),
    [notice, setNotice] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(false),
    [deleteId, setDeleteId] = useState("");
  const compatible = engines.filter(
    (e) =>
      e.enabled &&
      e.configured &&
      e.categories.includes(draft?.category || "general"),
  );
  const active = compatible.filter(
    (e) => !draft?.engines.length || draft.engines.includes(e.id),
  );
  const supports = (filter: string) => supportsProfileFilter(active, filter);
  const edit = (profile: Profile, copy = false) => {
    setDraft({
      ...profile,
      id: copy ? crypto.randomUUID() : profile.id,
      name: copy ? `${profile.name} copy` : profile.name,
      engines: [...profile.engines],
    });
    setNotice("");
  };
  const change = (patch: Partial<Profile>) =>
    setDraft((current) => (current ? { ...current, ...patch } : null));
  return (
    <main className="lumen-page">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Reusable search choices
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Search profiles</h1>
          <p className="mt-3 text-muted-foreground">
            Pick a starting point or build your own.
          </p>
        </div>
        <button
          className="lumen-button"
          onClick={() => {
            setDraft({
              ...builtins[0],
              id: crypto.randomUUID(),
              name: "",
              engines: [],
            });
            setNotice("");
          }}
        >
          Create profile
        </button>
      </header>
      {error && (
        <p role="alert" className="mb-4">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4">
          {notice}
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section aria-label="Available profiles">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest">
            Built-in profiles
          </h2>
          <div className="space-y-3">
            {builtins.map((p) => (
              <article key={p.id} className="lumen-panel p-5">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {p.category} · {p.ranking} ·{" "}
                  {p.engines
                    .map((id) => engines.find((e) => e.id === id)?.name || id)
                    .join(", ") || "All compatible sources"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="lumen-button"
                    href={`/search?${profileParams(p, new URLSearchParams()).toString()}`}
                  >
                    Use {p.name}
                  </Link>
                  <button
                    className="lumen-button"
                    onClick={() => edit(p, true)}
                  >
                    Customize {p.name}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <h2 className="mb-4 mt-8 text-sm font-semibold uppercase tracking-widest">
            Your profiles
          </h2>
          {!customProfiles.length && (
            <p className="lumen-panel p-5 text-sm text-muted-foreground">
              No custom profiles yet. Create one or customize a built-in
              profile.
            </p>
          )}
          <div className="space-y-3">
            {customProfiles.map((p) => (
              <article key={p.id} className="lumen-panel p-5">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {p.category} · {p.ranking}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="lumen-button"
                    href={`/search?${profileParams(p, new URLSearchParams()).toString()}`}
                  >
                    Use {p.name}
                  </Link>
                  <button className="lumen-button" onClick={() => edit(p)}>
                    Edit {p.name}
                  </button>
                  <button
                    className="lumen-button"
                    onClick={() => setDeleteId(p.id)}
                  >
                    Delete {p.name}
                  </button>
                </div>
                {deleteId === p.id && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <p className="text-sm">Delete this profile?</p>
                    <button
                      className="lumen-button"
                      onClick={() => {
                        deleteProfile(p.id);
                        setDeleteId("");
                        if (draft?.id === p.id) setDraft(null);
                      }}
                    >
                      Confirm delete
                    </button>
                    <button
                      className="lumen-button"
                      onClick={() => setDeleteId("")}
                    >
                      Cancel deletion
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
          <div className="mt-6">
            <button
              className="lumen-button"
              onClick={() => setConfirmRestore(true)}
            >
              Restore defaults
            </button>
            {confirmRestore && (
              <div className="mt-4 space-y-3">
                <p className="text-sm">
                  This removes your custom profiles. Saved research and
                  preferences are kept.
                </p>
                <button
                  className="lumen-button"
                  onClick={() => {
                    restoreDefaults();
                    setDraft(null);
                    setConfirmRestore(false);
                  }}
                >
                  Confirm restore defaults
                </button>
                <button
                  className="lumen-button ml-2"
                  onClick={() => setConfirmRestore(false)}
                >
                  Cancel restore
                </button>
              </div>
            )}
          </div>
        </section>
        <section
          className="lumen-panel self-start p-6"
          aria-label="Profile editor"
        >
          {!draft ? (
            <>
              <h2 className="text-xl font-semibold">
                A search setup that fits
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Create a profile to keep sources, ranking and filters together.
                Profiles stay in this browser.
              </p>
            </>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.name.trim()) return;
                saveProfile({ ...draft, name: draft.name.trim() });
                setNotice("Profile saved.");
                setDraft(null);
              }}
            >
              <h2 className="text-xl font-semibold">
                {customProfiles.some((p) => p.id === draft.id)
                  ? "Edit profile"
                  : "Create profile"}
              </h2>
              <label className="block space-y-2">
                <span>Profile name</span>
                <input
                  required
                  maxLength={80}
                  className="lumen-control w-full"
                  value={draft.name}
                  onChange={(e) => change({ name: e.target.value })}
                />
              </label>
              <label className="block space-y-2">
                <span>Category</span>
                <select
                  className="lumen-control w-full"
                  value={draft.category}
                  onChange={(e) =>
                    change({
                      category: e.target.value as SearchCategory,
                      engines: [],
                      time_range: "none",
                      language: "en",
                      site: "",
                      exclude_site: "",
                      file_type: "",
                    })
                  }
                >
                  {categories
                    .filter((c) => c.available || c.id === draft.category)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.id}
                      </option>
                    ))}
                  {!categories.some((c) => c.id === draft.category) && (
                    <option value={draft.category}>{draft.category}</option>
                  )}
                </select>
              </label>
              <fieldset>
                <legend className="mb-2">Sources</legend>
                <p className="mb-3 text-xs text-muted-foreground">
                  Leave all unchecked to use every available source in this
                  category.
                </p>
                {loading && <p role="status">Loading sources…</p>}
                {sourceError && <p role="alert">{sourceError}</p>}
                {compatible.map((e) => (
                  <label key={e.id} className="my-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={draft.engines.includes(e.id)}
                      onChange={(event) =>
                        change({
                          engines: event.target.checked
                            ? [...draft.engines, e.id]
                            : draft.engines.filter((id) => id !== e.id),
                        })
                      }
                    />
                    {e.name}
                  </label>
                ))}
                {draft.engines
                  .filter((id) => !compatible.some((e) => e.id === id))
                  .map((id) => (
                    <div key={id} className="my-2 text-sm">
                      {engines.find((e) => e.id === id)?.name || id} —
                      unavailable{" "}
                      <button
                        type="button"
                        className="lumen-button ml-2"
                        onClick={() =>
                          change({
                            engines: draft.engines.filter((e) => e !== id),
                          })
                        }
                      >
                        Remove {id}
                      </button>
                    </div>
                  ))}
              </fieldset>
              <label className="block space-y-2">
                <span>Ranking</span>
                <select
                  className="lumen-control w-full"
                  value={draft.ranking}
                  onChange={(e) =>
                    change({ ranking: e.target.value as Profile["ranking"] })
                  }
                >
                  <option value="balanced">Balanced</option>
                  <option value="relevance">Relevance</option>
                  <option value="recency">Recency</option>
                </select>
              </label>
              <details>
                <summary className="cursor-pointer">Default filters</summary>
                <div className="mt-4 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Domain filters and preferred domains are applied locally.
                    Date ranges use source filters where available; the local
                    fallback excludes undated results.
                  </p>
                  <label className="block space-y-2">
                    <span>
                      Date range
                      {!supports("time_range") &&
                        " — unavailable for selected sources"}
                    </span>
                    <select
                      aria-label="Date range"
                      className="lumen-control w-full"
                      disabled={!supports("time_range")}
                      value={draft.time_range}
                      onChange={(e) =>
                        change({ time_range: e.target.value as TimeRange })
                      }
                    >
                      {["none", "day", "week", "month", "year"].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(
                    [
                      ["language", "Language"],
                      ["site", "Include domain"],
                      ["exclude_site", "Exclude domain"],
                      ["file_type", "File type"],
                      ["preferred_domains", "Preferred domains"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block space-y-2">
                      <span>
                        {label}
                        {key !== "preferred_domains" &&
                          !supports(key) &&
                          " — unavailable for selected sources"}
                      </span>
                      <input
                        className="lumen-control w-full"
                        disabled={key !== "preferred_domains" && !supports(key)}
                        value={draft[key]}
                        onChange={(e) => change({ [key]: e.target.value })}
                      />
                    </label>
                  ))}
                  <label className="block space-y-2">
                    <span>
                      Safe search
                      {!supports("safe_search") &&
                        " — unavailable for selected sources"}
                    </span>
                    <select
                      className="lumen-control w-full"
                      disabled={!supports("safe_search")}
                      value={draft.safe_search}
                      onChange={(e) =>
                        change({
                          safe_search: Number(e.target.value) as 0 | 1 | 2,
                        })
                      }
                    >
                      <option value={0}>Off</option>
                      <option value={1}>Moderate</option>
                      <option value={2}>Strict</option>
                    </select>
                  </label>
                </div>
              </details>
              <div className="flex gap-3">
                <button
                  className="lumen-button"
                  type="submit"
                  disabled={!draft.name.trim() || loading}
                >
                  Save profile
                </button>
                <button
                  className="lumen-button"
                  type="button"
                  onClick={() => setDraft(null)}
                >
                  Cancel edit
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
