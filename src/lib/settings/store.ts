"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SafeSearchLevel, SearchCategory, TimeRange } from "@/types/search";

/**
 * Client-side settings.
 *
 * Stored in localStorage (via zustand persist). No database. No
 * accounts. Each device/browser has its own settings.
 *
 * NOTE: theme is NOT stored here. Theme is managed by next-themes,
 * which has its own localStorage key ("theme"). Keeping theme out of
 * this store avoids two sources of truth fighting each other.
 */
export interface LumenSettings {
  defaultCategory: SearchCategory;
  defaultTimeRange: TimeRange;
  defaultLanguage: string;
  safeSearch: SafeSearchLevel;
  /** Open result links in a new tab by default. */
  openInNewTab: boolean;
  /** Show favicons next to results. Disabled by default for privacy —
   *  enabling it loads favicons from a third-party service. */
  showFavicons: boolean;
}

export interface LumenSettingsActions {
  setDefaultCategory: (category: SearchCategory) => void;
  setDefaultTimeRange: (range: TimeRange) => void;
  setDefaultLanguage: (language: string) => void;
  setSafeSearch: (level: SafeSearchLevel) => void;
  setOpenInNewTab: (v: boolean) => void;
  setShowFavicons: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS: LumenSettings = {
  defaultCategory: "general",
  defaultTimeRange: "none",
  defaultLanguage: "auto",
  safeSearch: 1,
  openInNewTab: true,
  showFavicons: false,
};

export const useSettings = create<LumenSettings & LumenSettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULTS,
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
      version: 2,
    },
  ),
);
