> Historical V1 document. SearXNG is not used by V2. See [migration](../../migration-v2.md).

# SearXNG Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a narrowly scoped, bearer-authenticated Bun proxy on Fedora so Vercel-hosted Lumen can securely reach localhost-only SearXNG.

**Architecture:** A pure request handler enforces routing, authentication, query allowlisting, fixed upstream selection, timeout, and response handling. A thin Bun entrypoint binds it to `127.0.0.1:8787`. Cloudflare Quick Tunnel exposes only that proxy.

**Tech Stack:** Bun, TypeScript, Vitest, SearXNG, Cloudflare Quick Tunnel.

**Spec:** `docs/superpowers/specs/2026-09-10-searxng-bridge-design.md`

## Global Constraints

- Bind only to `127.0.0.1`.
- Listen on port `8787`.
- Accept only `GET /search`.
- Other methods return `405` with `Allow: GET`.
- Other paths return `404`.
- Require `Authorization: Bearer <shared-secret>`.
- Missing or invalid credentials return `401`.
- Fixed upstream: `http://127.0.0.1:8080/search`.
- Never allow the client to select an upstream URL, host, port, or path.
- Never forward the incoming `Authorization` header upstream.
- Forward only Lumen's supported query parameters.
- Apply an upstream timeout.
- Never commit secrets.
- Quick Tunnel targets `127.0.0.1:8787`, never `8080`.
- Do not revive Caddy.
- Do not build a general-purpose reverse proxy.

---

## File Map

Create:

- `src/lib/searxng/proxy.ts`
  - Pure, testable proxy request handler.
- `tools/searxng-proxy.ts`
  - Bun server entrypoint.
- `tests/unit/searxng-proxy.test.ts`
  - Security and behavior tests.

Modify:

- `package.json`
  - Add `searxng:proxy`.
- `.env.example`
  - Document proxy secret usage.
- `README.md`
  - Document local and remote deployment.
- `docs/deployment.md`
  - Document proxy and Quick Tunnel startup, Vercel environment configuration, and remote verification.
- `docs/searxng.md`
  - Document the proxy relationship to the localhost SearXNG service and local verification.
- `docs/troubleshooting.md`
  - Document common proxy/tunnel failure modes.

---

## Task 1: Add the Proxy Handler and Security Tests

**Files:**

- Create: `src/lib/searxng/proxy.ts`
- Create: `tests/unit/searxng-proxy.test.ts`

**Interface:**

    export interface SearXNGProxyOptions {
      authSecret: string;
      upstreamFetch?: typeof fetch;
      timeoutMs?: number;
    }

    export async function handleSearXNGProxyRequest(
      request: Request,
      options: SearXNGProxyOptions,
    ): Promise<Response>;

The fixed upstream is:

    http://127.0.0.1:8080/search

Allowed query parameters:

    q
    format
    categories
    pageno
    time_range
    language
    safesearch

### Step 1: Write failing tests

Add tests for:

- `GET /search` with valid credentials.
- Missing credentials -> `401`.
- Invalid credentials -> `401`.
- Wrong path -> `404`.
- Non-GET method -> `405`.
- `Allow: GET` on `405`.

### Step 2: Run the focused test

Run:

    bunx vitest run tests/unit/searxng-proxy.test.ts

Expected: failure because the handler does not exist.

### Step 3: Implement routing and authentication

Implement the handler in this order:

1. Parse the request URL.
2. Require exactly `/search`.
3. Require `GET`.
4. Require `Authorization: Bearer <secret>`.
5. Reject invalid credentials with `401`.
6. Do not forward `Authorization`.

### Step 4: Run the focused test again

    bunx vitest run tests/unit/searxng-proxy.test.ts

Expected: routing and authentication tests pass.

### Step 5: Commit

    git add src/lib/searxng/proxy.ts tests/unit/searxng-proxy.test.ts
    git commit -m "feat: add authenticated SearXNG proxy handler"

---

## Task 2: Lock Down Upstream Forwarding

