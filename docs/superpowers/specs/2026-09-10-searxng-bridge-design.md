# SearXNG Bridge Design

**Status:** Approved design, pending written-spec review
**Date:** 2026-09-10

## Goal

Allow the Vercel-hosted Lumen application to reach the household SearXNG instance running on Fedora without exposing SearXNG itself to the public internet.

## Architecture

    Vercel Lumen
        |
        | HTTPS + bearer secret
        v
    Cloudflare Quick Tunnel
        |
        v
    127.0.0.1:8787 dedicated Bun proxy
        |
        v
    127.0.0.1:8080 SearXNG

SearXNG remains bound to the Fedora host's loopback interface through Docker Compose. The tunnel exposes only the dedicated proxy, never SearXNG directly.

## Proxy Responsibilities

The proxy is a tiny deployment-side service implemented with Bun's HTTP server API.

It MUST:

- Bind to `127.0.0.1` only.
- Listen on port `8787`.
- Accept only `GET /search`.
- Reject every other HTTP method with `405 Method Not Allowed` and `Allow: GET`.
- Reject every other path with `404 Not Found`.
- Require `Authorization: Bearer <shared-secret>`.
- Return `401 Unauthorized` for missing or invalid credentials.
- Forward only the request's query parameters to the fixed SearXNG endpoint `http://127.0.0.1:8080/search`.
- Never forward the incoming `Authorization` header to SearXNG.
- Never accept an upstream URL, host, port, or path from the client.
- Preserve the SearXNG response status and JSON response body/content type sufficiently for the existing Lumen provider to consume it.
- Apply a bounded upstream request timeout and return an appropriate gateway error when SearXNG cannot be reached.

For defense in depth, the proxy should whitelist the query parameters used by Lumen:

- `q`
- `format`
- `categories`
- `pageno`
- `time_range`
- `language`
- `safesearch`

The proxy must not become a general-purpose query-string forwarder.

## Authentication

Use a high-entropy bearer secret generated locally, for example:

    openssl rand -hex 32

The same secret is configured independently in:

- Fedora's proxy environment.
- Vercel's `SEARXNG_AUTH_SECRET` environment variable.

The proxy compares the bearer credential against its configured secret and does not pass the credential upstream.

The secret must never be committed to Git.

## Lumen Configuration

Local Fedora development continues to use:

    SEARXNG_URL=http://127.0.0.1:8080

The deployed Vercel application will use the Cloudflare Quick Tunnel URL as `SEARXNG_URL` and the shared bearer secret as `SEARXNG_AUTH_SECRET`.

No `NEXT_PUBLIC_` variable is introduced. Browser code remains unaware of the tunnel URL and secret.

## Cloudflare Quick Tunnel

For temporary testing, Cloudflare Quick Tunnel points at the proxy:

    cloudflared tunnel --url http://127.0.0.1:8787

The random `*.trycloudflare.com` URL is temporary and intended only for development/testing. Proxy authentication is therefore mandatory even though the tunnel URL itself is not private.

A permanent deployment should later replace the Quick Tunnel with a named Cloudflare Tunnel/domain or a private mesh/VPN arrangement. That is explicitly out of scope for this change.

## Testing

Add focused automated tests for the proxy handler covering at least:

1. Valid bearer token + `GET /search` forwards to the fixed SearXNG endpoint.
2. Missing bearer token returns `401`.
3. Invalid bearer token returns `401`.
4. Non-GET requests return `405`.
5. Non-`/search` paths return `404`.
6. The incoming `Authorization` header is not forwarded upstream.
7. Client-controlled URL/host/port data cannot change the fixed upstream destination.
8. Upstream timeout/failure produces a gateway error.
9. Relevant query parameters are preserved and unsupported parameters cannot create arbitrary upstream behavior.

After implementation, perform integration verification on Fedora:

- SearXNG responds directly on `127.0.0.1:8080`.
- Proxy responds directly on `127.0.0.1:8787` with valid authentication.
- Proxy rejects unauthenticated requests.
- Cloudflare Quick Tunnel reaches the proxy, not SearXNG.
- A real search through the tunnel returns SearXNG JSON.
- Vercel's deployed Lumen can perform a real search through the authenticated tunnel.

## Operational Notes

The Fedora machine must remain online for remote Vercel searches to work.

The proxy and SearXNG are household infrastructure, not public SaaS infrastructure.

The existing Lumen application architecture remains unchanged:

    Browser
      -> Next.js /api/search
      -> SearchService
      -> SearXNG provider
      -> bridge
      -> SearXNG

The bridge is a deployment boundary rather than a new browser-facing API.

## Scope Exclusions

- No revival of the deleted Caddy proxy.
- No arbitrary reverse-proxy functionality.
- No database, accounts, or query history.
- No direct public exposure of SearXNG.
- No permanent Cloudflare domain/tunnel configuration.
- No redesign of the existing search API.
