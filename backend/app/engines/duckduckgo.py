"""Experimental, opt-in DuckDuckGo HTML first-page adapter.

No official API or bypass mechanisms. Stop on challenges/blocks and respect
provider policy. HTML structure can change at any time.
"""

from __future__ import annotations

import os
from html.parser import HTMLParser
from typing import ClassVar
from urllib.parse import parse_qs, urljoin, urlsplit

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
        self.field_depth = 0
        self.hidden = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            self.hidden += 1
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
        if self.field is not None and tag not in {"br", "img", "hr", "input", "meta", "link"}:
            self.field_depth += 1
        if tag == "a" and "result__a" in classes:
            self.current["url"] = attributes.get("href") or ""
            self.field = "title"
            self.field_depth = 1
        elif "result__snippet" in classes:
            self.field = "snippet"
            self.field_depth = 1

    def handle_data(self, data: str) -> None:
        if self.current is not None and self.field and not self.hidden:
            parts = self.current[self.field]
            if isinstance(parts, list):
                parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            self.hidden = max(0, self.hidden - 1)
        if self.field is not None:
            self.field_depth -= 1
            if self.field_depth <= 0:
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
    try:
        url = urljoin("https://html.duckduckgo.com/", href)
        parsed = urlsplit(url)
    except ValueError:
        return None
    if parsed.hostname in {
        "duckduckgo.com",
        "www.duckduckgo.com",
        "html.duckduckgo.com",
    } and parsed.path.startswith("/l/"):
        candidate = parse_qs(parsed.query).get("uddg", [])
        if not candidate:
            return None
        url = candidate[0]
    return safe_url(url)


class DuckDuckGo(SearchEngine):
    id = "duckduckgo"
    name = "DuckDuckGo HTML (experimental)"
    categories: ClassVar[list[str]] = ["general"]
    filters: ClassVar[list[str]] = ["time_range"]
    rate_limit_per_minute = 6
    pagination = False
    interface_type = "experimental_html"
    timeout_seconds = 8.0
    access_note = "Unofficial HTML; disabled by default. Check permitted use before enabling."

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
            "POST",
            "https://html.duckduckgo.com/html/",
            data=form,
            follow_redirects=False,
            headers={"Accept": "text/html"},
        ) as response:
            if response.status_code == 429:
                raise AdapterError(
                    "DuckDuckGo rate limited this instance",
                    retry_after=retry_after(response.headers.get("Retry-After"), 120),
                )
            if response.status_code == 202:
                raise AdapterError(
                    "DuckDuckGo presented a challenge or deferred access",
                    retry_after=600,
                    status="unavailable",
                )
            if response.status_code == 403:
                raise AdapterError(
                    "DuckDuckGo denied automated access", retry_after=600, status="unavailable"
                )
            if response.status_code != 200:
                raise AdapterError("DuckDuckGo HTML search unavailable", status="unavailable")
            body = bytearray()
            async for chunk in response.aiter_bytes():
                if len(body) + len(chunk) > 2_000_000:
                    raise AdapterError("DuckDuckGo response exceeded size limit")
                body.extend(chunk)
        page = body.decode("utf-8", errors="replace")
        if any(
            marker in page.lower()
            for marker in (
                "challenge-form",
                "anomaly-modal",
                "anomaly.js",
                "bots use duckduckgo",
            )
        ):
            raise AdapterError(
                "DuckDuckGo presented a challenge", retry_after=600, status="unavailable"
            )
        parser = _ResultParser()
        parser.feed(page)
        if not parser.results:
            if "no-results" in page.lower() or "result--no-result" in page.lower():
                return []
            raise AdapterError(
                "DuckDuckGo HTML structure changed or access was blocked", status="unavailable"
            )
        found: list[SearchResult] = []
        seen: set[str] = set()
        for title, href, snippet in parser.results:
            url = _destination(href)
            if url:
                result = self.result(title, url, snippet)
                if result and result.url not in seen:
                    seen.add(result.url)
                    found.append(result)
                    if len(found) >= query.limit:
                        break
        if not found:
            raise AdapterError("DuckDuckGo returned no valid result links", status="unavailable")
        return found
