# Deployment

## Docker Compose

Install Docker Engine and the Compose plugin (on Fedora, use the official Docker installation instructions or a compatible Compose-enabled container runtime). From the checkout:

```sh
python tools/configure.py
docker compose config --quiet
docker compose up --build -d
docker compose ps
curl --fail http://localhost:3000/api/v1/health
```

Open http://localhost:3000. No third-party API credentials, Redis, PostgreSQL or SearXNG service is required. Backend and frontend containers run as non-root users and have health checks. Production builds use frozen uv and Bun lockfiles and versioned build images. Dependency updates should regenerate locks deliberately and rerun validation.

The backend is reachable only on the internal Compose network. Only port `LUMEN_PORT` (default 3000) is published. For internet deployment put TLS and an appropriately configured reverse proxy in front of it, control ingress and upstream quotas, and keep diagnostics private. Do not log query strings in reverse-proxy access logs.

`LUMEN_BACKEND_URL` is a fixed server-side frontend setting; Compose sets it to `http://backend:8000`. `CROSSREF_MAILTO` is optional provider contact identification. `LUMEN_DIAGNOSTICS_TOKEN` optionally protects internal diagnostics. Neither is required for searches. `LUMEN_PROXY_SECRET` must be shared by frontend and backend; `python tools/configure.py` generates it without replacing existing `.env` settings. Never publish it. The browser uses the same-origin Next.js proxy; backend cross-origin browser access is not enabled. Never prefix credentials with `NEXT_PUBLIC_`.

## Local development

Install Python 3.12+, uv, Node 22 and Bun 1.3.4. First run `python tools/configure.py` from the repository root. In each terminal, export the generated internal secret before starting either service:

```sh
set -a
. ./.env
set +a
```

Then use separate terminals:

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

Run `docker compose ps` and `docker compose logs backend frontend`. Health checks verify the application, not every upstream provider. Inspect `/api/v1/engines` and search status summaries for disabled adapters, throttling, cooldowns or failed sources. Confirm outbound DNS/HTTPS access to configured provider domains. A rate limit is not a reason to bypass provider restrictions. Retry after the provider's backoff period or narrow engine selections.

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
| `LUMEN_PROXY_PEER_RATE_LIMIT_PER_MINUTE` | 2400 | See startup validation |

Configuration validates at startup. These are process-local budgets; more workers multiply upstream traffic. Zero cache TTL/size disables useful caching. Keep concurrency and quotas compatible with each provider's limits.
The query timeout is a separate overall deadline. Raise `LUMEN_QUERY_TIMEOUT_SECONDS` when raising the engine timeout above its default, or the overall deadline will end the search first.

## Browser identity and HTTPS

The same-origin frontend proxy signs a random browser session identity with the internal shared secret. The backend verifies it and ignores arbitrary forwarded identity/IP headers. Limits default to 120 requests per session per minute plus a 2400-request aggregate ceiling per authenticated proxy peer; fresh cookies cannot bypass the aggregate budget. Without the secret, local development falls back to direct-peer limits and users sharing a frontend may share that bucket. Export the same secret to both services for representative development behavior.

The `lumen-search-session` cookie is HttpOnly, SameSite=Lax and lasts 30 days. It contains no query terms. Set `LUMEN_SECURE_COOKIES=1` for HTTPS deployments. Compose requires the internal secret and keeps the backend private. Do not expose backend port 8000 or rely on untrusted `X-Forwarded-For` headers.

DuckDuckGo HTML remains off by default (`LUMEN_ENABLE_DDG_HTML=0`). Explicit opt-in requires reviewing and complying with current provider access conditions; the flag does not grant permission. Challenges, blocks and rate limits stop requests and trigger cooldowns. No CAPTCHA bypass, proxy rotation or aggressive challenge retries are provided.

Google News RSS is also disabled by default (`LUMEN_ENABLE_GOOGLE_NEWS_RSS=0`) following the current provider-access review. Its parser is retained, but enable it only with documented permission consistent with provider terms and machine-readable instructions; endpoint availability is insufficient. See [the access review](engine-adapters.md#provider-access-review--2026-10-10).
