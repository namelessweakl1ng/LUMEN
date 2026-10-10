import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
describe("browser preference persistence", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());
  function storage(initial: Record<string, string>) {
    const data = new Map(Object.entries(initial));
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    });
    return data;
  }
  it("hydrates valid V2 preferences even when the legacy key is corrupt", async () => {
    const data = storage({
      "lumen-preferences": JSON.stringify({
        showImages: true,
        openInNewTab: false,
      }),
      "lumen-settings": "broken",
    });
    const { hydratePreferences, usePreferences } =
      await import("../../src/lib/search/preferences-store");
    hydratePreferences();
    expect(usePreferences.getState().showImages).toBe(true);
    expect(usePreferences.getState().openInNewTab).toBe(false);
    expect(data.get("lumen-settings")).toBe("broken");
    usePreferences.getState().setShowImages(false);
    expect(JSON.parse(data.get("lumen-preferences")!)).toEqual({
      showImages: false,
      openInNewTab: false,
    });
  });
  it("preserves a valid legacy new-tab preference and keeps thumbnails off", async () => {
    storage({
      "lumen-settings": JSON.stringify({
        state: { openInNewTab: false, showFavicons: true },
        version: 1,
      }),
    });
    const { hydratePreferences, usePreferences } =
      await import("../../src/lib/search/preferences-store");
    hydratePreferences();
    expect(usePreferences.getState().openInNewTab).toBe(false);
    expect(usePreferences.getState().showImages).toBe(false);
  });
});
