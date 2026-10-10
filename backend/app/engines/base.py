from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import json
import random
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from typing import Any, ClassVar, Literal
from urllib.parse import urlsplit

import httpx

from app.models import SearchQuery, SearchResult


class AdapterError(Exception):
    def __init__(
        self,
        message: str,
        retry_after: float | None = None,
        status: Literal["error", "rate_limited", "unavailable"] | None = None,
    ):
        super().__init__(message)
        self.retry_after = retry_after
        self.status: Literal["error", "rate_limited", "unavailable"] = status or (
            "rate_limited" if retry_after is not None else "error"
        )


class _Text(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden = 0

    def handle_starttag(self, tag: str, attrs: Any) -> None:
        if tag in {"script", "style"}:
            self.hidden += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.parts.append(data)


def clean(value: Any, limit: int = 600) -> str:
    if not isinstance(value, str):
        return ""
    parser = _Text()
    parser.feed(value[:20000])
    return " ".join(" ".join(parser.parts).split())[:limit]


def safe_url(value: Any) -> str | None:
    if not isinstance(value, str) or len(value) > 4096:
        return None
    try:
        parsed = urlsplit(value)
        host = parsed.hostname
        if parsed.scheme not in {"http", "https"} or not host or parsed.username or parsed.password:
            return None
        if any(ord(c) < 33 for c in value) or "\\" in value:
            return None
        if host.lower() == "localhost" or "." not in host:
            return None
        try:
            if not ipaddress.ip_address(host).is_global:
                return None
        except ValueError:
            pass
        _ = parsed.port
    except ValueError:
        return None
    return value


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def parse_date(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        date = datetime.fromisoformat(value)
        return date.replace(tzinfo=UTC) if date.tzinfo is None else date
    except ValueError:
        return None


def retry_after(value: str | None, default: float) -> float:
    if not value:
        return default
    try:
        return max(0, float(value))
    except ValueError:
        try:
            return max(0, (parsedate_to_datetime(value) - datetime.now(UTC)).total_seconds())
        except (ValueError, TypeError, OverflowError):
            return default


class SearchEngine:
    pagination = True
    interface_type = "public_api"
    access_note = "Public unauthenticated interface; provider limits and terms apply."
    timeout_seconds: float | None = None
    requires_auth = False
    configured = True
    enabled = True
    filters: ClassVar[list[str]] = []
    rate_limit_per_minute = 30
    id = ""
    name = ""
    categories: ClassVar[list[str]] = []

    def result(self, title: Any, url: Any, snippet: Any = "", **kwargs: Any) -> SearchResult | None:
        safe = safe_url(url)
        text = clean(title, 300)
        if not safe or not text:
            return None
        thumbnail = kwargs.pop("thumbnail_url", None)
        return SearchResult(
            id=hashlib.sha256(safe.encode()).hexdigest()[:24],
            title=text,
            url=safe,
            domain=urlsplit(safe).hostname or "",
            snippet=clean(snippet),
            category=self.categories[0],
            source_engines=[self.id],
            thumbnail_url=safe_url(thumbnail),
            **kwargs,
        )

    async def get(
        self,
        client: httpx.AsyncClient,
        url: str,
        params: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        # The orchestrator's outer deadline includes both attempts and backoff.
        for attempt in range(2):
            try:
                async with client.stream(
                    "GET", url, params=params, headers=headers, follow_redirects=False
                ) as response:
                    chunks = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(chunks) + len(chunk) > 5_000_000:
                            raise AdapterError("Source response exceeded size limit")
                        chunks.extend(chunk)
            except httpx.TimeoutException:
                raise
            except httpx.ConnectError as exc:
                if attempt == 0:
                    await asyncio.sleep(0.1 + random.uniform(0, 0.05))
                    continue
                raise AdapterError("Source request failed") from exc
            except httpx.HTTPError as exc:
                raise AdapterError("Source request failed") from exc
            if response.status_code == 429:
                raise AdapterError(
                    "Source rate limited", retry_after(response.headers.get("retry-after"), 60)
                )
            if response.status_code == 503 and response.headers.get("retry-after"):
                raise AdapterError(
                    "Source temporarily unavailable",
                    retry_after(response.headers.get("retry-after"), 60),
                    status="unavailable",
                )
            if response.status_code in {502, 503, 504} and attempt == 0:
                await asyncio.sleep(0.1 + random.uniform(0, 0.05))
                continue
            break
        if response.status_code >= 300:
            raise AdapterError(f"Source returned HTTP {response.status_code}")
        try:
            body = json.loads(chunks)
        except ValueError as exc:
            raise AdapterError("Source returned invalid JSON") from exc
        if not isinstance(body, dict):
            raise AdapterError("Source returned invalid response shape")
        if body.get("error"):
            raise AdapterError("Source reported an API error")
        return body

    async def search(self, query: SearchQuery, client: httpx.AsyncClient) -> list[SearchResult]:
        raise NotImplementedError
