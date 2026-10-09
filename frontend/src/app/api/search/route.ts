import { NextRequest, NextResponse } from "next/server";
/** Compatibility entrypoint; all searches now use the owned backend. */
export function GET(request: NextRequest) {
  const target = new URL("/api/v1/search", request.url);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 307);
}