**Files:**

- Modify: `src/lib/searxng/proxy.ts`
- Modify: `tests/unit/searxng-proxy.test.ts`

### Step 1: Write failing forwarding tests

Verify that:

    /search?q=coffee&format=json&categories=general&pageno=2&language=en&evil=http://127.0.0.1:9999

results in an upstream request containing only:

    q
    format
    categories
    pageno
    language

Verify the upstream hostname and port remain:

    127.0.0.1:8080

Verify that client parameters such as `url`, `host`, and `port` cannot change the upstream destination.

Capture upstream headers and verify:

    Authorization === null

Verify successful upstream JSON is returned correctly.

### Step 2: Run the focused tests

    bunx vitest run tests/unit/searxng-proxy.test.ts

Expected: the new forwarding tests fail.

### Step 3: Implement fixed query forwarding

Construct the destination from the literal:

    new URL("http://127.0.0.1:8080/search")

Copy only the seven approved parameters.

Never construct the destination from request host, protocol, pathname, or arbitrary client data.

### Step 4: Add timeout and failure handling

Default timeout:

    8000

Use an abort signal.

Return:

- `504` for timeout/abort.
- `502` for other upstream fetch failures.

Preserve the upstream status and JSON body where appropriate, but copy only safe response headers such as `Content-Type`.

### Step 5: Run tests

    bunx vitest run tests/unit/searxng-proxy.test.ts
    bun run test

Expected: all tests pass.

### Step 6: Commit

    git add src/lib/searxng/proxy.ts tests/unit/searxng-proxy.test.ts
    git commit -m "test: lock down SearXNG proxy forwarding"

---

## Task 3: Add the Bun Server

**Files:**

- Create: `tools/searxng-proxy.ts`
- Modify: `package.json`

### Step 1: Implement the Bun entrypoint

No additional entrypoint test is required. The executable is intentionally a thin adapter around the already-tested `handleSearXNGProxyRequest` function. Its operational contract is verified during Fedora integration testing in Task 5.

Use Bun's HTTP server API.

Bind explicitly to:

    127.0.0.1

Port:

    8787

Read:

    SEARXNG_AUTH_SECRET

If the secret is missing or empty, terminate with a clear startup error.

Delegate requests to:

    handleSearXNGProxyRequest(request, {
      authSecret,
      timeoutMs: 8000,
    })

Do not make the upstream URL configurable.

### Step 2: Add the package script

Add:

    "searxng:proxy": "bun run tools/searxng-proxy.ts"

Do not add a proxy dependency.

### Step 3: Validate

    bun run typecheck
    bun run lint
    bun run test

Expected: all pass.

### Step 4: Commit

    git add tools/searxng-proxy.ts package.json
    git commit -m "feat: add Bun SearXNG proxy server"

---

## Task 4: Document Deployment

**Files:**

- Modify: `.env.example`
- Modify: `README.md`
- Modify: relevant `docs/` deployment documentation.

Document:

    SearXNG:       127.0.0.1:8080
    Proxy:         127.0.0.1:8787
    Tunnel target: http://127.0.0.1:8787

Document secret generation:

    openssl rand -hex 32

Local Lumen remains:

    SEARXNG_URL=http://127.0.0.1:8080

The deployed Vercel environment uses:

    SEARXNG_URL=https://<quick-tunnel-host>
    SEARXNG_AUTH_SECRET=<shared-secret>

Document startup:

    docker compose -f docker/searxng.docker-compose.yml up -d
    bun run searxng:proxy
    cloudflared tunnel --url http://127.0.0.1:8787

Document direct authentication testing:

    curl -i "http://127.0.0.1:8787/search?q=test&format=json"

    curl -s \
      -H "Authorization: Bearer $SEARXNG_AUTH_SECRET" \
      "http://127.0.0.1:8787/search?q=test&format=json"

Document that Quick Tunnel is temporary testing infrastructure and Fedora must remain online.

Do not commit a real secret or temporary tunnel hostname.

