import type { SearchCategory, TimeRange } from "@/types/search";
export interface Profile {
  id: string;
  name: string;
  category: SearchCategory;
  engines: string[];
  ranking: "balanced" | "relevance" | "recency";
  safe_search: 0 | 1 | 2;
  language: string;
  time_range: TimeRange;
  site: string;
  exclude_site: string;
  file_type: string;
  preferred_domains: string;
}
const base = {
  ranking: "balanced" as const,
  safe_search: 1 as const,
  language: "en",
  time_range: "none" as const,
  site: "",
  exclude_site: "",
  file_type: "",
  preferred_domains: "",
};
export const BUILTINS: Profile[] = [
  {
    ...base,
    id: "balanced",
    name: "Balanced",
    category: "general",
    engines: [],
  },
  {
    ...base,
    id: "developer",
    name: "Developer",
    category: "developer",
    engines: ["github", "hackernews"],
  },
  {
    ...base,
    id: "research",
    name: "Research",
    category: "science",
    engines: ["crossref", "wikipedia"],
  },
  {
    ...base,
    id: "news",
    name: "News",
    category: "news",
    engines: ["hackernews"],
    ranking: "recency",
  },
];
export function validateProfiles(value: unknown): Profile[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set(BUILTINS.map((p) => p.id));
  return value.slice(0, 50).flatMap((v) => {
    if (!v || typeof v !== "object") return [];
    const p = v as Record<string, unknown>;
    if (
      typeof p.id !== "string" ||
      !p.id ||
      seen.has(p.id) ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      !Array.isArray(p.engines) ||
      p.engines.length > 20 ||
      !p.engines.every(
        (e) => typeof e === "string" && /^[a-z0-9_-]{1,80}$/.test(e),
      ) ||
      !["general", "developer", "science", "news", "images"].includes(
        String(p.category),
      ) ||
      !["balanced", "relevance", "recency"].includes(String(p.ranking)) ||
      ![0, 1, 2].includes(p.safe_search as number)
    )
      return [];
    const text = (key: string, fallback = "") =>
      typeof p[key] === "string" ? (p[key] as string).slice(0, 500) : fallback;
    seen.add(p.id);
    return [
      {
        id: p.id.slice(0, 100),
        name: p.name.trim().slice(0, 80),
        category: p.category as SearchCategory,
        engines: p.engines as string[],
        ranking: p.ranking as Profile["ranking"],
        safe_search: p.safe_search as Profile["safe_search"],
        language: /^[a-zA-Z-]{2,12}$/.test(text("language"))
          ? text("language")
          : "en",
        time_range: ["none", "day", "week", "month", "year"].includes(
          text("time_range"),
        )
          ? (text("time_range") as TimeRange)
          : "none",
        site: text("site"),
        exclude_site: text("exclude_site"),
        file_type: /^[a-z0-9]{0,10}$/.test(text("file_type"))
          ? text("file_type")
          : "",
        preferred_domains: text("preferred_domains"),
      },
    ];
  });
}
export function profileParams(
  profile: Profile,
  current: URLSearchParams,
): URLSearchParams {
  const out = new URLSearchParams(current);
  for (const [key, value] of Object.entries(profile)) {
    if (key === "id" || key === "name") continue;
    const text = Array.isArray(value) ? value.join(",") : String(value);
    if (text) out.set(key, text);
    else out.delete(key);
  }
  out.delete("page");
  return out;
}
