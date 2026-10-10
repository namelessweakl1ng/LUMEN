# LUMEN V3

LUMEN is a self-hosted, keyless metasearch application with a Next.js frontend and an independent Python/FastAPI backend. It searches selected sources concurrently, normalizes and deduplicates results, and applies explainable ranking. It does not crawl or index the entire web.

Default sources are Wikipedia, Wikimedia Commons, GitHub public repositories, Crossref and Hacker News. No third-party API credentials are required. DuckDuckGo HTML and Google News RSS are retained but disabled by default; enable them only with documented permission for the proposed automated use. Provider availability, quotas and access conditions still apply. Google News RSS supplies news, not Google Web Search.

The redesigned interface separates [Search](docs/migration-v3.md), Research workspace, Saved items, Search profiles, Settings and comparison. Collections, notes, tags, profiles and optional history remain in browser storage. The existing LUMEN logo and wordmark are preserved.

## Run with Docker

```sh
git clone https://github.com/namelessweakl1ng/LUMEN.git
cd LUMEN
python tools/configure.py
docker compose up --build -d
```

The configuration helper generates a random internal proxy secret in `.env` and preserves existing settings. This secret authenticates LUMEN's own services; it is not a provider credential. Only frontend port 3000 is published. Open http://localhost:3000 and check `curl --fail http://localhost:3000/api/v1/health`. See [deployment](docs/deployment.md) for local development, HTTPS and tuning.

## Architecture

```text
Browser / Next.js / React / IndexedDB
  -> same-origin signed API proxy
  -> FastAPI / HTTPX / asyncio
  -> source adapters / bounded concurrent requests
  -> normalization / filtering / deduplication / ranking / TTL cache
```

Python 3.12+, uv, Node 22 and Bun are used for development. Containers use non-root runtime users, health checks and frozen dependency locks.

## Documentation

- [Architecture](docs/architecture.md), [search execution](docs/search-engine.md), [ranking](docs/ranking.md)
- [Adapters and access conditions](docs/engine-adapters.md), [API](docs/api.md)
- [Deployment](docs/deployment.md), [privacy](docs/privacy.md), [testing](docs/testing.md), [validation](docs/validation.md)
- [V3 migration and screenshots](docs/migration-v3.md), [V1/V2 provenance](docs/migration-v2.md)

## Limitations

Sources provide specialized discovery rather than comprehensive web coverage. Crossref returns scholarly metadata rather than guaranteed full text; Hacker News focuses on technology; news RSS is not a general web index. Maps, videos and a dedicated file index remain unavailable. Filters and pagination vary by source, and local post-filters may reduce result counts. Rankings and comparison overlap are heuristics, not objective quality scores.

Caches, cooldowns and quotas are process-local; extra workers multiply upstream traffic. Browser storage belongs to its origin: export collections before changing hosts. Queries reach selected providers and optional images may contact their hosts; see the privacy guide.

V1 used SearXNG. V2 and V3 independently implement the search layer while preserving Git history and the existing [license](LICENSE).
