"use client";

import * as React from "react";
import type { SearchCategory, TimeRange } from "@/types/search";
import { ALLOWED_LANGUAGES } from "@/lib/validation/search";

export interface FilterBarProps {
  category: SearchCategory;
  onCategoryChange: (c: SearchCategory) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (t: TimeRange) => void;
  language: string;
  onLanguageChange: (l: string) => void;
  /** When true, show the secondary controls (time, language) inline.
   *  On mobile they collapse into a single row that wraps. */
  compact?: boolean;
}

const CATEGORIES: { value: SearchCategory; label: string }[] = [
  { value: "general", label: "All" },
  { value: "news", label: "News" },
  { value: "images", label: "Images" },
  { value: "videos", label: "Videos" },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "none", label: "Any time" },
  { value: "day", label: "Past 24h" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
  { value: "year", label: "Past year" },
];

const LANGUAGE_LABELS: Record<string, string> = {
  auto: "Auto",
  en: "English",
  "en-US": "English (US)",
  hi: "Hindi",
  bn: "Bengali",
  te: "Telugu",
  ta: "Tamil",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  ur: "Urdu",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  zh: "Chinese",
  "zh-CN": "Chinese (Simplified)",
  ko: "Korean",
  ar: "Arabic",
};

/**
 * A horizontal filter bar.
 *
 * Categories are presented as a segmented control (no pills, no
 * cards). Time and language use native <select> elements because
 * they're the most accessible, keyboard-friendly, and visually quiet
 * choice for a small household tool.
 */
export function FilterBar({
  category,
  onCategoryChange,
  timeRange,
  onTimeRangeChange,
  language,
  onLanguageChange,
  compact = false,
}: FilterBarProps) {
  return (
    <div
      className={
        compact
          ? "flex flex-wrap items-center gap-x-4 gap-y-2"
          : "flex items-center gap-4"
      }
    >
      {/* Categories */}
      <div
        role="tablist"
        aria-label="Search category"
        className="flex items-center"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {CATEGORIES.map((c) => {
          const active = c.value === category;
          return (
            <button
              key={c.value}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => onCategoryChange(c.value)}
              className="relative px-3 py-2 text-sm transition-colors"
              style={{
                color: active ? "var(--foreground)" : "var(--muted-foreground)",
                fontWeight: active ? 500 : 400,
                // The active tab gets a 2px accent underline that sits on
                // top of the bottom border.
                borderBottom: active
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Right side: time + language */}
      <div className="ml-auto flex items-center gap-3">
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="sr-only sm:auto">Time</span>
          <select
            value={timeRange}
            onChange={(e) => onTimeRangeChange(e.target.value as TimeRange)}
            className="bg-transparent py-1 pr-1 text-xs text-foreground focus:outline-none"
            style={{ border: "1px solid var(--border)", borderRadius: "2px" }}
            aria-label="Time range"
          >
            {TIME_RANGES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="sr-only sm:auto">Language</span>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="bg-transparent py-1 pr-1 text-xs text-foreground focus:outline-none"
            style={{ border: "1px solid var(--border)", borderRadius: "2px" }}
            aria-label="Language"
          >
            {ALLOWED_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABELS[l] ?? l}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
