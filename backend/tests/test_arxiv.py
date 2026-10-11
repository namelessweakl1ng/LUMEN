"""The production arXiv adapter uses the provider's public Atom API."""

import asyncio
from datetime import UTC, datetime

import httpx
import pytest
from fastapi.testclient import TestClient

from app.engines.arxiv import Arxiv
from app.engines.base import AdapterError
from app.engines.sources import create_engines
from app.main import create_app
from app.models import SearchQuery

FEED = b'''<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
  <opensearch:totalResults>1</opensearch:totalResults>
  <entry><id>http://arxiv.org/abs/2512.10504v2</id><title>Quantum\nadvantage</title>
    <summary>Real research summary.</summary><published>2025-12-11T00:00:00Z</published>
    <author><name>Ada Lovelace</name></author>
  </entry>
</feed>'''


@pytest.mark.asyncio
async def test_arxiv_real_atom_contract_and_query_encoding():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, content=FEED)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await Arxiv().search(SearchQuery(q="machine learning", category="science", page=2, limit=3), client)
    assert calls[0].url.params["search_query"] == 'all:"machine learning"'
    assert calls[0].url.params["start"] == "3"
    assert calls[0].url.params["max_results"] == "3"
    assert result[0].url == "https://arxiv.org/abs/2512.10504v2"
    assert result[0].source_engines == ["arxiv"]
    assert result[0].published_at == datetime(2025, 12, 11, tzinfo=UTC)
    assert result[0].metadata["authors"] == ["Ada Lovelace"]


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [b"<feed>", b"<html/>", b'<!DOCTYPE feed [<!ENTITY x "bad">]><feed>&x;</feed>'])
async def test_arxiv_rejects_malformed_or_non_feed_response(body):
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, content=body))) as client:
        with pytest.raises(AdapterError):
            await Arxiv().search(SearchQuery(q="quantum", category="science"), client)


@pytest.mark.asyncio
async def test_arxiv_empty_feed_and_invalid_entries():
    body = b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>https://evil.example/abs/123</id><title>Bad</title></entry></feed>'
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, content=body))) as client:
        assert await Arxiv().search(SearchQuery(q="quantum", category="science"), client) == []


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [403, 429, 500, 503])
async def test_arxiv_upstream_failure_is_bounded_and_not_retried(status):
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(status, headers={"Retry-After": "17"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(AdapterError) as caught:
            await Arxiv().search(SearchQuery(q="quantum", category="science"), client)
    assert len(requests) == 1
    if status in (429, 503):
        assert caught.value.retry_after == 17
    if status == 403:
        assert caught.value.retry_after == 600


@pytest.mark.asyncio
async def test_arxiv_serializes_requests_and_spaces_starts(monkeypatch):
    moments = []
    instant = 100.0

    def now():
        return instant

    async def advance(seconds):
        nonlocal instant
        instant += seconds

    monkeypatch.setattr("app.engines.arxiv.time.monotonic", now)
    monkeypatch.setattr("app.engines.arxiv.asyncio.sleep", advance)
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: (moments.append(now()), httpx.Response(200, content=FEED))[1])) as client:
        engine = Arxiv()
        await asyncio.gather(*(engine.search(SearchQuery(q=f"q{i}", category="science"), client) for i in range(3)))
    assert moments == [100.0, 103.0, 106.0]


def test_registry_contains_only_enabled_production_sources(monkeypatch):
    monkeypatch.setenv("LUMEN_ENABLE_DDG_HTML", "1")
    monkeypatch.setenv("LUMEN_ENABLE_GOOGLE_NEWS_RSS", "1")
    engines = create_engines()
    assert "arxiv" in engines
    assert "duckduckgo" not in engines
    assert "google_news" not in engines
    assert all(engine.enabled and engine.configured and not engine.requires_auth for engine in engines.values())
    assert all(engine.interface_type == "public_api" for engine in engines.values())
    assert engines["arxiv"].min_request_interval_seconds == 3.0


def test_public_metadata_shows_arxiv_and_no_experimental_sources():
    with TestClient(create_app(engines=create_engines())) as client:
        engines = client.get("/api/v1/engines").json()["engines"]
        science = next(category for category in client.get("/api/v1/categories").json()["categories"] if category["id"] == "science")
    ids = {engine["id"] for engine in engines}
    assert ids == {"wikipedia", "github", "crossref", "hackernews", "commons", "arxiv"}
    arxiv = next(engine for engine in engines if engine["id"] == "arxiv")
    assert arxiv["enabled"] and arxiv["availability"] == "available"
    assert arxiv["min_request_interval_seconds"] == 3.0
    assert arxiv["pagination"] is True
    assert "arxiv" in science["engines"]