### Verification

    git grep -n "SEARXNG_AUTH_SECRET\|127.0.0.1:8787\|trycloudflare.com"

Review every match for accidental secret exposure or instructions that expose port `8080`.

### Commit

    git add .env.example README.md docs/
    git commit -m "docs: document SearXNG proxy deployment"

---

## Task 5: Verify Fedora Integration

No source changes should be required.

### Step 1: Verify SearXNG

    curl -s "http://127.0.0.1:8080/search?q=test&format=json"

Expected: real SearXNG JSON.

### Step 2: Start the proxy

Set the secret locally:

    export SEARXNG_AUTH_SECRET="$(openssl rand -hex 32)"

Then:

    bun run searxng:proxy

Keep the process running.

### Step 3: Verify unauthenticated access

From another terminal:

    curl -i "http://127.0.0.1:8787/search?q=test&format=json"

Expected:

    401 Unauthorized

### Step 4: Verify authenticated access

    curl -s \
      -H "Authorization: Bearer $SEARXNG_AUTH_SECRET" \
      "http://127.0.0.1:8787/search?q=test&format=json"

Expected: real SearXNG JSON.

### Step 5: Verify routing restrictions

    curl -i \
      -H "Authorization: Bearer $SEARXNG_AUTH_SECRET" \
      "http://127.0.0.1:8787/"

Expected: `404`.

    curl -i -X POST \
      -H "Authorization: Bearer $SEARXNG_AUTH_SECRET" \
      "http://127.0.0.1:8787/search"

Expected: `405` and `Allow: GET`.

### Step 6: Start Quick Tunnel

    cloudflared tunnel --url http://127.0.0.1:8787

Record the generated hostname locally.

### Step 7: Verify unauthenticated tunnel access

    curl -i \
      "https://<quick-tunnel-host>/search?q=test&format=json"

Expected: `401`.

### Step 8: Verify authenticated tunnel access

    curl -s \
      -H "Authorization: Bearer $SEARXNG_AUTH_SECRET" \
      "https://<quick-tunnel-host>/search?q=test&format=json"

Expected: real SearXNG JSON.

### Step 9: Configure Vercel

Set:

    SEARXNG_URL=https://<quick-tunnel-host>
    SEARXNG_AUTH_SECRET=<same-secret>

Redeploy.

### Step 10: Perform a real remote Lumen search

Search from the deployed Vercel application.

Expected path:

    Browser
      -> Vercel /api/search
      -> SearchService
      -> SearXNG provider
      -> Quick Tunnel
      -> 127.0.0.1:8787 proxy
      -> 127.0.0.1:8080 SearXNG

Expected: real search results.

---

## Task 6: Final Verification

Run:

    git diff --check

    bun run typecheck

    bun run lint

    bun run test

    bun run test:e2e

    bun run build

Then inspect:

    git status --short
    git log --oneline --decorate -8
    git diff main...HEAD --stat

Confirm:

- No `.env` is tracked.
- No real bearer secret is tracked.
- No Caddy proxy exists.
- No arbitrary upstream target exists.
- SearXNG remains localhost-only.
- Proxy is localhost-only.
- Quick Tunnel targets port `8787`.
- All tests pass.
- Production build passes.
- Working tree is clean.

## Completion Criteria

The bridge is ready for review only when:

- Authenticated `GET /search` reaches SearXNG.
- Missing/invalid credentials return `401`.
- Wrong methods return `405`.
- Wrong paths return `404`.
- Upstream is always `127.0.0.1:8080/search`.
- Arbitrary client-controlled upstreams are impossible.
- Authorization is never forwarded to SearXNG.
- Unsupported query parameters are not forwarded.
- Timeout and upstream failures return gateway errors.
- Proxy binds only to `127.0.0.1:8787`.
- Quick Tunnel exposes only the proxy.
- Vercel performs a real remote search.
- Typecheck, lint, unit tests, E2E, and build pass.
- No secrets or temporary tunnel hostnames are committed.
- Final working tree is clean.
