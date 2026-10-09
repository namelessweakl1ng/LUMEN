"""Experimental, opt-in DuckDuckGo HTML first-page adapter.

No official API or bypass mechanisms. Stop on challenges/blocks and respect
provider policy. HTML structure can change at any time.
"""

from __future__ import annotations

import os
from html.parser import HTMLParser
from typing import ClassVar
from urllib.parse import parse_qs, unquote, urljoin, urlsplit

import httpx

from app.models import SearchQuery, SearchResult

from .base import AdapterError, SearchEngine, retry_after, safe_url


class _ResultParser(HTMLParser):
    """Extract only ordinary result blocks; do not process sponsored blocks."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.results: list[tuple[str, str, str]] = []
        self.current: dict[str, object] | None = None
        self.depth = 0
        self.field: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        classes = set((attributes.get("class") or "").split())
        if tag == "div":
            if self.current is not None:
                self.depth += 1
            elif "web-result" in classes and "result--ad" not in classes:
                self.current = {"url": "", "title": [], "snippet": []}
                self.depth = 1
        if self.current is None:
            return
        if tag == "a" and "result__a" in classes:
            self.current["url"] = attributes.get("href") or ""
            self.field = "title"
        elif tag == "a" and "result__snippet" in classes:
            self.field = "snippet"

    def handle_data(self, data: str) -> None:
        if self.current is not None and self.field:
            parts = self.current[self.field]
            if isinstance(parts, list):
                parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a":
            self.field = None
        if tag == "div" and self.current is not None:
            self.depth -= 1
            if self.depth == 0:
                parts_title = self.current["title"]
                parts_snippet = self.current["snippet"]
                title = " ".join(parts_title) if isinstance(parts_title, list) else ""
                snippet = " ".join(parts_snippet) if isinstance(parts_snippet, list) else ""
                self.results.append((title.strip(), str(self.current["url"]), snippet.strip()))
                self.current = None
                self.field = None


def _destination(href: str) -> str | None:
    """Resolve a public result link, including DDG's ordinary outbound redirect URL."""
    url = urljoin("https://html.duckduckgo.com/", href)
    parsed = urlsplit(url)
    if parsed.hostname in {"duckduckgo.com", "www.duckduckgo.com", "html.duckduckgo.com"} and parsed.path.startswith("/l/"):
        candidate = parse_qs(parsed.query).get("uddg", [])
        if not candidate:
            return None
        url = unquote(candidate[0])
    return safe_url(url)


class DuckDuckGo(SearchEngine):
    id = "duckduckgo"
    name = "DuckDuckGo HTML (experimental)"
    categories: ClassVar[list[str]] = ["general"]
    filters: ClassVar[list[str]] = ["time_range"]
    rate_limit_per_minute = 6

    @property
    def enabled(self) -> bool:  # type: ignore[override]
        # Explicit opt-in because this is an unofficial interface.
        return os.getenv("LUMEN_ENABLE_DDG_HTML") == "1"

    async def search(self, query: SearchQuery, client: httpx.AsyncClient) -> list[SearchResult]:
        if query.page != 1:
            raise AdapterError("DuckDuckGo HTML pagination is not supported", status="unavailable")
        form = {"q": query.q, "b": ""}
        date = {"day": "d", "week": "w", "month": "m", "year": "y"}.get(query.time_range)
        if date:
            form["df"] = date
        # No forged browser fingerprint and no challenge-solving code.
        async with client.stream(
            "POST", "https://html.duckduckgo.com/html/", data=form, follow_redirects=False,
            headers={"Accept": "text/html"},
        ) as response:
            if response.status_code == 429:
                raise AdapterError(
                    "DuckDuckGo rate limited this instance",
                    retry_after=retry_after(response.headers.get("Retry-After"), 120),
                )
            if response.status_code == 403:
                raise AdapterError("DuckDuckGo denied automated access", retry_after=600,
                                   status="unavailable")
            if response.status_code != 200:
                raise AdapterError("DuckDuckGo HTML search unavailable", status="unavailable")
            body = bytearray()
            async for chunk in response.aiter_bytes():
                if len(body) + len(chunk) > 2_000_000:
                    raise AdapterError("DuckDuckGo response exceeded size limit")
                body.extend(chunk)
        page = body.decode("utf-8", errors="replace")
        if "challenge-form" in page or "anomaly-modal" in page:
            raise AdapterError("DuckDuckGo presented a challenge", retry_after=600,
                               status="unavailable")
        parser = _ResultParser()
        parser.feed(page)
        if not parser.results:
            if "no results" in page.lower():
                return []
            raise AdapterError("DuckDuckGo HTML structure changed or access was blocked",
                               status="unavailable")
        found: list[SearchResult] = []
        for title, href, snippet in parser.results[: query.limit]:
            url = _destination(href)
            if url:
                result = self.result(title, url, snippet)
                if result:
                    found.append(result)
        return found
