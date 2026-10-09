# Deployment

## Docker Compose

Install Docker Engine and the Compose plugin (on Fedora, use the official Docker installation instructions or a compatible Compose-enabled container runtime). From the checkout:

```sh
cp .env.example .env
docker compose config --quiet
docker compose up --build -d
docker compose ps
curl --fail http://localhost:3000/api/v1/health
```

Open http://localhost:3000. No paid API key, Redis, PostgreSQL or SearXNG service is required. Backend and frontend containers run as non-root users and have health checks. Production builds use frozen uv and Bun lockfiles and versioned build images. Dependency updates should regenerate locks deliberately and rerun validation.

The backend is reachable only on the internal Compose network. Only port `LUMEN_PORT` (default 3000) is published. For internet deployment put TLS and an appropriately configured reverse proxy in front of it, control ingress and upstream quotas, and keep diagnostics private. Do not log query strings in reverse-proxy access logs.

`LUMEN_BACKEND_URL` is a fixed server-side frontend setting; Compose sets it to `http://backend:8000`. Optional `GITHUB_TOKEN`, `BRAVE_API_KEY`, `CROSSREF_MAILTO` and `LUMEN_DIAGNOSTICS_TOKEN` belong only on the backend. The browser uses the same-origin Next.js proxy; backend cross-origin browser access is not enabled. Never prefix credentials with `NEXT_PUBLIC_`.

## Local development

Install Python 3.12+, uv, Node 22 and Bun 1.3.4. In separate terminals:

```sh
cd backend
uv sync --frozen
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log --no-proxy-headers
```

```sh
cd frontend
bun install --frozen-lockfile
LUMEN_BACKEND_URL=http://127.0.0.1:8000 bun run dev
```

Environment variables must be exported to the local backend process; copying the root `.env` alone does not inject them into a shell. The Compose CLI loads that file for its substitutions.

## Troubleshooting

Run `docker compose ps` and `docker compose logs backend frontend`. Health checks verify the application, not every upstream provider. Inspect `/api/v1/engines` and search status summaries for missing credentials, throttling or failed sources. Confirm outbound DNS/HTTPS access to configured provider domains. A rate limit is not a reason to bypass provider restrictions. Retry after the provider's backoff period or narrow engine selections.

Use `docker compose build` for production-image validation and `docker compose down` to stop. Collections remain in the browser; clearing site storage deletes them. Export before changing deployment origin.

## Corporate or cloud network trust

The Dockerfiles accept optional BuildKit secrets `build_ca` (a trusted PEM CA bundle) and `build_proxy` (the HTTPS proxy URL) during dependency installation. They are mounted only for the install step and are not copied into final images. Supply these via `docker build --secret id=build_ca,src=/path/to/trusted-ca.pem --secret id=build_proxy,env=HTTPS_PROXY`; repeat for each component as needed. Resolve build-network DNS through supported Docker network/host settings. Do not disable TLS or lockfile checksum verification. Runtime access through a private CA requires a separate operator-managed trust mount and HTTPS proxy configuration.

## Backend tuning

| Variable | Default | Valid range |
| --- | --- | --- |
| `LUMEN_CACHE_TTL_SECONDS` | 120 | 0–3600 |
| `LUMEN_CACHE_MAX_ENTRIES` | 128 | 0–4096 |
| `LUMEN_ENGINE_TIMEOUT_SECONDS` | 8 | 0.1–60 |
| `LUMEN_QUERY_TIMEOUT_SECONDS` | 9 | 0.1–120 |
| `LUMEN_MAX_OUTBOUND_CONCURRENCY` | 12 | 1–128 |
| `LUMEN_RATE_LIMIT_PER_MINUTE` | 120 | 1–10000 |

Configuration validates at startup. These are process-local budgets; more workers multiply upstream traffic. Zero cache TTL/size disables useful caching. Keep concurrency and quotas compatible with each provider's limits.
