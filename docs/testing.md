# Testing

Core tests use deterministic mocked HTTP responses and fixtures, not live provider availability. Run from the checkout:

```sh
cd backend
uv sync --frozen
uv run ruff check .
uv run mypy app
uv run pytest
```

```sh
cd frontend
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build
bunx playwright install chromium
bun run test:e2e
```

```sh
docker compose config --quiet
docker compose build
```

Backend tests cover normalization, query validation, ranking, filters, cache identity/bounds, adapter payloads, timeout/error handling and API behavior. Frontend unit and Playwright tests validate search and local research workflows. The test-only FastAPI server in backend/tests/e2e_server.py injects HTTP fixtures into real adapters to provide deterministic provider output; they are test-only and do not substitute fixtures in production.

CI runs backend lint/types/tests, frontend lint/types/unit/build/E2E and Compose configuration/image builds. Browser installation may need operating-system packages (`playwright install --with-deps chromium`). Production image builds require access to their registries.

Live smoke checks are separate: start the real backend and call `/api/v1/search` with explicit source selections. Record actual statuses and results; network restrictions or provider failures do not invalidate deterministic contract tests, and fixture success is not proof of live availability.

Benchmarks must identify fixture versus live inputs, hardware, concurrency and cache state. Report observed median/p95 latency, cache hit rate and failures only after measurement; this documentation makes no unmeasured performance claim.

See [the validation record](validation.md) for actual checks and fixture/live measurement separation.

Optional live smoke: `cd backend && uv run python ../tools/live_smoke.py`. Fixture benchmark: `cd backend && uv run python ../benchmarks/fixture_search.py`.
