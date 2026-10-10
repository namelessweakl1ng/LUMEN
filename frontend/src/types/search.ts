export type SearchCategory =
  | "general"
  | "developer"
  | "science"
  | "news"
  | "images"
  | "videos"
  | "maps"
  | "files";
export type TimeRange = "none" | "day" | "week" | "month" | "year";
export type SafeSearchLevel = 0 | 1 | 2;
export interface SearchOptions {
  query: string;
  category?: SearchCategory;
  timeRange?: TimeRange;
  language?: string;
  safeSearch?: SafeSearchLevel;
  page?: number;
}
export interface SearchResult {
  id: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  category: SearchCategory;
  source_engines: string[];
  published_at?: string;
  thumbnail_url?: string;
  score: number;
  rank: number;
  metadata: Record<string, unknown>;
  ranking_explanation: Record<string, unknown>;
}
export interface EngineStatus {
  engine: string;
  status: string;
  latency_ms: number;
  message?: string;
}
export interface SearchResponse {
  query: string;
  results: SearchResult[];
  suggestions: string[];
  category: SearchCategory;
  page: number;
  limit: number;
  has_more: boolean;
  result_count: number;
  timing_ms: number;
  engine_status: EngineStatus[];
  partial: boolean;
  cached: boolean;
  applied_filters: Record<string, unknown>;
}
export interface Engine {
  id: string;
  name: string;
  categories: SearchCategory[];
  requires_auth: boolean;
  configured: boolean;
  enabled: boolean;
  filters: string[];
  rate_limit_per_minute: number;
  pagination?: boolean;
  interface_type?: "public_api" | "rss" | "experimental_html";
  access_note?: string;
  timeout_seconds?: number;
  availability?: string;
}
export interface Category {
  id: SearchCategory;
  name?: string;
  available: boolean;
  engines?: string[];
  reason?: string;
}
export interface CompareResponse {
  left: SearchResponse;
  right: SearchResponse;
  shared: string[];
  left_only: string[];
  right_only: string[];
  overlap: number;
}
export interface SearchError {
  message: string;
  code: string;
  retryable: boolean;
}
export type SearchOutcome =
  { ok: true; response: SearchResponse } | { ok: false; error: SearchError };
