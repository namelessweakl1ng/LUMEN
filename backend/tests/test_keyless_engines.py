"""Deterministic tests; no live-provider access in CI."""

import httpx
import pytest

from app.engines.base import AdapterError
from app.engines.duckduckgo import DuckDuckGo
from app.engines.google_news import GoogleNews
from app.engines.sources import create_engines
from app.models import SearchQuery


@pytest.mark.asyncio
async def test_ddg_parses_results_without_secrets(monkeypatch):
    monkeypatch.setenv("LUMEN_ENABLE_DDG_HTML", "1")
    html = """<html><div id="links">
      <div class="result web-result"><h2><a class="result__a"
      href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fdocs.python.org%2F3%2F">Python docs</a></h2>
      <a class="result__snippet">Python <b>reference</b> documentation</a></div>
      <div class="result result--ad"><a class="result__a" href="https://ads.example.org">Ad</a></div>
      </div></html>"""

    def handler(request):
        assert request.method == "POST"
        assert b"q=python" in request.content
        return httpx.Response(200, text=html)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        results = await DuckDuckGo().search(SearchQuery(q="python"), client)
    assert len(results) == 1
    assert results[0].url == "https://docs.python.org/3/"
    assert results[0].snippet == "Python reference documentation"
    assert "duckduckgo" in results[0].source_engines


@pytest.mark.asyncio
async def test_ddg_stops_at_challenge(monkeypatch):
    monkeypatch.setenv("LUMEN_ENABLE_DDG_HTML", "1")
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, text='<form id="challenge-form"></form>')
        )
    ) as client:
        with pytest.raises(AdapterError, match="challenge"):
            await DuckDuckGo().search(SearchQuery(q="python"), client)


@pytest.mark.asyncio
async def test_ddg_rejects_unsafe_links(monkeypatch):
    monkeypatch.setenv("LUMEN_ENABLE_DDG_HTML", "1")
    html = """<div class="web-result"><h2><a class="result__a"
    href="javascript:alert(1)">bad</a></h2><a class="result__snippet">bad</a></div>"""
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=html))
    ) as client:
        with pytest.raises(AdapterError, match="no valid result links"):
            await DuckDuckGo().search(SearchQuery(q="python"), client)


@pytest.mark.asyncio
async def test_google_news_rss_parses_headlines():
    rss = """<?xml version="1.0"?><rss version="2.0"><channel>
    <item><title>Python 3 released</title>
    <link>https://news.google.com/rss/articles/example</link>
    <description>&lt;b&gt;Breaking&lt;/b&gt; news</description>
    <pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate>
    <source>Example Source</source></item></channel></rss>"""

    def handler(request):
        assert request.url.params["q"] == "python"
        return httpx.Response(200, text=rss)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        results = await GoogleNews().search(SearchQuery(q="python", category="news"), client)
    assert len(results) == 1
    assert results[0].title == "Python 3 released"
    assert results[0].snippet == "Breaking news"
    assert results[0].metadata["publisher"] == "Example Source"
    assert results[0].published_at.year == 2026


def test_registry_selection(monkeypatch):
    monkeypatch.setenv("LUMEN_ENABLE_DDG_HTML", "1")
    engines = create_engines()
    assert engines["duckduckgo"].enabled
    assert "general" in engines["duckduckgo"].categories
    assert "news" in engines["google_news"].categories


from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.asyncio
async def test_ddg_fixture_normalization_and_deduplication():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, text=(FIXTURES / "ddg-results.html").read_text())
        )
    ) as client:
        results = await DuckDuckGo().search(SearchQuery(q="python"), client)
    assert len(results) == 1
    assert results[0].title == "Python docs"
    assert results[0].snippet == "Python reference documentation"


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [202, 403, 429])
async def test_ddg_block_has_cooldown_and_no_retry(status):
    attempts = []

    def handler(request):
        attempts.append(request)
        return httpx.Response(status, text='<form id="challenge-form"></form>')

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(AdapterError) as error:
            await DuckDuckGo().search(SearchQuery(q="python"), client)
    assert len(attempts) == 1
    assert error.value.retry_after >= 120
    assert error.value.status in {"unavailable", "rate_limited"}


