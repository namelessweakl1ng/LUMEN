from __future__ import annotations

import os

import httpx

from app.models import SearchQuery, SearchResult

from .base import SearchEngine, _dict, _list, clean, parse_date


class GitHub(SearchEngine):
    id, name, categories = "github", "GitHub repositories", ["developer", "general"]
    rate_limit_per_minute = 10

    async def search(self, query: SearchQuery, client: httpx.AsyncClient) -> list[SearchResult]:
        headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        token = os.environ.get("GITHUB_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"
        data = await self.get(
            client,
            "https://api.github.com/search/repositories",
            {
                "q": query.q,
                "per_page": query.limit,
                "page": query.page,
            },
            headers,
        )
        results = []
        for item in _list(data.get("items")):
            item = _dict(item)
            result = self.result(
                item.get("full_name"),
                item.get("html_url"),
                item.get("description"),
                published_at=parse_date(item.get("pushed_at")),
                metadata={
                    "stars": item.get("stargazers_count")
                    if isinstance(item.get("stargazers_count"), int)
                    else None,
                    "language": clean(item.get("language")),
                    "updated_at": clean(item.get("updated_at")),
                },
            )
            if result:
                results.append(result)
        return results
