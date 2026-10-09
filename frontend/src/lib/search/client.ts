import type { SearchResponse } from "@/types/search";
export async function readApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Search rate limit reached. Try again shortly."
        : response.status === 503
          ? "Search service is unavailable. Check backend configuration."
          : `Request failed (${response.status}). Check your filters and try again.`,
    );
  return response.json() as Promise<T>;
}
export function searchUrl(params: URLSearchParams): string {
  const allowed = [
    "q",
    "category",
    "engines",
    "language",
    "time_range",
    "safe_search",
    "page",
    "limit",
    "site",
    "exclude_site",
    "file_type",
    "ranking",
    "preferred_domains",
  ];
  const clean = new URLSearchParams();
  for (const key of allowed) {
    const value = params.get(key);
    if (value) clean.set(key, value);
  }
  return `/api/v1/search?${clean}`;
}
export const search = (params: URLSearchParams, signal: AbortSignal) =>
  readApi<SearchResponse>(searchUrl(params), { signal });
