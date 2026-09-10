# Lumen

**Search, without the noise.**

Lumen is a small, private household search engine powered by [SearXNG](https://searxng.org). It is built for one household — a handful of people, occasional searches, zero or near-zero operating cost.

It is **not** a Google clone, an AI dashboard, or a marketing website. It is a piece of software: a fast, minimal search interface that treats you like an adult.

---

## What Lumen is

- A Next.js application that runs a clean, keyboard-first search UI.
- A server-side proxy that talks to a SearXNG instance you control.
- A small set of sensible filters (category, time, language, safe search).
- A localStorage-based settings panel — no accounts, no database.
- A Docker Compose file for running SearXNG locally or on a home server.

## What Lumen is not

- **Not a hosted service.** Lumen is software you run yourself.
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

The browser **never** talks to SearXNG directly. All search traffic goes through the Next.js API, which validates input, rate-limits, caches, calls SearXNG with a timeout, validates the response, and returns a stable JSON shape.

SearXNG is replaceable: the frontend depends on a `SearchProvider` interface, not on SearXNG specifics. See [`docs/architecture.md`](docs/architecture.md).

---

## Requirements

- [Bun](https://bun.sh/) (recommended) or Node.js 20.9+
- [Docker](https://www.docker.com/) with Docker Compose (for SearXNG)

---

## Install

```bash
git clone <your-repo-url> lumen
cd lumen
bun install
```

## Configure

```bash
cp .env.example .env
```

The default `.env` points `SEARXNG_URL` at `http://localhost:8080`, which is where the Docker Compose file below will expose SearXNG. No changes needed for local use.

## Start SearXNG

```bash
# 1. Create the persistent config directory
mkdir -p docker/searxng-data

# 2. Copy the settings template into the volume
cp docker/searxng.settings.yml docker/searxng-data/settings.yml

# 3. Replace the secret_key placeholder with a random string
sed -i "s/REPLACE_WITH_A_LONG_RANDOM_STRING/$(openssl rand -hex 32)/" \
  docker/searxng-data/settings.yml

# 4. Start SearXNG
bun run searxng:up
```

Verify SearXNG is up:

```bash
curl -s "http://localhost:8080/search?q=test&format=json" | head -c 200
```

You should see JSON. If you see HTML, SearXNG didn't load the `formats: [html, json]` line — check that `docker/searxng-data/settings.yml` exists and restart the container.

## Start Lumen

```bash
bun run dev
```

## Open

Open <http://localhost:3000> in your browser.

- Press `/` to focus the search box.
- Type a query and press Enter.
- Results appear on the same page.

## Stop SearXNG

```bash
bun run searxng:down
```

## Stop Lumen

Press `Ctrl+C` in the terminal where `bun run dev` is running.

---

## Environment variables

All configuration lives in `.env` (gitignored). See [`.env.example`](.env.example) for the full list. All variables are server-only — none are exposed to the browser.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SEARXNG_URL` | yes | — | Base URL of your SearXNG instance. |
| `SEARXNG_AUTH_SECRET` | no | — | Bearer token if SearXNG is behind an auth proxy. |
| `SEARXNG_TIMEOUT_MS` | no | `8000` | Request timeout for SearXNG calls. |
| `LUMEN_RATE_LIMIT_PER_MINUTE` | no | `60` | In-memory rate limit per client IP. |
| `LUMEN_CACHE_TTL_MS` | no | `60000` | TTL for the in-memory search cache. |

---

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the Next.js dev server on port 3000. |
| `bun run build` | Production build. |
| `bun run start` | Start the production server. |
| `bun run lint` | Run ESLint. |
| `bun run typecheck` | Run `tsc --noEmit`. |
| `bun run test` | Run unit tests (Vitest). |
| `bun run test:e2e` | Run end-to-end tests (Playwright). Requires dev server running. |
| `bun run searxng:up` | Start SearXNG via Docker Compose. |
| `bun run searxng:down` | Stop SearXNG. |
| `bun run searxng:logs` | Follow SearXNG logs. |

---

## Deployment

Lumen can run entirely on your own machine, or the Next.js app can be deployed separately from SearXNG.

### Local mode

Run both Next.js and SearXNG on the same home machine:

```
Browser → local Lumen → local SearXNG → search engines
```

This is the simplest setup and keeps the Lumen-to-SearXNG connection local.

### Vercel + home SearXNG

You can deploy the Next.js application to Vercel and keep SearXNG on a Fedora/home server:

```
Browser → Vercel Lumen → secure tunnel/proxy → home SearXNG
```

A Vercel server cannot reach a private LAN address such as `192.168.1.10:8080` directly. The SearXNG endpoint therefore needs a network path that Vercel can reach.

For temporary testing, a Cloudflare Quick Tunnel can provide a public `trycloudflare.com` URL. Quick Tunnels are intended for development/testing, not as a permanent production endpoint. Do not expose an unrestricted SearXNG instance publicly for a long-lived deployment.

For a permanent remote setup, use an authenticated reverse proxy or access-controlled tunnel in front of SearXNG. Set `SEARXNG_AUTH_SECRET` in Lumen if that proxy expects a bearer token.

See [`docs/deployment.md`](docs/deployment.md) for the deployment details.

## Privacy

- No accounts, no login, no cookies set by Lumen.
- No analytics, no trackers, no third-party scripts.
- Search queries are not stored persistently. The in-memory cache is wiped on restart.
- `robots: noindex, nofollow` on every page. `robots.txt` disallows all bots.
- The only optional third-party resource is **favicons** (from `https://www.google.com/s2/favicons`), disabled by default. Enabling it in Settings loads favicons from Google — your search queries are not sent, only domain names.

---

## Security

- The API never accepts arbitrary proxy URLs from the browser — it only ever talks to the configured `SEARXNG_URL`.
- All inputs are validated and normalized.
- All SearXNG responses are validated and treated as untrusted external data. URLs with `javascript:`, `data:`, `file:` protocols are rejected.
- Errors are caught and converted to friendly messages — no stack traces or internal details leak to the client.
- The SearXNG admin UI is disabled. The `secret_key` must be replaced before going live.
- The Docker Compose binds SearXNG to `127.0.0.1:8080` by default so it is not exposed externally.

---

## Limitations

- **Rate limiting is in-memory.** On a single long-running server it works as expected. On Vercel (serverless) each instance has its own counter. Acceptable for a household app.
- **Caching is in-memory.** Same caveat: each Vercel instance has its own cache.
- **No persistent query history.** Lumen does not store what you searched for.
- **No authentication.** Anyone who can reach your Lumen URL can use it. For remote mode, put SearXNG behind an authenticated reverse proxy.

---

## Testing

```bash
bun run test          # unit tests (67 tests)
bun run test:e2e      # end-to-end tests (11 tests, requires dev server)
```

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — How the pieces fit together.
- [`docs/deployment.md`](docs/deployment.md) — Local + Vercel deployment.
- [`docs/searxng.md`](docs/searxng.md) — Configuring SearXNG.
- [`docs/troubleshooting.md`](docs/troubleshooting.md) — Common failures and fixes.

---

## License

Lumen is licensed under the [MIT License](LICENSE).
