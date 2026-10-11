# Architecture

LUMEN is a self-hosted developer and research discovery platform, not a web crawler or a full-web index. The Next.js App Router frontend forwards same-origin API calls to a fixed, server-configured FastAPI backend. No third-party API credentials are required. The frontend signs random browser identities with a server-only shared secret; the backend verifies them for session limits and applies an aggregate proxy-peer ceiling. Users cannot select arbitrary proxy destinations.

FastAPI validates requests into Pydantic models. An injected registry selects adapters; the orchestrator schedules concurrent, bounded HTTP requests with per-engine and overall deadlines. Results pass through URL normalization, deduplication, filtering and deterministic ranking before the response is returned. Safe engine status summaries make partial failures visible.

The backend owns a bounded, process-local TTL cache and aggregate diagnostics. Each worker has separate caches, counters and upstream throttling state; running more workers increases aggregate provider load. One worker is the default. No database or Redis is required.

The production registry contains six enabled public API providers. arXiv serializes its requests and spaces starts by at least three seconds in the single backend process supplied by Compose. Multiple backend instances require shared rate coordination to satisfy arXiv's cross-machine limit. Retired provider adapters are absent from the registry.

Dedicated `/search`, `/workspace`, `/saved`, `/profiles`, `/settings` and `/compare` routes share responsive navigation. Zustand stores local preferences and profiles; IndexedDB stores research collections and optional history. No account or server-side research storage is required. See [privacy](privacy.md), [API](api.md) and [deployment](deployment.md).
