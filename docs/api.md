# API

The backend exposes versioned JSON routes and interactive schemas at `/docs`; the precise deployed request and response definitions are available at `/openapi.json`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | Lightweight application health |
| GET | `/api/v1/search` | Search with validated query parameters |
| GET | `/api/v1/engines` | Public source configuration and capabilities |
| GET | `/api/v1/categories` | Supported and unavailable categories |
| GET | `/api/v1/diagnostics` | Protected aggregate operational counters |
| POST | `/api/v1/search/compare` | Compare two engine selections |

Search example: `/api/v1/search?q=python&category=developer&engines=github,hackernews&limit=10`. Query validation caps length, result count and pagination. Filter parameters include `language`, `time_range`, `safe_search`, `site`, `exclude_site`, `file_type`, `ranking` and `preferred_domains`; list values are comma-separated at the GET boundary.

Search returns normalized results, result count, page, limit, `has_more`, measured `timing_ms`, engine statuses, partial/cached flags, applied filters and available source suggestions. `result_count` is the number actually returned (at most `limit`), not a candidate count or an upstream total. It does not assert a complete global result total. Results contain stable IDs, safe URLs, source attribution, typed metadata and ranking explanations.

A default category with no configured eligible source returns HTTP 422 (`No configured sources for this category`). Explicit unavailable source selections remain visible in engine statuses and partial-result metadata.

Comparison accepts `{ "q": "python", "left": { "engines": ["github"] }, "right": { "engines": ["hackernews"] } }`. Shared and unique canonical URLs and overlap are calculated from returned data. Latency and overlap do not establish objective source quality.

Diagnostics are disabled without an operator-configured token. Keep backend port 8000 private; the supplied Compose stack publishes only the frontend. Use `Authorization: Bearer <token>` for diagnostics; missing configuration returns 404. Consult OpenAPI for exact validation failures.
