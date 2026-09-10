const ALLOWED_QUERY_PARAMS = new Set([
  "q",
  "format",
  "categories",
  "pageno",
  "time_range",
  "language",
  "safesearch",
]);

export interface SearXNGProxyOptions {
  authSecret: string;
  upstreamFetch?: typeof fetch;
  upstreamUrl?: string;
  timeoutMs?: number;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export async function handleSearXNGProxyRequest(
  request: Request,
  options: SearXNGProxyOptions,
): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname !== "/search") {
    return jsonResponse(
      { error: "Not found." },
      404,
    );
  }

  if (request.method !== "GET") {
    return jsonResponse(
      { error: "Method not allowed." },
      405,
      { Allow: "GET" },
    );
  }

  const authorization = request.headers.get("Authorization");
  const expectedAuthorization = `Bearer ${options.authSecret}`;

  if (authorization !== expectedAuthorization) {
    return jsonResponse(
      { error: "Unauthorized." },
      401,
      { "WWW-Authenticate": "Bearer" },
    );
  }

  const upstreamUrl = new URL(
    options.upstreamUrl ?? "http://127.0.0.1:8080/search",
  );

  for (const [key, value] of url.searchParams) {
    if (ALLOWED_QUERY_PARAMS.has(key)) {
      upstreamUrl.searchParams.append(key, value);
    }
  }

  const upstreamFetch = options.upstreamFetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstreamResponse = await upstreamFetch(upstreamUrl, {
      method: "GET",
      signal: controller.signal,
    });

    const headers = new Headers();
    const contentType = upstreamResponse.headers.get("Content-Type");

    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return jsonResponse(
        { error: "Upstream request timed out." },
        504,
      );
    }

    return jsonResponse(
      { error: "Upstream request failed." },
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}
