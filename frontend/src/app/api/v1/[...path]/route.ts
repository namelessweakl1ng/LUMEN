import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const paths = new Set([
  "health",
  "search",
  "engines",
  "categories",
  "search/compare",
]);
async function boundedText(
  body: ReadableStream<Uint8Array> | null,
  max: number,
): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new RangeError("Body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}
async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = (await context.params).path.join("/");
  if (
    !paths.has(path) ||
    (request.method === "POST"
      ? path !== "search/compare"
      : path === "search/compare")
  )
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const base = new URL(
      process.env.LUMEN_BACKEND_URL || "http://127.0.0.1:8000",
    );
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password
    )
      throw new Error("Invalid backend URL");
    const target = new URL(`/api/v1/${path}`, base);
    target.search = request.nextUrl.search;
    const body =
      request.method === "POST"
        ? await boundedText(request.body, 65536)
        : undefined;
    const response = await fetch(target, {
      method: request.method,
      headers: {
        Accept: "application/json",
        ...(request.method === "POST"
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
      cache: "no-store",
      redirect: "error",
    });
    return new NextResponse(await boundedText(response.body, 8 * 1024 * 1024), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        ...(response.headers.has("Retry-After")
          ? { "Retry-After": response.headers.get("Retry-After")! }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof RangeError && request.method === "POST")
      return NextResponse.json(
        { error: "Comparison request too large" },
        { status: 413 },
      );
    return NextResponse.json(
      { error: "Search service unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const GET = forward;
export const POST = forward;
