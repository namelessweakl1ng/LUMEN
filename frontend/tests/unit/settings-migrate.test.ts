import { describe, it, expect } from "vitest";
import {
  migrateSettings,
  normalizePersistedSettings,
  SETTINGS_DEFAULTS,
  SETTINGS_VERSION,
} from "@/lib/settings/migrate";
import type { LumenSettingsData } from "@/lib/settings/migrate";

describe("settings migration — normalizePersistedSettings", () => {
  it("returns a complete current state when persisted state is missing fields", () => {
    // Simulates a v1-era state that only stored one field.
    const out = normalizePersistedSettings({ defaultCategory: "news" });
    expect(out).toEqual({
      ...SETTINGS_DEFAULTS,
      defaultCategory: "news",
    });
    // Every field must be present.
    expect(Object.keys(out).sort()).toEqual(
      [
        "defaultCategory",
        "defaultTimeRange",
        "defaultLanguage",
        "safeSearch",
        "openInNewTab",
        "showFavicons",
      ].sort(),
    );
  });

  it("preserves valid values from an older persisted state", () => {
    const old = {
      defaultCategory: "news",
      defaultTimeRange: "week",
      defaultLanguage: "hi",
      safeSearch: 2,
      openInNewTab: false,
      showFavicons: true,
    };
    const out = normalizePersistedSettings(old);
    expect(out).toEqual(old);
  });

  it("falls back to defaults when persisted state is malformed", () => {
    expect(normalizePersistedSettings(null)).toEqual(SETTINGS_DEFAULTS);
    expect(normalizePersistedSettings(undefined)).toEqual(SETTINGS_DEFAULTS);
    expect(normalizePersistedSettings("not an object")).toEqual(
      SETTINGS_DEFAULTS,
    );
    expect(normalizePersistedSettings(42)).toEqual(SETTINGS_DEFAULTS);
    expect(normalizePersistedSettings([1, 2, 3])).toEqual(SETTINGS_DEFAULTS);
    expect(normalizePersistedSettings(true)).toEqual(SETTINGS_DEFAULTS);
  });

  it("replaces invalid enum values with defaults", () => {
    const out = normalizePersistedSettings({
      defaultCategory: "music", // invalid
      defaultTimeRange: "hour", // invalid
      defaultLanguage: "klingon", // invalid
      safeSearch: 5, // invalid
      openInNewTab: "yes", // wrong type
      showFavicons: 1, // wrong type
    });
    expect(out).toEqual(SETTINGS_DEFAULTS);
  });

  it("does not break hydration when unknown fields are present", () => {
    const out = normalizePersistedSettings({
      defaultCategory: "images",
      someUnknownField: "should be ignored",
      // `theme` is the most relevant unknown field — it existed in v1
      // and was intentionally removed in v2.
      theme: "dark",
      nested: { stuff: [1, 2, 3] },
    });
    expect(out).toEqual({
      ...SETTINGS_DEFAULTS,
      defaultCategory: "images",
    });
    // The unknown fields must not leak through.
    expect((out as unknown as Record<string, unknown>).theme).toBeUndefined();
    expect(
      (out as unknown as Record<string, unknown>).someUnknownField,
    ).toBeUndefined();
  });

  it("passes a current-version valid state through unchanged", () => {
    const current: LumenSettingsData = {
      defaultCategory: "videos",
      defaultTimeRange: "month",
      defaultLanguage: "ja",
      safeSearch: 0,
      openInNewTab: false,
      showFavicons: true,
    };
    expect(normalizePersistedSettings(current)).toEqual(current);
  });

  it("accepts string-encoded safeSearch numbers from older JSON", () => {
    // Older persisted states sometimes store numbers as strings after
    // a JSON round-trip through a non-Zustand path. The coerce
    // function accepts both.
    const out = normalizePersistedSettings({ safeSearch: "2" });
    expect(out.safeSearch).toBe(2);
  });

  it("preserves boolean false values (doesn't treat them as missing)", () => {
    // A common bug: `false` is falsy, so naive checks like
    // `obj.openInNewTab || DEFAULTS.openInNewTab` would override the
    // user's explicit choice. This test guards against that.
    const out = normalizePersistedSettings({
      openInNewTab: false,
      showFavicons: false,
    });
    expect(out.openInNewTab).toBe(false);
    expect(out.showFavicons).toBe(false);
  });
});

describe("settings migration — migrateSettings (Zustand entry point)", () => {
  it("is the same function as normalizePersistedSettings (no version-specific branches yet)", () => {
    // For versions 1 and 2 the migration is purely "validate and
    // fill defaults". If a future version needs destructive
    // migration, branch on the version argument inside migrate.
    const payload = { defaultCategory: "news", theme: "dark" };
    expect(migrateSettings(payload, 1)).toEqual(normalizePersistedSettings(payload));
    expect(migrateSettings(payload, 0)).toEqual(normalizePersistedSettings(payload));
    expect(migrateSettings(payload, SETTINGS_VERSION)).toEqual(
      normalizePersistedSettings(payload),
    );
  });

  it("migrates a v1 state (with theme) to a v2 state (without theme)", () => {
    // This is the exact scenario that caused the original console
    // error: a browser had v1 in localStorage, the store was bumped
    // to v2 with no migrate function.
    const v1State = {
      theme: "dark",
      defaultCategory: "general",
      defaultTimeRange: "none",
      defaultLanguage: "auto",
      safeSearch: 1,
      openInNewTab: true,
      showFavicons: true, // v1 default was true
    };
    const migrated = migrateSettings(v1State, 1);
    expect((migrated as unknown as Record<string, unknown>).theme).toBeUndefined();
    expect(migrated.showFavicons).toBe(true); // preserved, not reset
    expect(migrated.defaultCategory).toBe("general");
    // The migrated object must be a complete v2 state.
    expect(Object.keys(migrated).sort()).toEqual(
      [
        "defaultCategory",
        "defaultTimeRange",
        "defaultLanguage",
        "safeSearch",
        "openInNewTab",
        "showFavicons",
      ].sort(),
    );
  });

  it("never throws on garbage input", () => {
    // Hydration must not crash even if localStorage is corrupt.
    expect(() => migrateSettings(null, 1)).not.toThrow();
    expect(() => migrateSettings(undefined, 1)).not.toThrow();
    expect(() => migrateSettings("garbage", 1)).not.toThrow();
    expect(() => migrateSettings({}, 1)).not.toThrow();
    expect(() => migrateSettings({ bogus: true }, 1)).not.toThrow();
  });
});
