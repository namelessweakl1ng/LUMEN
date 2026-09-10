# SearXNG Docker setup for Lumen

## Files

| File | Purpose |
| --- | --- |
| `searxng.docker-compose.yml` | Docker Compose service definition. |
| `searxng.settings.yml` | SearXNG configuration template. |

## Quick start

```bash
mkdir -p docker/searxng-data

cp docker/searxng.settings.yml docker/searxng-data/settings.yml

sed -i "s/REPLACE_WITH_A_LONG_RANDOM_STRING/$(openssl rand -hex 32)/" \
  docker/searxng-data/settings.yml

bun run searxng:up

curl -s "http://127.0.0.1:8080/search?q=test&format=json" | head -c 200
```

The response should be JSON.

## Stop and logs

```bash
bun run searxng:down
bun run searxng:logs
```

## Configuration

The template uses:

```yaml
use_default_settings: true
```

so it inherits SearXNG's default engine catalog. It enables JSON responses, sets moderate safe search by default, disables SearXNG's built-in limiter, enables image proxying, and requires a generated `secret_key`.

The persistent settings directory is:

```text
docker/searxng-data/
```

It is gitignored because it contains the generated secret key.

## Security

The Compose file binds SearXNG to:

```text
127.0.0.1:8080
```

Keep that binding when Lumen and SearXNG run on the same host. If remote access is required, expose SearXNG through an authenticated reverse proxy or access-controlled tunnel rather than publishing the Docker port directly.

On Fedora, the volume uses the SELinux `:Z` label so the container can access the mounted configuration directory.
