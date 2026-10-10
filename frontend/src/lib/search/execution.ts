import type { Engine, SearchCategory } from "@/types/search";
import type { Profile } from "./profiles";
import { profileParams } from "./profiles";
import { supportsProfileFilter } from "./capabilities";
/** Prepare an execution copy without mutating URL input or persisted profiles. */
export function prepareSearch(input: URLSearchParams, engines: Engine[]) {
  const params = new URLSearchParams(input),
    category = (params.get("category") || "general") as SearchCategory;
  const requested = (params.get("engines") || "").split(",").filter(Boolean);
  const available = engines.filter(
    (e) => e.enabled && e.configured && e.categories.includes(category),
  );
  const active = requested.length
    ? available.filter((e) => requested.includes(e.id))
    : available;
  const unavailable = requested.filter(
    (id) => !active.some((e) => e.id === id),
  );
  const blocked = requested.length > 0 && active.length === 0;
  if (requested.length && !blocked)
    params.set("engines", active.map((e) => e.id).join(","));
  const cleared: string[] = [];
  for (const field of ["time_range", "language", "file_type", "safe_search"]) {
    const value = params.get(field),
      defaultValue =
        field === "time_range"
          ? "none"
          : field === "language"
            ? "en"
            : field === "safe_search"
              ? "1"
              : "";
    if (
      value &&
      value !== defaultValue &&
      !supportsProfileFilter(active, field)
    ) {
      params.delete(field);
      cleared.push(field.replaceAll("_", " "));
    }
  }
  return { params, unavailable, blocked, cleared };
}
export function prepareProfile(profile: Profile, engines: Engine[]) {
  const result = prepareSearch(
    profileParams(profile, new URLSearchParams()),
    engines,
  );
  const params = result.params;
  return {
    ...result,
    profile: {
      ...profile,
      engines: (params.get("engines") || "").split(",").filter(Boolean),
      language: params.get("language") || "en",
      time_range: (params.get("time_range") || "none") as Profile["time_range"],
      safe_search: Number(
        params.get("safe_search") || 1,
      ) as Profile["safe_search"],
      file_type: params.get("file_type") || "",
    },
  };
}
