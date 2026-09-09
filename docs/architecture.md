# Architecture

## Overview

Lumen is a Next.js 16 application (App Router, TypeScript) that talks to a SearXNG instance via a server-side API. The browser never contacts SearXNG directly.

```
┌────────────┐     ┌─────────────────────────┐     ┌──────────┐     ┌──────────────┐
│  Browser   │ ──> │  Next.js (Vercel/local) │ ──> │ SearXNG  │ ──> │ Search       │
│  (React)   │     │  /api/search (server)   │     │ (Docker) │     │ engines      │
└────────────┘     └─────────────────────────┘     └──────────┘     └──────────────┘
```

## Layers

### 1. Browser → Next.js frontend

The entire UI lives in a single route (`/`) that supports both the landing view and the search-results view via URL query parameters:

- `/` — landing page (search box, keyboard hint)
- `/?q=linux` — search results for "linux"
- `/?q=linux&category=news&time=week&language=en&page=2` — filtered, paginated

The URL is the single source of truth. Every filter change pushes a new URL state; the search hook re-fetches when the URL changes. This makes queries shareable, bookmarkable, and back/forward navigable.

### 2. Frontend → Next.js API

The frontend calls `GET /api/search?q=...&category=...&time=...&language=...&safe=...&page=...` and receives a stable JSON shape:

```ts
interface SearchResponse {
  query: string;
  results: SearchResult[];
  suggestions: string[];
  total?: number;
  page: number;
  category: SearchCategory;
  timing?: number;
  empty: boolean;
}
```

The frontend never sees SearXNG's raw response. This is the **search service abstraction** — see below.

### 3. API → Search service

The API route (`src/app/api/search/route.ts`) is a thin handler that:

1. Validates and normalizes query parameters.
2. Hashes the client IP into an opaque key.
3. Calls `SearchService.search(options, clientKey)`.
4. Maps the outcome to an HTTP response.

The `SearchService` (`src/lib/search/service.ts`) wraps the provider with:

- **In-memory rate limiting** (fixed-window per minute per client).
- **In-memory TTL cache** (60s by default; only successes cached).
- **Process-wide singleton** so the cache and limiter survive between requests on a long-running server.

### 4. Search service → Provider

The service depends on a `SearchProvider` interface:

```ts
interface SearchProvider {
  readonly name: string;
  readonly configured: boolean;
  search(options: SearchOptions): Promise<SearchOutcome>;
}
```

The default (and currently only) implementation is `SearXNGSearchProvider` (`src/lib/searxng/provider.ts`). It:

- Builds the SearXNG `/search?format=json&...` URL.
- Calls SearXNG with `fetch` and a timeout.
- Validates the JSON response shape.
- Normalizes each result into the application-level `SearchResult` type.
- Deduplicates by URL.
- Maps HTTP statuses and network errors to stable error codes.

**To add a new provider** (e.g. a local index), implement `SearchProvider` and pass it to `SearchService` in `getSearchService()`. Nothing else in the codebase needs to change.

## File layout

```
src/
  app/
    layout.tsx          # Root layout: theme provider, fonts, metadata
    page.tsx            # Homepage + search results (URL-driven)
    globals.css         # Lumen visual system
    api/
      search/route.ts   # GET /api/search — the only API endpoint
  components/
    layout/             # Theme provider, theme toggle, wordmark, kbd shortcut hook
    search/             # SearchInput, FilterBar, SettingsPanel, useSearch hook
    results/            # ResultItem, ResultsList, Pagination
  lib/
    search/             # SearchProvider interface, SearchService
    searxng/            # SearXNGSearchProvider
    validation/         # Query, URL, and response validation
    settings/           # Zustand + localStorage settings store
  types/
    search.ts           # Application-level search types
```

## State management

- **URL**: query, category, time, language, safe search, page. The URL is the source of truth.
- **localStorage** (via Zustand `persist`): user preferences (theme, default category, default language, safe search default, open-in-new-tab, show-favicons).
- **Server state**: in-memory cache + rate limiter in the `SearchService` singleton.

No database. No Redis. No accounts.

## Rendering

- The homepage is a Client Component because it uses `useSearchParams`, `useRouter`, and `useKeyboardShortcut`.
- The layout is a Server Component.
- The API route runs on the Node.js runtime (`runtime = "nodejs"`) so it can use `performance.now()` and the AbortController. It is marked `dynamic = "force-dynamic"` so Vercel doesn't try to statically optimize it.
