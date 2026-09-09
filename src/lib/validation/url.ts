/**
 * URL helpers — safe parsing and display formatting.
 *
 * Treat all URLs coming from external sources (SearXNG, user input) as
 * untrusted. The functions here never throw; they return null on
 * failure so callers can decide how to degrade.
 */

const BLOCKED_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "file:",
  "vbscript:",
]);

/**
 * Parse a string into a URL object. Returns null if the URL is invalid
 * or uses a blocked protocol.
 */
export function parseUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // SearXNG sometimes returns protocol-relative URLs like
    // "//example.com/path" — these throw without a base URL. Re-try
    // with an explicit https: prefix.
    if (raw.startsWith("//")) {
      try {
        url = new URL("https:" + raw);
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }
  const proto = url.protocol.toLowerCase();
  if (proto !== "http:" && proto !== "https:") return null;
  return url;
}

/**
 * Extract a display domain from a URL. Strips leading "www." but keeps
 * other subdomains. Returns null if the URL is invalid.
 *
 * Examples:
 *   https://www.example.com/path    -> "example.com"
 *   https://news.example.com/path   -> "news.example.com"
 *   https://example.co.uk/path      -> "example.co.uk"
 */
export function extractDomain(raw: unknown): string | null {
  const url = parseUrl(raw);
  if (!url) return null;
  let host = url.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  return host;
}

/**
 * Truncate a URL for display. Preserves the most meaningful parts
 * (scheme, host, first path segment) and elides the rest with an
 * ellipsis. Never throws.
 */
export function truncateUrlForDisplay(raw: unknown, max = 80): string {
  const url = parseUrl(raw);
  if (!url) return typeof raw === "string" ? raw : "";
  const display = url.toString();
  if (display.length <= max) return display;
  // Keep the origin and as much path as fits.
  const origin = url.origin;
  if (origin.length >= max - 1) return origin.slice(0, max - 1) + "…";
  const remaining = max - origin.length - 1;
  return origin + url.pathname.slice(0, remaining) + "…";
}

/**
 * Returns true if `raw` looks like a URL the user might want to visit
 * directly (e.g. "example.com", "https://example.com"). Used by the
 * search box to decide whether to navigate vs. search.
 */
export function looksLikeUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  if (/\s/.test(trimmed)) return false;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return parseUrl(trimmed) !== null;
  }
  // bare domain: must contain a dot, no spaces, and a TLD-like suffix.
  if (!trimmed.includes(".")) return false;
  if (/[^a-zA-Z0-9.\-_:/]/.test(trimmed)) return false;
  return parseUrl("https://" + trimmed) !== null;
}
