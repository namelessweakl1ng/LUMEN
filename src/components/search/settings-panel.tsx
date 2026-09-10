"use client";

import * as React from "react";
import { Settings, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useSettings } from "@/lib/settings/store";
import { ALLOWED_LANGUAGES } from "@/lib/validation/search";
import type { SafeSearchLevel, SearchCategory, TimeRange } from "@/types/search";

const LANGUAGE_LABELS: Record<string, string> = {
  auto: "Automatic",
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
 * A small, modal-style settings panel.
 *
 * Settings persist to localStorage (see lib/settings/store). No
 * accounts, no server round-trip. Theme is managed by next-themes
 * directly — we read/write it via useTheme() so the settings panel
 * and the header toggle stay in sync.
 */
export function SettingsButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open settings"
        title="Settings"
        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
        style={{ borderRadius: "2px" }}
      >
        <Settings className="h-4 w-4" strokeWidth={1.5} />
      </button>
      {open && <SettingsPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const { theme, setTheme } = useTheme();
  const titleId = "lumen-settings-title";

  // Close on Escape.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="relative w-full max-w-md p-5"
        style={{
          background: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "3px",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-base font-medium">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
            style={{ borderRadius: "2px" }}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Theme">
            <SegmentedControl
              value={theme ?? "system"}
              onChange={(v) => setTheme(v)}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </Field>

          <Field label="Default category">
            <SelectNative
              value={s.defaultCategory}
              onChange={(v) => s.setDefaultCategory(v as SearchCategory)}
              options={[
                { value: "general", label: "All" },
                { value: "news", label: "News" },
                { value: "images", label: "Images" },
                { value: "videos", label: "Videos" },
              ]}
            />
          </Field>

          <Field label="Default time range">
            <SelectNative
              value={s.defaultTimeRange}
              onChange={(v) => s.setDefaultTimeRange(v as TimeRange)}
              options={[
                { value: "none", label: "Any time" },
                { value: "day", label: "Past 24h" },
                { value: "week", label: "Past week" },
                { value: "month", label: "Past month" },
                { value: "year", label: "Past year" },
              ]}
            />
          </Field>

          <Field label="Default language">
            <SelectNative
              value={s.defaultLanguage}
              onChange={(v) => s.setDefaultLanguage(v)}
              options={ALLOWED_LANGUAGES.map((l) => ({
                value: l,
                label: LANGUAGE_LABELS[l] ?? l,
              }))}
            />
          </Field>

          <Field label="Safe search">
            <SegmentedControl
              value={String(s.safeSearch)}
              onChange={(v) => s.setSafeSearch(Number(v) as SafeSearchLevel)}
              options={[
                { value: "0", label: "Off" },
                { value: "1", label: "Moderate" },
                { value: "2", label: "Strict" },
              ]}
            />
          </Field>

          <div className="space-y-2 pt-2">
            <Toggle
              label="Open results in new tab"
              checked={s.openInNewTab}
              onChange={s.setOpenInNewTab}
            />
            <Toggle
              label="Show favicons (loads from Google)"
              checked={s.showFavicons}
              onChange={s.setShowFavicons}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            style={{
              border: "1px solid var(--border)",
              borderRadius: "2px",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex"
      style={{ border: "1px solid var(--border)", borderRadius: "2px" }}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={() => onChange(o.value)}
            className="px-3 py-1 text-xs"
            style={{
              color: active ? "var(--accent-foreground)" : "var(--foreground)",
              background: active ? "var(--accent)" : "transparent",
              borderLeft: i === 0 ? "none" : "1px solid var(--border)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectNative<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-transparent px-2 py-1 text-sm text-foreground focus:outline-none"
      style={{ border: "1px solid var(--border)", borderRadius: "2px" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between text-sm text-foreground">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-5 w-9 items-center"
        style={{
          border: "1px solid var(--border)",
          borderRadius: "9999px",
          background: checked ? "var(--accent)" : "transparent",
          transition: "background 120ms ease",
        }}
        aria-label={label}
      >
        <span
          className="inline-block h-3.5 w-3.5 bg-background"
          style={{
            borderRadius: "50%",
            transform: checked ? "translateX(18px)" : "translateX(2px)",
            transition: "transform 120ms ease",
          }}
        />
      </button>
    </label>
  );
}
