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
    html = '''<html><div id="links">
      <div class="result web-result"><h2><a class="result__a"
      href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fdocs.python.org%2F3%2F">Python docs</a></h2>
      <a class="result__snippet">Python <b>reference</b> documentation</a></div>
      <div class="result result--ad"><a class="result__a" href="https://ads.example.org">Ad</a></div>
      </div></html>'''

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
    async with httpx.AsyncClient(transport=httpx.MockTransport(
        lambda _: httpx.Response(200, text='<form id="challenge-form"></form>')
    )) as client:
        with pytest.raises(AdapterError, match="challenge"):
            await DuckDuckGo().search(SearchQuery(q="python"), client)


@pytest.mark.asyncio
async def test_ddg_rejects_unsafe_links(monkeypatch):
    monkeypatch.setenv("LUMEN_ENABLE_DDG_HTML", "1")
    html = '''<div class="web-result"><h2><a class="result__a"
    href="javascript:alert(1)">bad</a></h2><a class="result__snippet">bad</a></div>'''
    async with httpx.AsyncClient(transport=httpx.MockTransport(
        lambda _: httpx.Response(200, text=html)
    )) as client:
        assert await DuckDuckGo().search(SearchQuery(q="python"), client) == []


@pytest.mark.asyncio
async def test_google_news_rss_parses_headlines():
    rss = '''<?xml version="1.0"?><rss version="2.0"><channel>
    <item><title>Python 3 released</title>
    <link>https://news.google.com/rss/articles/example</link>
    <description>&lt;b&gt;Breaking&lt;/b&gt; news</description>
    <pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate>
    <source>Example Source</source></item></channel></rss>'''

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
