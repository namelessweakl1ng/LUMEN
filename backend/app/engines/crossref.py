from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

import httpx

from app.models import SearchQuery, SearchResult

from .base import SearchEngine, _dict, _list, clean


class Crossref(SearchEngine):
    id, name, categories = "crossref", "Crossref papers", ["science", "general"]

    async def search(self, query: SearchQuery, client: httpx.AsyncClient) -> list[SearchResult]:
        params: dict[str, Any] = {
            "query": query.q,
            "rows": query.limit,
            "offset": (query.page - 1) * query.limit,
        }
        contact = os.environ.get("CROSSREF_MAILTO")
        if contact:
            params["mailto"] = contact
        data = await self.get(client, "https://api.crossref.org/works", params)
        results = []
        for item in _list(_dict(data.get("message")).get("items")):
            item = _dict(item)
            titles = _list(item.get("title"))
            authors = [
                clean(" ".join(str(_dict(author).get(part, "")) for part in ("given", "family")))
                for author in _list(item.get("author"))[:20]
            ]
            dates = _list(_dict(item.get("published")).get("date-parts"))
            parts = _list(dates[0]) if dates else []
            published = None
            if parts and all(isinstance(part, int) for part in parts):
                try:
                    expanded = (parts + [1, 1])[:3]
                    published = datetime(expanded[0], expanded[1], expanded[2], tzinfo=UTC)
                except (ValueError, TypeError, OverflowError):
                    pass
            result = self.result(
                titles[0] if titles else "",
                item.get("URL"),
                item.get("abstract"),
                published_at=published,
                metadata={
                    "doi": clean(item.get("DOI")),
                    "authors": authors,
                    "venue": [clean(title) for title in _list(item.get("container-title"))[:3]],
                },
            )
            if result:
                results.append(result)
        return results
