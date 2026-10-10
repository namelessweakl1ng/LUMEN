import type { Engine } from "@/types/search";
/** Domains and preferred domains are applied locally by SearchService. */
export function supportsProfileFilter(
  engines: Engine[],
  filter: string,
): boolean {
  if (["site", "exclude_site", "preferred_domains"].includes(filter))
    return true;
  if (filter === "time_range") return supportsDateFilter(engines);
  return (
    engines.length > 0 &&
    engines.every((engine) => engine.filters.includes(filter))
  );
}
/** Date fallback can filter known dated results; undated results are excluded. */
export function supportsDateFilter(engines: Engine[]): boolean {
  return engines.some(
    (engine) =>
      engine.filters.includes("time_range") ||
      ["github", "crossref", "hackernews", "google_news"].includes(engine.id),
  );
}
