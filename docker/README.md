# SearXNG Docker setup for Lumen

## Files

| File | Purpose |
| --- | --- |
| `searxng.docker-compose.yml` | Docker Compose service definition |
| `searxng.settings.yml` | SearXNG configuration template (JSON API, safe-search defaults) |

## Quick start

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
# or: docker compose -f docker/searxng.docker-compose.yml up -d

# 5. Verify it's up
curl -s "http://localhost:8080/search?q=test&format=json" | head -c 200
```

You should see JSON. If you see HTML, SearXNG didn't pick up the `formats: [html, json]` line — check that `docker/searxng-data/settings.yml` exists and restart the container.

## Stopping / logs

```bash
bun run searxng:down     # stop
bun run searxng:logs     # follow logs
```

## How the settings work

The template uses `use_default_settings: true`, which inherits all of SearXNG's default engines and configuration. It then overrides only what Lumen needs:

- `search.formats: [html, json]` — **critical**: without `json` in this list, Lumen's API can't get JSON responses.
- `search.safe_search: 1` — moderate by default; users can override per-search.
- `server.secret_key` — must be replaced (the setup script does this).
- `server.limiter: false` — SearXNG's built-in limiter requires Redis/Valkey. Lumen has its own in-memory limiter.
- `server.image_proxy: true` — proxy image results through SearXNG.

## Adding / removing engines

By default, all SearXNG engines are enabled. To disable a specific engine, add an `engines:` section to `docker/searxng-data/settings.yml`:

```yaml
engines:
  - name: google
    disabled: true
  - name: bing
    disabled: true
```

The `engines:` section merges with the defaults by engine name — you only need to list engines you want to override.

The full engine catalog is at <https://docs.searxng.org/admin/engines/>.

After editing, restart:

```bash
bun run searxng:down && bun run searxng:up
```

## Security notes

- The compose file binds SearXNG to `127.0.0.1:8080` — it is NOT reachable from outside the host by default. To expose it on your LAN, change the port mapping to `"0.0.0.0:8080:8080"` and put it behind an authenticated reverse proxy.
- The SearXNG admin UI is disabled. All configuration happens via the YAML file.
- The `secret_key` placeholder MUST be replaced before going live. The setup script in this README does this automatically.
- `docker/searxng-data/` is gitignored — it contains your generated secret key.
