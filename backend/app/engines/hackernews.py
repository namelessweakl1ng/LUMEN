from __future__ import annotations

import httpx

from app.models import SearchQuery, SearchResult

from .base import SearchEngine, _dict, _list, clean, parse_date


class HackerNews(SearchEngine):
    id, name, categories = "hackernews", "Hacker News", ["news", "developer", "general"]

    async def search(self, query: SearchQuery, client: httpx.AsyncClient) -> list[SearchResult]:
        data = await self.get(
            client,
            "https://hn.algolia.com/api/v1/search",
            {
                "query": query.q,
                "tags": "story",
                "hitsPerPage": query.limit,
                "page": query.page - 1,
            },
        )
        results = []
        for item in _list(data.get("hits")):
            item = _dict(item)
            object_id = item.get("objectID")
            fallback = (
                f"https://news.ycombinator.com/item?id={object_id}"
                if str(object_id).isdigit()
                else None
            )
            result = self.result(
                item.get("title"),
                item.get("url") or fallback,
                item.get("story_text"),
                published_at=parse_date(item.get("created_at")),
                metadata={
                    "discussion_url": fallback,
                    "author": clean(item.get("author")),
                    "points": item.get("points") if isinstance(item.get("points"), int) else None,
                },
            )
            if result:
                results.append(result)
        return results