@pytest.mark.asyncio
@pytest.mark.parametrize("page", ["<html>unexpected</html>", "x" * 2_000_001])
async def test_ddg_unexpected_or_large_response_is_not_success(page):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=page))
    ) as client:
        with pytest.raises(AdapterError):
            await DuckDuckGo().search(SearchQuery(q="python"), client)


@pytest.mark.asyncio
async def test_rss_fixture_normalization_and_limit_after_dedup():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, content=(FIXTURES / "news-rss.xml").read_bytes())
        )
    ) as client:
        results = await GoogleNews().search(
            SearchQuery(q="python", category="news", limit=2), client
        )
    assert len(results) == 2
    assert results[0].title == "Python release"
    assert results[0].snippet == "Breaking news"
    assert results[0].metadata["publisher_url"] == "https://example.org"
    assert results[0].published_at.isoformat() == "2026-10-09T10:00:00+00:00"
    assert results[1].published_at is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "xml",
    [
        "<rss>",
        "<html/>",
        '<!DOCTYPE rss [<!ENTITY x "payload">]><rss><channel><item><title>&x;</title></item></channel></rss>',
        "x" * 2_000_001,
    ],
)
async def test_rss_rejects_invalid_xml_and_entities(xml):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=xml))
    ) as client:
        with pytest.raises(AdapterError):
            await GoogleNews().search(SearchQuery(q="python", category="news"), client)


def test_keyless_metadata_and_experimental_default(monkeypatch):
    monkeypatch.delenv("LUMEN_ENABLE_DDG_HTML", raising=False)
    engines = create_engines()
    assert "brave" not in engines
    assert not engines["duckduckgo"].enabled
    for engine in engines.values():
        assert not engine.requires_auth
        assert isinstance(engine.pagination, bool)
        assert engine.interface_type in {"public_api", "rss", "experimental_html"}
        assert engine.access_note
    monkeypatch.delenv("LUMEN_ENABLE_GOOGLE_NEWS_RSS", raising=False)
    assert not engines["google_news"].enabled
    monkeypatch.setenv("LUMEN_ENABLE_GOOGLE_NEWS_RSS", "1")
    assert engines["google_news"].enabled


@pytest.mark.asyncio
async def test_ddg_encodes_query_and_preserves_destination_escaping():
    def handler(request):
        from urllib.parse import parse_qs

        assert parse_qs(request.content.decode())["q"] == ["C++ & unicode café"]
        return httpx.Response(
            200,
            text='<div class="web-result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fa%252Fb">Title</a></div>',
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        results = await DuckDuckGo().search(SearchQuery(q="C++ & unicode café"), client)
    assert results[0].url == "https://example.org/a%2Fb"


@pytest.mark.asyncio
async def test_ddg_malformed_destination_is_discarded():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(
                200,
                text='<div class="web-result"><a class="result__a" href="https://[broken">Broken</a></div>',
            )
        )
    ) as client:
        with pytest.raises(AdapterError, match="no valid result links"):
            await DuckDuckGo().search(SearchQuery(q="python"), client)


@pytest.mark.asyncio
async def test_ddg_captcha_subject_is_an_ordinary_result():
    html = '<div class="web-result"><a class="result__a" href="https://example.org/captcha">CAPTCHA documentation</a><a class="result__snippet">How CAPTCHA works</a></div>'
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=html))
    ) as client:
        results = await DuckDuckGo().search(SearchQuery(q="CAPTCHA"), client)
    assert results[0].title == "CAPTCHA documentation"
    assert results[0].snippet == "How CAPTCHA works"


@pytest.mark.asyncio
async def test_ddg_explicit_no_result_marker_is_empty_success():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, text='<div class="no-results">No results found</div>')
        )
    ) as client:
        assert await DuckDuckGo().search(SearchQuery(q="unlikely query"), client) == []
