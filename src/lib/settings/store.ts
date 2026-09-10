"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SafeSearchLevel, SearchCategory, TimeRange } from "@/types/search";
import {
  SETTINGS_DEFAULTS,
  SETTINGS_VERSION,
  migrateSettings,
  type LumenSettingsData,
} from "@/lib/settings/migrate";

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
export type LumenSettings = LumenSettingsData;

export interface LumenSettingsActions {
  setDefaultCategory: (category: SearchCategory) => void;
  setDefaultTimeRange: (range: TimeRange) => void;
  setDefaultLanguage: (language: string) => void;
  setSafeSearch: (level: SafeSearchLevel) => void;
  setOpenInNewTab: (v: boolean) => void;
  setShowFavicons: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS: LumenSettings = { ...SETTINGS_DEFAULTS };

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
      version: SETTINGS_VERSION,
      // Migrate older persisted versions (e.g. v1 which included a
      // `theme` field) into the current shape. Without this, Zustand
      // emits a console warning on hydration when the persisted
      // version differs from `version` above.
      migrate: migrateSettings,
      // Only persist the data fields — never persist the action
      // functions. Without partialize, Zustand persists the entire
      // store state including the setter functions, which is both
      // wasteful and fragile (functions don't survive JSON
      // round-trips cleanly).
      partialize: (state): LumenSettingsData => ({
        defaultCategory: state.defaultCategory,
        defaultTimeRange: state.defaultTimeRange,
        defaultLanguage: state.defaultLanguage,
        safeSearch: state.safeSearch,
        openInNewTab: state.openInNewTab,
        showFavicons: state.showFavicons,
      }),
      // Defensive merge: even when the persisted version matches the
      // current version, validate every field so a manually corrupted
      // localStorage entry can't crash hydration or inject invalid
      // enum values. Without this, Zustand does a shallow spread of
      // the persisted state, which would trust localStorage blindly.
      // The merge function receives the current (in-memory) state
      // which already has the action functions attached — we spread
      // the normalized data on top so the actions survive.
      merge: (persisted, currentState) => ({
        ...currentState,
        ...migrateSettings(persisted, SETTINGS_VERSION),
      }),
    },
  ),
);
