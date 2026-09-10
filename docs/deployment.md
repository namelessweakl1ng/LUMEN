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

### Cloudflare Quick Tunnel testing

For temporary testing on Fedora:

```bash
cloudflared tunnel --url http://localhost:8080
```

Cloudflare will print a temporary `https://*.trycloudflare.com` URL.

Set that URL as `SEARXNG_URL` in Vercel.

Quick Tunnels are intended for testing and development. They are temporary and publicly reachable unless you add an authentication layer. Do not treat a raw Quick Tunnel to SearXNG as a production security boundary.

### Authenticated proxy

For a long-lived remote deployment, put an authenticated reverse proxy or access-controlled tunnel in front of SearXNG.

If the proxy expects:

```http
Authorization: Bearer <token>
```

set:

```dotenv
SEARXNG_AUTH_SECRET=<token>
```

Lumen sends this value server-side. It is never exposed as a `NEXT_PUBLIC_*` variable.

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
