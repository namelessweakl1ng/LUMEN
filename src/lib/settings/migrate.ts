import type { SafeSearchLevel, SearchCategory, TimeRange } from "@/types/search";
import {
  ALLOWED_LANGUAGES,
  coerceCategory,
  coerceLanguage,
  coerceSafeSearch,
  coerceTimeRange,
} from "@/lib/validation/search";

/**
 * Persisted-state migration for the Lumen settings store.
 *
 * Kept in a separate module from the Zustand store so it can be unit
 * tested directly without bootstrapping the full store (which would
 * touch localStorage during import).
 *
 * History:
 *   - version 1 (initial): included a `theme` field ("system"|"light"|"dark")
 *     and `showFavicons` defaulted to true. Theme has since moved to
 *     next-themes; the Zustand store no longer owns it.
 *   - version 2 (current): `theme` removed, `showFavicons` default
 *     changed to false. Same six settings fields otherwise.
 *
 * The migrate function is called by Zustand persist whenever the
 * persisted version differs from the configured `version`. It must:
 *   1. Accept unknown input (localStorage is untrusted).
 *   2. Validate each field individually.
 *   3. Preserve valid values, replace invalid/missing values with
 *      defaults.
 *   4. Silently drop obsolete fields (e.g. `theme` from v1).
 *   5. Never throw — a thrown migrate crashes hydration.
 */

export const SETTINGS_VERSION = 2;

export interface LumenSettingsData {
  defaultCategory: SearchCategory;
  defaultTimeRange: TimeRange;
  defaultLanguage: string;
  safeSearch: SafeSearchLevel;
  openInNewTab: boolean;
  showFavicons: boolean;
}

export const SETTINGS_DEFAULTS: LumenSettingsData = {
  defaultCategory: "general",
  defaultTimeRange: "none",
  defaultLanguage: "auto",
  safeSearch: 1,
  openInNewTab: true,
  showFavicons: false,
};

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

/**
 * Validate and normalize a persisted settings object into the current
 * `LumenSettingsData` shape. Used both by the Zustand `migrate`
 * function and by the `merge` function so the same defensive logic
 * applies to both version-mismatched and same-version persisted
 * states.
 *
 * Never throws. Always returns a complete, valid object.
 */
export function normalizePersistedSettings(raw: unknown): LumenSettingsData {
  // If the persisted blob isn't an object, fall back to full defaults.
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ...SETTINGS_DEFAULTS };
  }
  const obj = raw as Record<string, unknown>;

  // Each field uses its coerce function which validates the value and
  // falls back to the default if invalid. Unknown fields are simply
  // ignored (not copied). The obsolete `theme` field from v1 is
  // dropped naturally because we never read it.
  return {
    defaultCategory: coerceCategory(
      obj.defaultCategory,
      SETTINGS_DEFAULTS.defaultCategory,
    ),
    defaultTimeRange: coerceTimeRange(
      obj.defaultTimeRange,
      SETTINGS_DEFAULTS.defaultTimeRange,
    ),
    defaultLanguage: coerceLanguage(
      obj.defaultLanguage,
      SETTINGS_DEFAULTS.defaultLanguage,
    ),
    safeSearch: coerceSafeSearch(
      obj.safeSearch,
      SETTINGS_DEFAULTS.safeSearch,
    ),
    openInNewTab: isBoolean(obj.openInNewTab)
      ? obj.openInNewTab
      : SETTINGS_DEFAULTS.openInNewTab,
    showFavicons: isBoolean(obj.showFavicons)
      ? obj.showFavicons
      : SETTINGS_DEFAULTS.showFavicons,
  };
}

/**
 * Zustand persist `migrate` function.
 *
 * Zustand calls this with the persisted state and the persisted
 * version number when the versions don't match. We ignore the version
 * number — `normalizePersistedSettings` is defensive enough to handle
 * any historical version safely, and there is only one real
 * historical version (1 → 2). Future version bumps that require
 * destructive migration can branch on `version` here.
 */
export function migrateSettings(
  persistedState: unknown,
  _version: number,
): LumenSettingsData {
  return normalizePersistedSettings(persistedState);
}

// Re-export for tests that want to inspect the allowed lists.
export { ALLOWED_LANGUAGES };
