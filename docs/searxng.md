# SearXNG configuration

Lumen uses SearXNG as its server-side meta-search backend.

## Quick start

```bash
mkdir -p docker/searxng-data
cp docker/searxng.settings.yml docker/searxng-data/settings.yml

sed -i "s/REPLACE_WITH_A_LONG_RANDOM_STRING/$(openssl rand -hex 32)/" \
  docker/searxng-data/settings.yml

bun run searxng:up
```

Verify the JSON API:

```bash
curl -s "http://127.0.0.1:8080/search?q=test&format=json" | head -c 200
```

You should see JSON.

## Files

| Path | Purpose |
| --- | --- |
| `docker/searxng.docker-compose.yml` | Docker Compose service definition. |
| `docker/searxng.settings.yml` | Committed configuration template. |
| `docker/searxng-data/` | Persistent runtime configuration. Gitignored because it contains the generated secret key. |

On Fedora, the Compose volume uses the `:Z` SELinux label so the container can access the persistent configuration directory.

## Configuration

The template deliberately inherits SearXNG's default engine catalog with:

```yaml
use_default_settings: true
```

It then configures the pieces Lumen needs:

- JSON responses are enabled.
- Safe search defaults to moderate.
- A random `server.secret_key` is required.
- SearXNG's built-in limiter is disabled because Lumen has its own lightweight in-memory limiter.
- Image proxying is enabled.

The project does not maintain a custom fixed engine list. SearXNG's default engine catalog applies unless you add overrides to your persistent settings.

### Adding or disabling engines

Edit:

```text
docker/searxng-data/settings.yml
```

For example:

```yaml
engines:
  - name: google
    disabled: true
  - name: bing
    disabled: true
```

Then restart:

```bash
bun run searxng:down
bun run searxng:up
```

See the SearXNG engine documentation for the current engine catalog.

## Safe search

Lumen exposes SearXNG's three safe-search levels:

| Level | Meaning |
| --- | --- |
| 0 | Off |
| 1 | Moderate |
| 2 | Strict |

The default is `1`.

## Language

Lumen exposes a curated set of language values through the search settings. The allowed list is defined in:

```text
src/lib/validation/search.ts
```

## Security

- The Compose file binds SearXNG to `127.0.0.1:8080` by default.
- Keep SearXNG on localhost when the external access layer is a reverse proxy or tunnel on the same host.
- Replace the `secret_key` placeholder before running the service.
- Never commit `docker/searxng-data/settings.yml`.
- If SearXNG must be reachable remotely, put authentication/access control in front of it. Do not rely on the raw SearXNG URL as a security boundary.

## Fedora remote access

Keep the SearXNG container bound to `127.0.0.1:8080`.

When Vercel needs to reach this instance, use the Lumen authenticated bridge instead of exposing SearXNG directly:

```text
127.0.0.1:8787 proxy → 127.0.0.1:8080 SearXNG
```

Start the bridge with:

```bash
export SEARXNG_AUTH_SECRET="$(openssl rand -hex 32)"
bun run searxng:proxy
```

The bridge requires the bearer secret and accepts only `GET /search`. It has no arbitrary upstream URL or port selection.

For temporary Vercel testing, point a Cloudflare Quick Tunnel at the bridge:

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

Never point that temporary tunnel directly at `127.0.0.1:8080`.

The same `SEARXNG_AUTH_SECRET` must be configured in Vercel. See [`deployment.md`](deployment.md) for the complete remote setup.

---

## Updating SearXNG

The Compose file currently uses the `searxng/searxng:latest` image.

```bash
bun run searxng:down
docker pull searxng/searxng:latest
bun run searxng:up
```

Check logs after updates:

```bash
bun run searxng:logs
```

If you later pin a specific SearXNG release, update the Compose image and document the chosen version here.
