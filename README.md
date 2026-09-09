# Lumen

**Search, without the noise.**

Lumen is a small, private household search engine powered by [SearXNG](https://searxng.org). It is built for one household — a handful of people, occasional searches, zero or near-zero operating cost.

It is **not** a Google clone, an AI dashboard, a marketing website, or a SaaS product. It is a piece of software: a fast, minimal search interface that treats you like an adult.

---

## What Lumen is

- A Next.js application that runs a clean, keyboard-first search UI.
- A server-side proxy that talks to a SearXNG instance you control.
- A small set of sensible filters (category, time, language, safe search).
- A localStorage-based settings panel — no accounts, no database.
- A Docker Compose file for running SearXNG locally or on a home server.

## What Lumen is not

- **Not a public search engine.** It is for your household.
- **Not a hosted SaaS.** You run it.
- **Not an AI tool.** No LLMs, no chat, no embeddings.
- **Not a marketing site.** No testimonials, no pricing, no feature grid.

---

## Architecture

```
Browser
  → Next.js application
    → server-side search API (/api/search)
      → SearXNG instance (local Docker or remote)
        → external search engines (DuckDuckGo, Bing, Google, …)
```

The browser **never** talks to SearXNG directly. All search traffic goes through the Next.js API, which:

1. Validates the query.
2. Normalizes the options.
3. Checks an in-memory rate limiter.
4. Checks an in-memory TTL cache.
5. Calls SearXNG with a timeout.
6. Validates and normalizes the response.
7. Returns a stable, application-level JSON shape.

SearXNG is replaceable. The frontend depends on a `SearchProvider` interface, not on SearXNG specifics. See [`docs/architecture.md`](docs/architecture.md).

---

## Quick start (local development)

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (or [Bun](https://bun.sh/) — recommended)
- [Docker](https://www.docker.com/) (only for running the real SearXNG)

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set SEARXNG_URL
```

For local development without Docker, you can use the included mock SearXNG (see below). For the real SearXNG, see [docker/README.md](docker/README.md).

### 3. Run SearXNG

**Option A — Real SearXNG via Docker:**

```bash
mkdir -p docker/searxng-data
cp docker/searxng.settings.yml docker/searxng-data/settings.yml
sed -i "s/REPLACE_WITH_A_LONG_RANDOM_STRING/$(openssl rand -hex 32)/" \
  docker/searxng-data/settings.yml
bun run searxng:up
```

**Option B — Mock SearXNG (for development only):**

```bash
cd mini-services/mock-searxng
bun index.js
```

This runs a tiny stand-in server on `http://127.0.0.1:8080` that returns canned results. Useful when you don't want to run Docker.

### 4. Run the Next.js app

```bash
bun run dev
```

Open <http://localhost:3000>. Press `/` to focus the search box. Type a query and press Enter.

---

## Environment variables

All configuration lives in `.env` (gitignored). See [`.env.example`](.env.example) for the full list.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SEARXNG_URL` | yes | — | Base URL of your SearXNG instance, e.g. `http://localhost:8080`. Server-only. |
| `SEARXNG_AUTH_SECRET` | no | — | Bearer token if SearXNG is behind an auth proxy. |
| `SEARXNG_TIMEOUT_MS` | no | `8000` | Request timeout for SearXNG calls. |
| `LUMEN_RATE_LIMIT_PER_MINUTE` | no | `60` | In-memory rate limit per client IP. |
| `LUMEN_CACHE_TTL_MS` | no | `60000` | TTL for the in-memory search cache. |

**No `NEXT_PUBLIC_` variables are used** — nothing sensitive ever reaches the browser.

---

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the Next.js dev server on port 3000. |
| `bun run build` | Production build. |
| `bun run start` | Start the production server (after `build`). |
| `bun run lint` | Run ESLint. |
| `bun run typecheck` | Run `tsc --noEmit`. |
| `bun run test` | Run unit tests (Vitest). |
| `bun run test:watch` | Run unit tests in watch mode. |
| `bun run test:e2e` | Run end-to-end tests (Playwright). |
| `bun run searxng:up` | Start SearXNG via Docker Compose. |
| `bun run searxng:down` | Stop SearXNG. |
| `bun run searxng:logs` | Follow SearXNG logs. |

---

## Deployment

Lumen supports three deployment modes. See [`docs/deployment.md`](docs/deployment.md) for full details.

### Mode A — All local (most private)

Run both Next.js and SearXNG on a home machine. The browser hits the home machine directly. Nothing leaves the LAN.

### Mode B — Next.js on Vercel, SearXNG on a public host

Deploy Next.js to Vercel (free tier). Run SearXNG on a public-facing host (a small VPS, a free container host, or a home server with a tunnel like Cloudflare Tunnel). Set `SEARXNG_URL` to the public SearXNG URL.

### Mode C — Vercel + private LAN SearXNG (does NOT work)

Vercel's serverless functions cannot reach private LAN addresses. If SearXNG only listens on `192.168.x.x` or `10.x.x.x`, Vercel will not be able to call it. For a fully private setup, use Mode A instead.

---

## Privacy

- No accounts, no login, no cookies set by Lumen.
- No analytics, no trackers, no third-party scripts (with one exception, see below).
- Search queries are not stored persistently. The in-memory cache is wiped on restart.
- `robots: noindex, nofollow` on every page.
- The only third-party resource the browser ever loads is **favicons** (from `https://www.google.com/s2/favicons`), and only when the user has explicitly enabled them in Settings. Favicons can be disabled.

---

## Security

- The API never accepts arbitrary proxy URLs from the browser — it only ever talks to the configured `SEARXNG_URL`.
- All inputs are validated and normalized.
- All SearXNG responses are validated and treated as untrusted external data.
- Errors are caught and converted to friendly messages — no stack traces or internal details leak to the client.
- The SearXNG admin UI is disabled in the included config; the `secret_key` must be replaced before going live.
- The included Docker Compose binds SearXNG to `127.0.0.1:8080` by default so it is not exposed externally.

---

## Limitations

- **Rate limiting is in-memory.** On a single long-running server it works as expected. On Vercel (serverless) each instance has its own counter, so the limit is per-instance, not global. This is acceptable for a household app.
- **Caching is in-memory.** Same caveat: each Vercel instance has its own cache. Acceptable for low traffic.
- **No persistent query history.** Lumen does not store what you searched for. If you want history, your browser's address bar is it.
- **No authentication.** Anyone who can reach your Lumen URL can use it. For Mode B (Vercel + public SearXNG), consider putting SearXNG behind an authenticated reverse proxy.

---

## Testing

Unit tests cover query validation, URL handling, SearXNG response normalization, malformed responses, rate limiting, and caching.

```bash
bun run test          # unit tests
bun run test:e2e      # end-to-end tests (requires the dev server running)
```

End-to-end tests use Playwright and cover: homepage load, search input, search submission, results rendering, empty results, error state, keyboard shortcut, theme switching.

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — How the pieces fit together.
- [`docs/local-development.md`](docs/local-development.md) — Setting up a dev environment.
- [`docs/deployment.md`](docs/deployment.md) — Vercel + home network deployment.
- [`docs/searxng.md`](docs/searxng.md) — Configuring SearXNG.
- [`docs/troubleshooting.md`](docs/troubleshooting.md) — Common failures and fixes.

---

## License

MIT. Use it, fork it, share it. Just don't turn it into a SaaS.
