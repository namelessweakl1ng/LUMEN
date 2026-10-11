"""Public arXiv Atom API; one request at a time and no faster than every three seconds.

The bundled deployment runs one backend process. Operators running multiple backend
instances must coordinate this provider limit across those instances.
"""

from __future__ import annotations

import asyncio
import re
import time
from datetime import UTC
from typing import ClassVar
from urllib.parse import urlsplit

import httpx
from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException

from app.models import SearchQuery, SearchResult

from .base import AdapterError, SearchEngine, clean, parse_date, retry_after

ATOM = "{http://www.w3.org/2005/Atom}"


class Arxiv(SearchEngine):
    id = "arxiv"
    name = "arXiv research papers"
    categories: ClassVar[list[str]] = ["science"]
    rate_limit_per_minute = 20
    min_request_interval_seconds = 3.0
    interface_type = "public_api"
    access_note = (
        "Public arXiv API. At most one request every three seconds and one connection "
        "across the deployment; additional replicas require shared coordination."
    )
    timeout_seconds = 8.0

    def __init__(self) -> None:
        self._request_lock = asyncio.Lock()
        self._last_start = float("-inf")

    async def search(self, query: SearchQuery, client: httpx.AsyncClient) -> list[SearchResult]:
        params: dict[str, str | int] = {
            "search_query": f'all:"{query.q.replace(chr(34), "").strip()}"',
            "start": (query.page - 1) * query.limit,
            "max_results": query.limit,
            "sortBy": "relevance" if query.ranking != "recency" else "submittedDate",
            "sortOrder": "descending",
        }
        async with self._request_lock:
            await asyncio.sleep(max(0, self._last_start + 3 - time.monotonic()))
            self._last_start = time.monotonic()
            try:
                async with client.stream(
                    "GET", "https://export.arxiv.org/api/query", params=params, follow_redirects=False
                ) as response:
                    chunks = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(chunks) + len(chunk) > 2_000_000:
                            raise AdapterError("Source response exceeded size limit")
                        chunks.extend(chunk)
            except httpx.TimeoutException:
                raise
            except httpx.HTTPError as exc:
                raise AdapterError("Source request failed") from exc
        if response.status_code in (429, 503):
            raise AdapterError(
                "Source rate limited" if response.status_code == 429 else "Source unavailable",
                retry_after(response.headers.get("Retry-After"), 60),
                status="rate_limited" if response.status_code == 429 else "unavailable",
            )
        if response.status_code == 403:
            raise AdapterError("Source access denied", 600, status="unavailable")
        if response.status_code >= 300:
            raise AdapterError(f"Source returned HTTP {response.status_code}")
        try:
            root = ElementTree.fromstring(bytes(chunks))
        except (ElementTree.ParseError, DefusedXmlException, ValueError) as exc:
            raise AdapterError("Source returned invalid Atom XML") from exc
        if root.tag != ATOM + "feed":
            raise AdapterError("Source returned unexpected XML")
        results: list[SearchResult] = []
        for entry in root.findall(ATOM + "entry")[: query.limit]:
            identifier = entry.findtext(ATOM + "id") or ""
            parsed = urlsplit(identifier)
            if parsed.hostname not in {"arxiv.org", "www.arxiv.org", "export.arxiv.org"}:
                continue
            if not parsed.path.startswith("/abs/") or not parsed.path.removeprefix("/abs/"):
                continue
            paper_id = parsed.path.removeprefix("/abs/")
            if not re.fullmatch(r"[A-Za-z0-9._/-]{1,80}", paper_id) or ".." in paper_id:
                continue
            published = parse_date(entry.findtext(ATOM + "published"))
            if published:
                published = published.astimezone(UTC)
            authors = [
                clean(author.findtext(ATOM + "name"), 120)
                for author in entry.findall(ATOM + "author")[:20]
            ]
            result = self.result(
                entry.findtext(ATOM + "title"),
                f"https://arxiv.org/abs/{paper_id}",
                entry.findtext(ATOM + "summary"),
                published_at=published,
                metadata={"authors": [author for author in authors if author], "arxiv_id": paper_id},
            )
            if result:
                results.append(result)
        return results
