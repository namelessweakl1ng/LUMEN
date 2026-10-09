from __future__ import annotations

import httpx

from app.models import SearchQuery, SearchResult

from .base import SearchEngine, _dict, _list, clean, safe_url


class Commons(SearchEngine):
    id, name, categories = "commons", "Wikimedia Commons", ["images"]

    async def search(self, query: SearchQuery, client: httpx.AsyncClient) -> list[SearchResult]:
        data = await self.get(
            client,
            "https://commons.wikimedia.org/w/api.php",
            {
                "action": "query",
                "generator": "search",
                "gsrsearch": query.q,
                "gsrnamespace": 6,
                "gsrlimit": min(query.limit, 50),
                "gsroffset": (query.page - 1) * query.limit,
                "prop": "imageinfo",
                "iiprop": "url|extmetadata",
                "iiurlwidth": 400,
                "format": "json",
            },
        )
        results = []
        pages = _dict(_dict(data.get("query")).get("pages"))
        for item in pages.values():
            item = _dict(item)
            info_list = _list(item.get("imageinfo"))
            info = _dict(info_list[0]) if info_list else {}
            metadata = _dict(info.get("extmetadata"))
            license_name = clean(_dict(metadata.get("LicenseShortName")).get("value"))
            if not license_name:
                continue
            result = self.result(
                item.get("title"),
                info.get("descriptionurl"),
                _dict(metadata.get("ImageDescription")).get("value"),
                thumbnail_url=info.get("thumburl"),
                metadata={
                    "license": license_name,
                    "license_url": safe_url(_dict(metadata.get("LicenseUrl")).get("value")),
                    "attribution": clean(_dict(metadata.get("Artist")).get("value")),
                    "credit": clean(_dict(metadata.get("Credit")).get("value")),
                },
            )
            if result:
                results.append(result)
        return results
