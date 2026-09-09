# SearXNG Docker setup for Lumen

This directory contains everything needed to run a local SearXNG instance for Lumen.

## Files

| File | Purpose |
| --- | --- |
| `searxng.docker-compose.yml` | Docker Compose service definition |
| `searxng.settings.yml` | SearXNG configuration (engines, JSON API, safe-search defaults) |

## Quick start

```bash
# 1. From the project root, create the persistent config directory:
mkdir -p docker/searxng-data

# 2. Copy the settings file into the persistent volume so SearXNG
#    picks it up on first boot:
cp docker/searxng.settings.yml docker/searxng-data/settings.yml

# 3. (IMPORTANT) Generate a random secret key and replace the
#    placeholder in the settings file:
sed -i "s/REPLACE_WITH_A_LONG_RANDOM_STRING/$(openssl rand -hex 32)/" \
  docker/searxng-data/settings.yml

# 4. Start SearXNG:
bun run searxng:up
# or: docker compose -f docker/searxng.docker-compose.yml up -d

# 5. Verify it's up:
curl -s "http://localhost:8080/search?q=test&format=json" | head -c 200
```

Once running, set `SEARXNG_URL=http://localhost:8080` in your `.env` file and start the Lumen dev server with `bun run dev`.

## Stopping / logs

```bash
bun run searxng:down     # stop
bun run searxng:logs     # follow logs
```

## Adding / removing engines

Edit `docker/searxng-data/settings.yml` (the persistent copy that the container actually reads). The `engines:` block is where you enable or disable individual search engines. The full engine list is documented at <https://docs.searxng.org/admin/engines/>.

After editing, restart the container:

```bash
bun run searxng:down && bun run searxng:up
```

## Security notes

- The compose file binds SearXNG to `127.0.0.1:8080` so it is NOT reachable from outside the host by default. If you want it reachable from other devices on your LAN, change the port mapping to `"0.0.0.0:8080:8080"` and put it behind an authenticated reverse proxy.
- The SearXNG admin UI is disabled. All configuration happens via the YAML file.
- The `secret_key` placeholder MUST be replaced before going live. Never commit the actual key.
