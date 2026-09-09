import { NextResponse, type NextRequest } from "next/server";
import { getSearchService } from "@/lib/search/service";
import {
  coerceCategory,
  coerceLanguage,
  coercePage,
  coerceSafeSearch,
  coerceTimeRange,
  normalizeQuery,
} from "@/lib/validation/search";
import type { SearchOptions } from "@/types/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hash a string into a short opaque identifier. We don't need crypto
 * strength — the goal is just to avoid logging raw IPs while still
 * giving the rate limiter a stable key per client.
 */
function hashKey(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return "c" + (h >>> 0).toString(36);
}

function getClientKey(req: NextRequest): string {
  // Prefer the Forwarded-for leftmost IP (client). Fall back to a
  // constant so the limiter still works in environments without an IP.
  const ff = req.headers.get("x-forwarded-for");
  if (ff) {
    const first = ff.split(",")[0]?.trim();
    if (first) return hashKey(first);
  }
  return hashKey("unknown");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;

  const query = normalizeQuery(params.get("q"));
  if (!query) {
    return NextResponse.json(
      {
        error: {
          message: "Search query is empty.",
          code: "QUERY_INVALID",
          retryable: false,
        },
      },
      { status: 400 },
    );
  }

  const options: SearchOptions = {
    query,
    category: coerceCategory(params.get("category")),
    timeRange: coerceTimeRange(params.get("time")),
    language: coerceLanguage(params.get("language")),
    safeSearch: coerceSafeSearch(params.get("safe")),
    page: coercePage(params.get("page")),
  };

  const service = getSearchService();
  const outcome = await service.search(options, getClientKey(req));

  if (!outcome.ok) {
    // Map error codes to HTTP statuses conservatively. We never leak
    // internal details — the user only ever sees a friendly message.
    const status =
      outcome.error.code === "QUERY_INVALID"
        ? 400
        : outcome.error.code === "RATE_LIMITED"
          ? 429
          : outcome.error.code === "PROVIDER_TIMEOUT" ||
              outcome.error.code === "PROVIDER_UNAVAILABLE"
            ? 503
            : 502;
    return NextResponse.json({ error: outcome.error }, { status });
  }

  return NextResponse.json(outcome.response, {
    status: 200,
    headers: {
      // Search responses are user-specific (filters, language, …) and
      // must always be fresh; tell every layer not to cache.
      "Cache-Control": "private, no-store",
    },
  });
}
