"use client";
import { useState } from "react";
import { useTheme } from "next-themes";
import type { Engine } from "@/types/search";
export function PreferencesPanel({
  engines,
  showImages,
  onShowImages,
  openInNewTab,
  onOpenInNewTab,
  onClose,
  onDefaults,
}: {
  engines: Engine[];
  showImages: boolean;
  onShowImages: (v: boolean) => void;
  openInNewTab: boolean;
  onOpenInNewTab: (v: boolean) => void;
  onClose: () => void;
  onDefaults: () => void;
}) {
  const [section, setSection] = useState("Search");
  const { theme, setTheme } = useTheme();
  return (
    <section className="mb-6 border p-5" aria-label="Settings">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Settings</h2>
        <button className="lumen-button" onClick={onClose}>
          Close settings
        </button>
      </div>
      <nav className="my-4 flex flex-wrap gap-2" aria-label="Settings sections">
        {[
          "Search",
          "Engines",
          "Ranking",
          "Appearance",
          "Privacy",
          "Shortcuts",
          "About",
        ].map((name) => (
          <button
            className="lumen-button"
            key={name}
            aria-pressed={section === name}
            onClick={() => setSection(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      <div className="space-y-3 text-sm">
        {section === "Search" && (
          <>
            <p>
              Categories, language, time, safe search and domain filters are
              controlled below. Save a named profile to remember all controls on
              this device.
            </p>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={openInNewTab}
                onChange={(e) => onOpenInNewTab(e.target.checked)}
              />
              Open results in a new tab
            </label>
            <button className="lumen-button" onClick={onDefaults}>
              Restore built-in defaults
            </button>
          </>
        )}
        {section === "Engines" && (
          <>
            <p>
              Choose sources under search controls. Empty selection runs all
              available sources in the category.
            </p>
            <ul className="space-y-2">
              {engines.map((e) => (
                <li key={e.id}>
                  <strong>{e.name}</strong> ·{" "}
                  {e.configured && e.enabled ? "Available" : "Unavailable"} ·{" "}
                  {e.rate_limit_per_minute}/min · supports{" "}
                  {e.filters.join(", ") || "no upstream filters"}
                  {e.requires_auth
                    ? " · requires backend credentials"
                    : " · no required key"}
                </li>
              ))}
            </ul>
          </>
        )}
        {section === "Ranking" && (
          <>
            <p>
              Balanced combines relevance, recency, source position and
              preferred domains. Relevance emphasizes query matches; Recency
              emphasizes publication dates. Agreement between sources adds a
              bounded bonus.
            </p>
            <p>
              Use the Ranking selector and Preferred domains below. Each result
              explains actual factors under “Why this result?”.
            </p>
          </>
        )}
        {section === "Appearance" && (
          <>
            <label className="flex items-center gap-3">
              Theme
              <select
                aria-label="Theme"
                className="lumen-control"
                value={theme || "system"}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option>system</option>
                <option>light</option>
                <option>dark</option>
              </select>
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={showImages}
                onChange={(e) => onShowImages(e.target.checked)}
              />
              Show external thumbnails automatically
            </label>
            <p className="text-xs text-muted-foreground">
              Default off. Thumbnails contact image hosts. Load individual
              images without enabling this preference.
            </p>
          </>
        )}
        {section === "Privacy" && (
          <>
            <p>
              Queries go to selected source APIs through your backend. Lumen
              does not log query text. Shareable URLs contain your query and
              filters.
            </p>
            <p>
              Profiles and workspace data stay in this browser. History is off
              by default; enable or clear it in Workspace. Exports contain saved
              notes and URLs.
            </p>
            <p>
              No external fonts, analytics or favicon services. Thumbnails are
              opt-in with no-referrer requests.
            </p>
          </>
        )}
        {section === "Shortcuts" && (
          <ul className="space-y-2">
            <li>
              <kbd>/</kbd> — Focus and select search
            </li>
            <li>
              <kbd>Enter</kbd> — Search
            </li>
            <li>
              <kbd>Escape</kbd> — Close panels or clear search input
            </li>
            <li>
              <kbd>Tab</kbd> — Navigate controls with visible focus
            </li>
          </ul>
        )}
        {section === "About" && (
          <>
            <p>
              Lumen V2 · independent metasearch and local research workspace.
            </p>
            <p>
              Wikipedia, GitHub, Crossref, Hacker News and Wikimedia Commons.
              Optional web search requires backend Brave credentials.
              Unsupported categories stay disabled.
            </p>
            <p>
              Counts show returned results. Ranking factors and comparison
              timings reflect actual responses.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
