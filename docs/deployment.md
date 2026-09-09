# Deployment

Lumen supports three deployment modes. Pick the one that matches how private you want the setup to be.

| Mode | Next.js | SearXNG | Privacy | Cost | Notes |
| --- | --- | --- | --- | --- | --- |
| A | Home machine | Home machine (Docker) | Fully private | ₹0 (electricity) | Best for total privacy. |
| B | Vercel (free) | Public host (VPS, tunnel, free container host) | Search queries transit Vercel + SearXNG host | ₹0 | Most convenient for remote access. |
| C | Vercel | Private LAN SearXNG | — | — | **Does not work.** Vercel can't reach LAN addresses. |

---

## Mode A — All local

Run both pieces on a home machine (a Raspberry Pi, an old laptop, a home server).

### Steps

1. **Install prerequisites** on the home machine: Bun/Node and Docker.
2. **Clone the repo** and `bun install`.
3. **Start SearXNG** (see [`searxng.md`](searxng.md)).
4. **Set `.env`** with `SEARXNG_URL=http://localhost:8080`.
5. **Run the production build**:
   ```bash
   bun run build
   bun run start
   ```
6. **Make it reachable from other devices** on your LAN:
   - The Next.js server listens on port 3000 by default.
   - Other devices on the same Wi-Fi can reach it at `http://<machine-ip>:3000`.
   - Optionally put it behind a reverse proxy (Caddy, nginx) for HTTPS via a self-signed cert or Let's Encrypt with a custom domain.

### Notes

- This is the most private setup. No traffic leaves your LAN.
- The browser URL bar will say `http://<machine-ip>:3000` — no DNS, no TLS by default.
- For phone access, the phone must be on the same Wi-Fi.

---

## Mode B — Vercel + public SearXNG

Deploy Next.js to Vercel's free tier. Run SearXNG on a host that Vercel can reach.

### Step 1 — Deploy Next.js to Vercel

**Via Vercel Git integration:**

1. Push the repo to GitHub/GitLab/Bitbucket.
2. Go to <https://vercel.com/new> and import the repo.
3. Vercel auto-detects Next.js. Use the default build settings.
4. Add the environment variable `SEARXNG_URL` in the Vercel dashboard (Project → Settings → Environment Variables). Set it to your SearXNG URL (see below).
5. Deploy. Vercel gives you a URL like `https://lumen-<your-name>.vercel.app`.

**Via Vercel CLI:**

```bash
bun add -g vercel
vercel          # follow the prompts
vercel env add SEARXNG_URL   # paste your SearXNG URL when prompted
vercel --prod
```

### Step 2 — Run SearXNG somewhere Vercel can reach

Options, roughly in order of cost:

- **Free container host** (e.g. Fly.io, Render, Koyeb). Run the SearXNG Docker image. Set the public URL as `SEARXNG_URL`.
- **Cheap VPS** (Hetzner, DigitalOcean, etc. — ₹200–500/mo). Run Docker on the VPS. Put SearXNG behind an authenticated reverse proxy (Caddy + basic auth, or Cloudflare Access).
- **Home server + Cloudflare Tunnel** (free). Run SearXNG at home, expose it via `cloudflared`. The tunnel gives you a public `https://*.trycloudflare.com` URL. Set that as `SEARXNG_URL`.

**Critical:** put SearXNG behind authentication in this mode. Otherwise anyone who finds the URL can use your SearXNG instance.

### Step 3 — Verify

1. Visit your Vercel URL.
2. Search for something. You should see results.
3. If you see "Couldn't reach SearXNG" — your `SEARXNG_URL` is wrong, or SearXNG is unreachable from Vercel's network.

---

## Mode C — Vercel + private LAN SearXNG (does NOT work)

This is listed only to document the limitation. Vercel's serverless functions run in Vercel's network. They cannot reach addresses like `192.168.1.10:8080` because those are private to your LAN.

If you want Vercel + a home SearXNG, use Mode B with Cloudflare Tunnel (or similar) to expose SearXNG publicly.

---

## Environment variables

See [`.env.example`](../.env.example) for the full list. In production, set these via your hosting provider's dashboard (Vercel → Settings → Environment Variables), not via a `.env` file.

| Variable | Required in prod? | Notes |
| --- | --- | --- |
| `SEARXNG_URL` | yes | Must be reachable from the Next.js server. |
| `SEARXNG_AUTH_SECRET` | no | Set if SearXNG is behind a bearer-token proxy. |
| `SEARXNG_TIMEOUT_MS` | no | Default 8000. Increase if your SearXNG is slow. |
| `LUMEN_RATE_LIMIT_PER_MINUTE` | no | Default 60. Lower for stricter limits. |
| `LUMEN_CACHE_TTL_MS` | no | Default 60000. |

**Never** put secrets in `NEXT_PUBLIC_*` variables — those are visible to the browser. Lumen does not use any `NEXT_PUBLIC_*` variables.

---

## Verifying the deployment

After deploying, run through this checklist:

- [ ] Homepage loads at the deployed URL.
- [ ] Typing a query and pressing Enter shows results.
- [ ] Changing category / time / language / safe search updates the URL and re-searches.
- [ ] Pagination works (Next button shows when there are more results).
- [ ] Dark mode toggle works.
- [ ] Settings persist across reload (localStorage).
- [ ] No secrets appear in the browser's network tab.
- [ ] `https://<your-vercel-url>.vercel.app/` returns 200 with `robots: noindex, nofollow`.
