"""Test-only FastAPI server using real adapters with fixture HTTP responses.

Run via uv run uvicorn tests.e2e_server:app --no-access-log. Production uses app.main:app.
No runtime environment flag can enable this harness in the production application.
"""

import asyncio
import json
from pathlib import Path

import httpx

from app.engines import create_engines
from app.main import create_app

FIXTURES = json.loads((Path(__file__).parent / "fixtures/search.json").read_text())
HOST_SOURCE = {
    "en.wikipedia.org": "wikipedia",
    "api.github.com": "github",
    "api.crossref.org": "crossref",
    "hn.algolia.com": "hackernews",
    "commons.wikimedia.org": "commons",
}


async def fixture_transport(request: httpx.Request) -> httpx.Response:
    """Only permitted adapter endpoints are serviced; no external request is made."""
    source = HOST_SOURCE.get(request.url.host)
    if source is None:
        return httpx.Response(403, json={"error": "Fixture source not configured"})
    query = next(
        (
            request.url.params[k]
            for k in ["q", "query", "srsearch", "gsrsearch"]
            if k in request.url.params
        ),
        "",
    )
    await asyncio.sleep(0.015)
    if query == "provider-failure" or (query == "partial-failure" and source == "github"):
        return httpx.Response(503, json={"error": "Test fixture failure"})
    if query == "no-results":
        empty = {
            "wikipedia": {"query": {"search": []}},
            "github": {"items": []},
            "crossref": {"message": {"items": []}},
            "hackernews": {"hits": []},
            "commons": {"query": {"pages": {}}},
        }
        return httpx.Response(200, json=empty[source])
    return httpx.Response(200, json=FIXTURES[source])


client = httpx.AsyncClient(transport=httpx.MockTransport(fixture_transport))
app = create_app(engines=create_engines(), client=client, diagnostics_token="fixture-only")
