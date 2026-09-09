# Troubleshooting

Common failures, ordered roughly by how often they happen.

---

## "SearXNG is not configured."

**Cause:** `SEARXNG_URL` is not set in the environment.

**Fix:**

1. Check `.env` (or your Vercel env vars) has `SEARXNG_URL=http://...`.
2. Restart the dev server. Next.js loads `.env` at boot — editing it doesn't trigger a reload.

---

## "Couldn't reach SearXNG."

**Cause:** SearXNG isn't running, or the URL is wrong, or there's a network issue.

**Fix:**

1. Verify SearXNG is up: `curl "$SEARXNG_URL/search?q=test&format=json"`. You should see JSON.
2. Verify the URL exactly matches what's in `.env`. Trailing slashes are stripped automatically.
3. If you're using `localhost` and SearXNG is bound to `127.0.0.1`, try switching to `127.0.0.1` explicitly. Node's `fetch` sometimes resolves `localhost` to IPv6 `::1`.
4. Check `bun run searxng:logs` for SearXNG-side errors.

---

## "SearXNG is unavailable right now. (HTTP 500)"

**Cause:** SearXNG returned a 5xx error. Usually one of:

- An engine is misconfigured or rate-limiting SearXNG.
- SearXNG itself crashed during the request.
- The SearXNG instance is overloaded.

**Fix:**

1. Check `bun run searxng:logs`.
2. Disable the offending engine in `docker/searxng-data/settings.yml`.
3. Restart SearXNG.

The error is `retryable: true`, so the user can press the search button again immediately.

---

## "SearXNG returned a malformed response."

**Cause:** The JSON returned by SearXNG didn't parse, or wasn't an object, or contained an `error` field.

**Fix:**

1. Hit SearXNG directly and inspect the response:
   ```bash
   curl -v "$SEARXNG_URL/search?q=test&format=json"
   ```
2. If the response is HTML, SearXNG isn't returning JSON — check that `settings.yml` has `formats: [html, json]` and restart the container.
3. If the response contains an `error` field, SearXNG is rejecting the request — usually because of an unknown category or unsupported parameter.

---

## "SearXNG took too long to respond."

**Cause:** The request exceeded the timeout (default 8s).

**Fix:**

1. Increase `SEARXNG_TIMEOUT_MS` in `.env`.
2. Disable slow engines in `docker/searxng-data/settings.yml`.
3. Check that the host running SearXNG has enough CPU/memory.

---

## "Too many searches. Try again in a moment."

**Cause:** The in-memory rate limiter kicked in. Default is 60 searches per minute per client IP.

**Fix:**

1. Wait a minute — the limit resets every 60s.
2. To raise the limit, set `LUMEN_RATE_LIMIT_PER_MINUTE` in `.env`.

**Note:** On Vercel, each serverless instance has its own limiter, so the effective limit may be higher than configured. This is acceptable for a household app.

---

## Vercel can't reach SearXNG

**Symptom:** Local development works, but the deployed Vercel app shows "Couldn't reach SearXNG."

**Cause:** Either SearXNG is on a private LAN address (Vercel can't reach it), or the public SearXNG URL is wrong.

**Fix:**

1. Verify `SEARXNG_URL` in the Vercel dashboard is a public URL.
2. From your local machine, hit `curl "$SEARXNG_URL/search?q=test&format=json"`. If you can't reach it from outside your LAN, neither can Vercel.
3. If SearXNG is on a home machine, expose it via Cloudflare Tunnel or move it to a public host. See [`docs/deployment.md`](deployment.md) Mode B.

---

## CORS errors

**Symptom:** The browser console shows CORS errors when Lumen tries to call `/api/search`.

**Cause:** You're hitting a different origin than the one the app is served from.

**Fix:** Lumen's API is same-origin — the browser calls `/api/search` (relative URL). If you're seeing CORS errors, you've somehow configured the app to call an absolute URL. Don't do that. The API must be served from the same origin as the frontend.

---

## No results for a query

**Symptom:** The UI shows "No results for X" even though you expected results.

**Cause:** Either SearXNG genuinely has no results, or every engine failed.

**Fix:**

1. Hit SearXNG directly: `curl "$SEARXNG_URL/search?q=X&format=json"`.
2. If SearXNG returns results but Lumen shows none, file a bug — the normalization logic may be too strict.
3. If SearXNG itself returns no results, the query may be too specific. Try a broader query or a different category.

---

## Docker container unhealthy

**Symptom:** `bun run searxng:up` exits, or `docker ps` shows the container as unhealthy.

**Fix:**

1. Check the logs: `bun run searxng:logs`.
2. Common causes:
   - `settings.yml` is missing or has a syntax error.
   - `secret_key` is still the placeholder.
   - Port 8080 is already in use on the host.
3. Wipe the persistent volume and re-copy the template:
   ```bash
   bun run searxng:down
   rm -rf docker/searxng-data
   mkdir -p docker/searxng-data
   cp docker/searxng.settings.yml docker/searxng-data/settings.yml
   sed -i "s/REPLACE_WITH_A_LONG_RANDOM_STRING/$(openssl rand -hex 32)/" \
     docker/searxng-data/settings.yml
   bun run searxng:up
   ```

---

## Search engines blocked / rate-limited

**Symptom:** SearXNG logs show `[WARNING] engine X is rate-limited` or similar.

**Cause:** Individual upstream engines (Google, Bing) sometimes rate-limit SearXNG, especially if you search a lot from one IP.

**Fix:**

1. Wait. The rate limit usually clears in minutes to hours.
2. Disable the affected engine in `docker/searxng-data/settings.yml` and rely on others.
3. Use SearXNG's built-in image proxy and disabled autocomplete to reduce request volume.

---

## Environment variables missing

**Symptom:** The app starts but search doesn't work, and `.env` looks correct.

**Cause:** Next.js loads `.env` at boot. Editing `.env` while the dev server is running doesn't reload it.

**Fix:** Restart the dev server.

```bash
# Stop the running dev server (Ctrl+C if in foreground, or kill the PID)
bun run dev
```

On Vercel, env vars are read at deploy time. After changing them in the dashboard, trigger a redeploy.

---

## Still stuck?

1. Read [`docs/architecture.md`](architecture.md) to understand how the pieces fit together.
2. Check the dev server log (`dev.log`) for stack traces.
3. Check the SearXNG log (`bun run searxng:logs`) for upstream errors.
4. File an issue with both logs attached.
