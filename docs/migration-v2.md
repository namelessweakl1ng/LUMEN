# Migration from V1

V1 provided a Next.js interface backed by SearXNG, including a TypeScript bridge and SearXNG Compose configuration. V2 replaces that runtime with independently implemented Python adapters, orchestration, deduplication and ranking. No SearXNG implementation was copied or translated. Git history and the repository license preserve project provenance.

The application now lives in `frontend/` and Python services in `backend/`. Root package commands move to `cd frontend`; setup and tests use the commands in [deployment](deployment.md) and [testing](testing.md). Docker entrypoint is root `compose.yml`. Old SearXNG secrets and service URLs are unnecessary. Keep only the optional server-side variables documented in `.env.example`.

The V2 API is versioned at `/api/v1/` and has a new normalized response contract. Clients relying on V1 provider-specific JSON must migrate; no silent compatibility proxy to SearXNG exists. Category availability now reflects actual adapters; maps/videos are unavailable without a permitted integration.

Local storage schemas and supported import/export formats are validated by V2. Export important browser data before deployment or origin changes. Historical SearXNG design documents remain clearly labeled historical where retained; they are not current setup instructions.
