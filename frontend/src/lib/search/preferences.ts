import { migrateSettings, SETTINGS_VERSION } from "@/lib/settings/migrate";
export function readPreferences(
  current: unknown,
  legacy: unknown,
): { showImages: boolean; openInNewTab: boolean } {
  const previous =
    legacy && typeof legacy === "object" && "state" in legacy
      ? (legacy as { state: unknown }).state
      : legacy;
  const migrated = migrateSettings(previous, SETTINGS_VERSION);
  const data =
    current && typeof current === "object"
      ? (current as Record<string, unknown>)
      : {};
  return {
    showImages: data.showImages === true,
    openInNewTab:
      typeof data.openInNewTab === "boolean"
        ? data.openInNewTab
        : migrated.openInNewTab,
  };
}
