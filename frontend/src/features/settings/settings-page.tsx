"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useSources } from "@/features/search/search-context";
import {
  hydratePreferences,
  usePreferences,
} from "@/lib/search/preferences-store";
const sections = [
  "Appearance",
  "Search behavior",
  "Sources",
  "Privacy",
  "Shortcuts",
  "Advanced diagnostics",
  "About",
];
export function SettingsPage() {
  const [section, setSection] = useState("Appearance");
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { engines, loading, error } = useSources();
  const { showImages, openInNewTab, setShowImages, setOpenInNewTab } =
    usePreferences();
  useEffect(() => {
    hydratePreferences();
    setMounted(true);
  }, []);
  return (
    <main className="lumen-page">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Your workstation
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Settings</h1>
        <p className="mt-3 text-muted-foreground">
          Make search feel right. Preferences stay on this device.
        </p>
      </header>
      <div className="grid gap-8 md:grid-cols-[210px_1fr]">
        <nav
          aria-label="Settings sections"
          className="flex flex-wrap gap-2 md:flex-col md:items-stretch"
        >
          {sections.map((name) => (
            <button
              key={name}
              className="lumen-button text-left"
              aria-pressed={section === name}
              onClick={() => setSection(name)}
            >
              {name}
            </button>
          ))}
        </nav>
        <section className="lumen-panel p-6" aria-label={section}>
          <h2 className="mb-6 text-xl font-semibold">{section}</h2>
          <div className="space-y-5 text-sm">
            {section === "Appearance" && (
              <>
                <fieldset>
                  <legend className="mb-3 font-medium">Theme</legend>
                  <div className="flex flex-wrap gap-2">
                    {["light", "dark", "system"].map((value) => (
                      <button
                        key={value}
                        className="lumen-button"
                        aria-pressed={mounted && theme === value}
                        onClick={() => setTheme(value)}
                      >
                        {value[0].toUpperCase() + value.slice(1)}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={showImages}
                    onChange={(e) => setShowImages(e.target.checked)}
                  />
                  Show external thumbnails automatically
                </label>
                <p className="text-muted-foreground">
                  Off by default. Loading thumbnails contacts the image host.
                </p>
              </>
            )}
            {section === "Search behavior" && (
              <>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={openInNewTab}
                    onChange={(e) => setOpenInNewTab(e.target.checked)}
                  />
                  Open results in a new tab
                </label>
                <p className="text-muted-foreground">
                  Use profiles to remember sources, ranking and supported
                  filters.
                </p>
                <Link className="lumen-button inline-flex" href="/profiles">
                  Manage search profiles
                </Link>
                <p>
                  Balanced ranking combines relevance, publication dates and
                  source position. Choose Relevance or Recency in a profile to
                  change the emphasis.
                </p>
              </>
            )}
            {section === "Sources" && (
              <>
                <p className="text-muted-foreground">
                  Search uses available sources compatible with your category.
                  No third-party API credentials are required.
                </p>
                {loading && <p role="status">Loading sources…</p>}
                {error && <p role="alert">{error}</p>}
                <ul className="divide-y divide-border">
                  {engines.map((engine) => (
                    <li key={engine.id} className="py-4">
                      <div className="flex justify-between gap-4">
                        <strong>{engine.name}</strong>
                        <span className="text-muted-foreground">
                          {engine.enabled && engine.configured
                            ? "Available"
                            : "Unavailable"}
                        </span>
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-muted-foreground">
                          Source capabilities
                        </summary>
                        <div className="mt-3 space-y-2">
                          <p>Categories: {engine.categories.join(", ")}</p>
                          <p>
                            Supported filters:{" "}
                            {engine.filters.join(", ") || "None"}
                          </p>
                          <p>
                            Interface:{" "}
                            {engine.interface_type?.replaceAll("_", " ") ||
                              "public interface"}
                          </p>
                          <p>
                            Pagination:{" "}
                            {engine.pagination ? "Supported" : "Not supported"}{" "}
                            · Request limit: {engine.rate_limit_per_minute}
                            /minute
                          </p>
                          {engine.access_note && <p>{engine.access_note}</p>}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {section === "Privacy" && (
              <>
                <p>
                  Queries are sent through LUMEN to selected upstream providers.
                  Those providers receive your query. Shareable search URLs also
                  contain your query and filters.
                </p>
                <p>
                  Profiles, saved items, notes and optional history stay in this
                  browser. History is off by default.
                </p>
                <p>
                  A signed anonymous cookie lasts 30 days and helps enforce
                  request limits. It contains no queries. Direct development
                  connections may use connection-based limits instead.
                </p>
                <p>
                  No mandatory account, advertising or tracking scripts.
                  External thumbnails are opt-in.
                </p>
                <Link className="lumen-button inline-flex" href="/workspace">
                  Manage local research data
                </Link>
              </>
            )}
            {section === "Shortcuts" && (
              <>
                <dl className="grid grid-cols-[80px_1fr] gap-4">
                  <dt>
                    <kbd>/</kbd>
                  </dt>
                  <dd>
                    Focus search when you are not typing in another field.
                  </dd>
                  <dt>
                    <kbd>Enter</kbd>
                  </dt>
                  <dd>Submit the search form.</dd>
                  <dt>
                    <kbd>Escape</kbd>
                  </dt>
                  <dd>Close open filters or navigation.</dd>
                  <dt>
                    <kbd>Tab</kbd>
                  </dt>
                  <dd>Move between controls.</dd>
                </dl>
              </>
            )}
            {section === "Advanced diagnostics" && (
              <>
                <p>
                  Expand source status on a results page to inspect actual
                  response times, failures and applied filters.
                </p>
                <p className="text-muted-foreground">
                  Operational diagnostics are protected on the backend.
                  Configure access in your deployment; credentials are never
                  entered in this browser.
                </p>
                <Link className="lumen-button inline-flex" href="/search">
                  Open search
                </Link>
              </>
            )}
            {section === "About" && (
              <>
                <p className="text-lg font-medium">LUMEN V3</p>
                <p>
                  Independent keyless metasearch and a local-first research
                  workspace.
                </p>
                <p className="text-muted-foreground">
                  Public APIs and news feeds provide specialized coverage.
                  Experimental HTML sources may be disabled or blocked; source
                  failures are reported openly.
                </p>
                <p>
                  Returned counts, ranking explanations and comparison timings
                  describe actual responses.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
