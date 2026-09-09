# SearXNG configuration

This doc covers everything you need to run and tune the SearXNG instance that powers Lumen.

## Quick start (local Docker)

```bash
mkdir -p docker/searxng-data
cp docker/searxng.settings.yml docker/searxng-data/settings.yml

# IMPORTANT: replace the secret_key placeholder with a random string
sed -i "s/REPLACE_WITH_A_LONG_RANDOM_STRING/$(openssl rand -hex 32)/" \
  docker/searxng-data/settings.yml

bun run searxng:up   # = docker compose -f docker/searxng.docker-compose.yml up -d
```

Verify:

```bash
curl -s "http://localhost:8080/search?q=test&format=json" | head -c 200
```

You should see JSON. If you see HTML, SearXNG didn't pick up the `formats: [html, json]` line in `settings.yml` — check that the file is at `docker/searxng-data/settings.yml` and restart the container.

## Files

| Path | Purpose |
| --- | --- |
| `docker/searxng.docker-compose.yml` | Service definition. Binds to `127.0.0.1:8080`. |
| `docker/searxng.settings.yml` | Template config — copied into `docker/searxng-data/settings.yml` on first run. |
| `docker/searxng-data/` | Persistent config volume. **Not committed to git.** Back this up if you customize via the YAML. |

## The settings file

The included `searxng.settings.yml` is intentionally minimal:

- `use_default_settings: true` — inherit SearXNG's sane defaults.
- `search.formats: [html, json]` — **required** for Lumen to fetch JSON.
- `search.safe_search: 1` — moderate by default. Users can override per-search.
- `server.secret_key: "REPLACE_WITH_A_LONG_RANDOM_STRING"` — **must be replaced**.
- `server.limiter: false` — SearXNG's built-in limiter is off. Lumen has its own.
- A focused `engines:` block: DuckDuckGo, Brave, Bing, Google, Wikipedia, Google News, Bing News, Bing Images, DuckDuckGo Images, YouTube.

## Adding / removing engines

Edit `docker/searxng-data/settings.yml` (the persistent copy the container reads). The full engine catalog is at <https://docs.searxng.org/admin/engines/>.

To enable an engine:

```yaml
engines:
  - name: mojeek
    engine: mojeek
    shortcut: mj
    disabled: false
```

To disable an engine, set `disabled: true` or remove the block.

Restart after editing:

```bash
bun run searxng:down && bun run searxng:up
```

## Why not enable every engine?

SearXNG supports hundreds of engines, but many are unreliable or rate-limited. A focused set:

- Reduces the chance of one bad engine slowing down the whole result set.
- Keeps the JSON payload small.
- Makes error states easier to reason about.

For household use, the included set (DuckDuckGo, Brave, Bing, Google, Wikipedia + news/images/videos sources) covers nearly all needs.

## Safe search

SearXNG's safe search has three levels:

| Level | Meaning |
| --- | --- |
| 0 | Off |
| 1 | Moderate (default) |
| 2 | Strict |

Lumen exposes all three in the Settings panel and in the `safe` query parameter. The default is 1 (moderate) — a reasonable middle ground for a household.

## Language

SearXNG's `language` parameter accepts BCP-47 codes. Lumen's settings panel exposes a curated subset:

- `auto` (let SearXNG decide)
- Major Indian languages: Hindi, Bengali, Telugu, Tamil, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu
- Major world languages: English, French, German, Spanish, Italian, Portuguese, Russian, Japanese, Chinese (Simplified), Korean, Arabic

To add more, edit `ALLOWED_LANGUAGES` in `src/lib/validation/search.ts`.

## Security

- **Bind to 127.0.0.1 by default.** The included `docker-compose.yml` maps `127.0.0.1:8080:8080`, so SearXNG is only reachable from the host. To expose it on your LAN, change to `0.0.0.0:8080:8080` and put it behind an authenticated reverse proxy.
- **Admin UI disabled.** All configuration happens via the YAML file. There is no `/admin` endpoint to attack.
- **`secret_key` must be replaced.** SearXNG uses it for session cookies and CSRF tokens. The included placeholder is intentionally invalid — generate one with `openssl rand -hex 32`.
- **No commit of secrets.** `docker/searxng-data/` is gitignored. The committed `searxng.settings.yml` is a template with a placeholder.

## Updating SearXNG

```bash
bun run searxng:down
docker pull searxng/searxng:latest
bun run searxng:up
```

The persistent `docker/searxng-data/` survives updates. If a new SearXNG release introduces breaking config changes, the container will fail to start with a clear log message — check `bun run searxng:logs`.
