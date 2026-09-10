import { handleSearXNGProxyRequest } from "@/lib/searxng/proxy";

const HOST = "127.0.0.1";
const PORT = 8787;
const authSecret = process.env.SEARXNG_AUTH_SECRET;

if (!authSecret) {
  console.error("SEARXNG_AUTH_SECRET is required.");
  process.exit(1);
}

const timeoutMs = Number.parseInt(
  process.env.SEARXNG_TIMEOUT_MS ?? "8000",
  10,
);

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error("SEARXNG_TIMEOUT_MS must be a positive integer.");
  process.exit(1);
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,

  async fetch(request) {
    return handleSearXNGProxyRequest(request, {
      authSecret,
      timeoutMs,
    });
  },
});

console.log(`SearXNG proxy listening on http://${HOST}:${server.port}`);
