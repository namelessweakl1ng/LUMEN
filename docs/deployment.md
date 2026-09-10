# Deployment

Lumen has two practical deployment patterns:

| Mode | Next.js | SearXNG | Best for |
| --- | --- | --- | --- |
| A | Home machine | Home machine (Docker) | Simple private household use |
| B | Vercel | Home server or other reachable host | Remote access from anywhere |

---

## Mode A: all local

Run both Lumen and SearXNG on the same home machine.

### Steps

1. Install Bun or Node.js 20.9+ and Docker.
2. Clone the repository and install dependencies:
   ```bash
   bun install
   ```
3. Start SearXNG. See [`searxng.md`](searxng.md).
4. Set:
   ```dotenv
   SEARXNG_URL=http://127.0.0.1:8080
   ```
5. Build and start Lumen:
   ```bash
   bun run build
   bun run start
   ```
6. For LAN access, bind the Next.js server to an appropriate interface and restrict access with your network firewall or reverse proxy.

This mode keeps the Lumen-to-SearXNG connection on the home machine.

---

## Mode B: Vercel + remote SearXNG

Deploy the Next.js application to Vercel while SearXNG runs elsewhere.

The important rule is:

> Vercel must be able to reach `SEARXNG_URL` from the server side.

A private address such as `http://192.168.1.10:8080` will not work from Vercel.

### Step 1: deploy Lumen to Vercel

The recommended workflow is Git-based:

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Let Vercel detect the Next.js project and use the default build settings.
4. Add the production environment variables under **Project → Settings → Environment Variables**.
5. Deploy.

Lumen does not use any `NEXT_PUBLIC_*` environment variables.

### Step 2: provide a reachable SearXNG endpoint

You have several options:

- A VPS or other server with an authenticated reverse proxy.
- A home server using an access-controlled tunnel.
- A temporary Cloudflare Quick Tunnel for development/testing.

The SearXNG container itself should remain bound to `127.0.0.1:8080` on the Fedora host. Put the authentication and external exposure at the proxy/tunnel layer.

### Fedora authenticated bridge

For a Fedora home server, Lumen should not tunnel directly to SearXNG.

The intended temporary testing topology is:

```text
Vercel Lumen
    │ HTTPS + bearer secret
    ▼
Cloudflare Quick Tunnel
    │
    ▼
127.0.0.1:8787 authenticated proxy
    │
    ▼
127.0.0.1:8080 SearXNG
```

The proxy is implemented by `tools/searxng-proxy.ts`. It:

- binds only to `127.0.0.1:8787`
- accepts only `GET /search`
- requires `Authorization: Bearer <token>`
- forwards only the allowlisted search parameters
- always forwards to `127.0.0.1:8080/search`
- does not forward the bearer token to SearXNG
- times out upstream requests after `SEARXNG_TIMEOUT_MS`

Generate a temporary shared secret:

```bash
export SEARXNG_AUTH_SECRET="$(openssl rand -hex 32)"
```

Start the proxy:

```bash
bun run searxng:proxy
```

Leave it running while the tunnel is active.

In a second terminal, start the Quick Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

Cloudflare will print a temporary `https://*.trycloudflare.com` URL.

Set the Vercel environment variables:

```dotenv
SEARXNG_URL=https://<your-quick-tunnel-host>
SEARXNG_AUTH_SECRET=<the-same-secret>
```

`SEARXNG_AUTH_SECRET` must contain the same value used by the Fedora proxy. Lumen sends it only from its server-side `/api/search` handler and never exposes it as a `NEXT_PUBLIC_*` variable.

Quick Tunnels are intended for testing and development. They are temporary public endpoints and should not be treated as the final production security boundary. For a long-lived deployment, replace the Quick Tunnel with a persistent access-controlled tunnel or authenticated reverse proxy.

---

## Environment variables

See [`.env.example`](../.env.example).

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SEARXNG_URL` | yes | — | Base URL of the SearXNG endpoint. |
| `SEARXNG_AUTH_SECRET` | no | — | Bearer token for an authenticated SearXNG proxy. |
| `SEARXNG_TIMEOUT_MS` | no | `8000` | Request timeout for SearXNG calls. |
| `LUMEN_RATE_LIMIT_PER_MINUTE` | no | `60` | In-memory rate limit per client. |
| `LUMEN_CACHE_TTL_MS` | no | `60000` | In-memory search cache TTL. |

Never put secrets in `NEXT_PUBLIC_*` variables.

---

## Verification checklist

After deployment:

- [ ] Homepage loads.
- [ ] A normal search returns results.
- [ ] Category, time, language, and safe-search filters work.
- [ ] Pagination works.
- [ ] Dark mode works.
- [ ] Settings persist across reload.
- [ ] SearXNG credentials are not exposed to the browser.
- [ ] The deployed site remains `noindex, nofollow`.
- [ ] The Fedora host is online whenever it is the SearXNG backend.
