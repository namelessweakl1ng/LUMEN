from __future__ import annotations

import os
from typing import Any, ClassVar

import httpx

from app.models import SearchQuery, SearchResult

from .base import AdapterError, SearchEngine, _dict, _list


class Brave(SearchEngine):
    id, name, categories = "brave", "Brave web search", ["general"]
    requires_auth = True
    filters: ClassVar[list[str]] = ["language", "safe_search", "time_range"]

    @property
    def configured(self) -> bool:  # type: ignore[override]
        return bool(os.environ.get("BRAVE_API_KEY"))

    async def search(self, query: SearchQuery, client: httpx.AsyncClient) -> list[SearchResult]:
        if query.page > 10:
            return []
        key = os.environ.get("BRAVE_API_KEY")
        if not key:
            raise AdapterError("Source requires BRAVE_API_KEY")
        params: dict[str, Any] = {
            "q": query.q,
            "count": min(query.limit, 20),
            "offset": query.page - 1,
            "safesearch": {0: "off", 1: "moderate", 2: "strict"}[query.safe_search],
        }
        if query.language != "all":
            params["search_lang"] = query.language
        freshness = {"day": "pd", "week": "pw", "month": "pm", "year": "py"}.get(query.time_range)
        if freshness:
            params["freshness"] = freshness
        data = await self.get(
            client,
            "https://api.search.brave.com/res/v1/web/search",
            params,
            {"X-Subscription-Token": key},
        )
        results = []
        for item in _list(_dict(data.get("web")).get("results")):
            item = _dict(item)
            result = self.result(item.get("title"), item.get("url"), item.get("description"))
            if result:
                results.append(result)
        return results
