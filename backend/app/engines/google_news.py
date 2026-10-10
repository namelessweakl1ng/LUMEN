"""Keyless Google News RSS adapter. This is NEWS, not Google Web Search."""

from __future__ import annotations

import os
from datetime import UTC
from email.utils import parsedate_to_datetime
from typing import ClassVar
from xml.etree.ElementTree import ParseError

import httpx
from defusedxml.common import DefusedXmlException
from defusedxml.ElementTree import fromstring

from app.models import SearchQuery, SearchResult

from .base import AdapterError, SearchEngine, clean, retry_after, safe_url


class GoogleNews(SearchEngine):
    id = "google_news"
    name = "Google News RSS"
    categories: ClassVar[list[str]] = ["news"]
    filters: ClassVar[list[str]] = []  # Fixed en-US edition; no pagination.
    rate_limit_per_minute = 10
    pagination = False
    interface_type = "rss"
    timeout_seconds = 8.0
    access_note = (
        "Google News RSS; disabled by default because current robots instructions restrict access. "
        "Enable only with documented provider permission; fixed US English edition."
    )

    @property
    def enabled(self) -> bool:  # type: ignore[override]
        return os.getenv("LUMEN_ENABLE_GOOGLE_NEWS_RSS") == "1"

    async def search(self, query: SearchQuery, client: httpx.AsyncClient) -> list[SearchResult]:
        if query.page != 1:
            raise AdapterError("Google News RSS pagination is not supported", status="unavailable")
        params = {"q": query.q, "hl": "en-US", "gl": "US", "ceid": "US:en"}
        async with client.stream(
            "GET",
            "https://news.google.com/rss/search",
            params=params,
            follow_redirects=False,
            headers={"Accept": "application/rss+xml, application/xml"},
        ) as response:
            if response.status_code == 429:
                raise AdapterError(
                    "Google News rate limited this instance",
                    retry_after=retry_after(response.headers.get("Retry-After"), 120),
                )
            if response.status_code != 200:
                raise AdapterError("Google News feed unavailable", status="unavailable")
            body = bytearray()
            async for chunk in response.aiter_bytes():
                if len(body) + len(chunk) > 2_000_000:
                    raise AdapterError("Google News feed exceeded size limit")
                body.extend(chunk)
        try:
            root = fromstring(body, forbid_dtd=True)
        except (ParseError, DefusedXmlException) as exc:
            raise AdapterError("Invalid Google News RSS response") from exc
        channel = root.find("channel") if root.tag == "rss" else None
        if channel is None:
            raise AdapterError("Unexpected Google News feed format")
        results: list[SearchResult] = []
        seen: set[str] = set()
        for item in channel.findall("item"):
            date = None
            raw_date = item.findtext("pubDate")
            if raw_date:
                try:
                    date = parsedate_to_datetime(raw_date)
                    if date.tzinfo is None:
                        date = date.replace(tzinfo=UTC)
                    date = date.astimezone(UTC)
                except (TypeError, ValueError, OverflowError):
                    pass
            source = item.find("source")
            publisher = clean(item.findtext("source"), limit=120)
            title = clean(item.findtext("title"), limit=300)
            if publisher and title.endswith(" - " + publisher):
                title = title[: -(len(publisher) + 3)]
            result = self.result(
                title,
                item.findtext("link"),
                item.findtext("description") or "",
                published_at=date,
                metadata={
                    "publisher": publisher,
                    "publisher_url": safe_url(source.get("url")) if source is not None else None,
                },
            )
            if result and result.url not in seen:
                seen.add(result.url)
                results.append(result)
                if len(results) >= query.limit:
                    break
        return results
