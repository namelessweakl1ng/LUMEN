from __future__ import annotations

import re
from typing import ClassVar
from urllib.parse import quote

import httpx

from app.models import SearchQuery, SearchResult

from .base import SearchEngine, _dict, _list


class Wikipedia(SearchEngine):
    id, name, categories = "wikipedia", "Wikipedia", ["general", "science"]
    filters: ClassVar[list[str]] = ["language"]

    async def search(self, query: SearchQuery, client: httpx.AsyncClient) -> list[SearchResult]:
        language = query.language.split("-")[0].lower()
        if not re.fullmatch(r"[a-z]{2,3}", language):
            language = "en"
        data = await self.get(
            client,
            f"https://{language}.wikipedia.org/w/api.php",
            {
                "action": "query",
                "list": "search",
                "srsearch": query.q,
                "srlimit": min(query.limit, 50),
                "sroffset": (query.page - 1) * query.limit,
                "format": "json",
                "utf8": 1,
            },
        )
        results = []
        for item in _list(_dict(data.get("query")).get("search")):
            item = _dict(item)
            title = item.get("title")
            if not isinstance(title, str):
                continue
            result = self.result(
                title,
                f"https://{language}.wikipedia.org/wiki/{quote(title.replace(' ', '_'), safe='')}",
                item.get("snippet"),
            )
            if result:
                results.append(result)
        return results
