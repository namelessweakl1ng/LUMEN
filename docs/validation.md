# V2 validation record

Validated in the Codex Linux development container on 2026-10-09 using Python 3.12.14, Node 24.19.0, Bun 1.3.4 and installed Chromium. This records observed results, not a promise about future provider availability or CI outcomes.

| Check | Actual result |
| --- | --- |
| Backend `uv run pytest` | 81 passed; one upstream Starlette TestClient deprecation warning |
| Backend `uv run ruff check .` | Passed |
| Backend `uv run mypy app` | Passed, 19 source files |
| Frontend `bun run test` | 61 passed, seven files |
| Frontend `bun run lint` | Passed |
| Frontend `bun run typecheck` | Passed with strict typing |
| Frontend `bun run build` | Next.js production build passed |
| Frontend `bun run test:e2e` | 15 passed against real application and fixture-backed adapter HTTP |
| Frozen uv/Bun setup repeat | Passed without dependency/lockfile changes |
| `docker compose config --quiet` | Passed |
| Both production images | Built successfully |
| Compose runtime | Started healthy, frontend and API forwarding HTTP 200; non-root users verified |
| Live keyless adapter smoke | Wikipedia, GitHub, Crossref, Hacker News and Commons each returned three results |
| Live Docker search and images | Three results returned; selected keyless engine statuses successful |

The browser suite covers full-stack submission, source/category/domain selection, profile create/rename/delete and persistence, comparison, bookmarking, collection creation/move/notes/tags/exports, import rejection, empty/partial states, keyboard interaction, mobile overflow, persisted appearance, opt-in licensed thumbnails and two-tab data preservation/deletion. The core CI suite never requires live provider responses.

Live verification uses [`tools/live_smoke.py`](../tools/live_smoke.py). Recorded observations are in [`live-smoke-results.json`](live-smoke-results.json). Optional Brave was unconfigured; its authenticated request/normalization/freshness/rate-limit behavior was tested with HTTP fixtures, not claimed operational.

## Reproducible fixture benchmark

Run `cd backend && uv run python ../benchmarks/fixture_search.py`. The test-only HTTP transport adds 15 ms per source request and uses the real adapters, orchestrator and ASGI API. This is not live-provider performance. The container reported five CPUs. Requests use 20 distinct cold queries, 20 warm requests and a batch of ten distinct concurrent queries, with outbound concurrency twelve. Fixture provider quota guards are raised only in that benchmark.

The recorded 50-request run measured median **17.637 ms**, p95 **55.666 ms**, cache hit rate **0.40**, zero engine errors/timeouts, and **72.294 ms** for the ten-request concurrent batch. See [`fixture-results.json`](../benchmarks/fixture-results.json). Repeated runs vary with scheduler and machine load; no arbitrary speedup is claimed.

## Network and deployment limits

The cloud container's outbound policy required official API destinations. Docker build networking additionally needed injected proxy hostname resolution and trusted CA/proxy BuildKit secrets; certificate/signature/checksum verification stayed enabled. Docker live verification used a temporary operator runtime override passing the same proxy and trusted CA. These are cloud-network details rather than production application dependencies; ordinary internet-connected self-hosted deployments use the supplied Compose file.

Maps, videos and a dedicated file index remain unavailable. File-type filtering is local URL-extension filtering. Pagination and ranks are within source-native pages; `has_more` is best effort. Caches and throttles are per process, and concurrent identical cold queries may issue duplicate upstream requests. Upstream throttling, transient retries and deadlines remain bounded.

Screenshots under [`screenshots/`](screenshots/) capture the running UI with live Python search data and a locally saved result; no provider-response interception was used.
