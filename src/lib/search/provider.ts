import type { SearchOptions, SearchOutcome } from "@/types/search";

/**
 * Search provider interface.
 *
 * The frontend / API layer depends only on this interface. SearXNG is
 * one concrete implementation — another provider could be added later
 * (e.g. a local index, a different meta-search engine) without
 * touching anything outside this package.
 */
export interface SearchProvider {
  /** Human-readable name for diagnostics and logs. */
  readonly name: string;
  /** True if the provider has been configured with the credentials/URL
   *  it needs to make a request. The API layer uses this to emit a
   *  clear "unavailable" error before any network call. */
  readonly configured: boolean;
  search(options: SearchOptions): Promise<SearchOutcome>;
}
