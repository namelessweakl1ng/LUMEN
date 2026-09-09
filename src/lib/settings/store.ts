"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SafeSearchLevel, SearchCategory, TimeRange } from "@/types/search";

/**
 * Client-side settings.
 *
 * Stored in localStorage (via zustand persist). No database. No
 * accounts. Each device/browser has its own settings.
 */
export interface LumenSettings {
  theme: "system" | "light" | "dark";
  defaultCategory: SearchCategory;
  defaultTimeRange: TimeRange;
  defaultLanguage: string;
  safeSearch: SafeSearchLevel;
  /** Open result links in a new tab by default. */
  openInNewTab: boolean;
  /** Show favicons next to results. */
  showFavicons: boolean;
}

export interface LumenSettingsActions {
  setTheme: (theme: LumenSettings["theme"]) => void;
  setDefaultCategory: (category: SearchCategory) => void;
  setDefaultTimeRange: (range: TimeRange) => void;
  setDefaultLanguage: (language: string) => void;
  setSafeSearch: (level: SafeSearchLevel) => void;
  setOpenInNewTab: (v: boolean) => void;
  setShowFavicons: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS: LumenSettings = {
  theme: "system",
  defaultCategory: "general",
  defaultTimeRange: "none",
  defaultLanguage: "auto",
  safeSearch: 1,
  openInNewTab: true,
  showFavicons: true,
};

export const useSettings = create<LumenSettings & LumenSettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTheme: (theme) => set({ theme }),
      setDefaultCategory: (defaultCategory) => set({ defaultCategory }),
      setDefaultTimeRange: (defaultTimeRange) => set({ defaultTimeRange }),
      setDefaultLanguage: (defaultLanguage) => set({ defaultLanguage }),
      setSafeSearch: (safeSearch) => set({ safeSearch }),
      setOpenInNewTab: (openInNewTab) => set({ openInNewTab }),
      setShowFavicons: (showFavicons) => set({ showFavicons }),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: "lumen-settings",
      version: 1,
    },
  ),
);
