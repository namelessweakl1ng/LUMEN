import httpx
import pytest

from app.engines.sources import (
    AdapterError,
    Brave,
    Commons,
    Crossref,
    GitHub,
    HackerNews,
    Wikipedia,
    clean,
    safe_url,
)
from app.models import SearchQuery

CASES = [
    (
        Wikipedia,
        {"query": {"search": [{"title": "Python language", "snippet": "<b>programming</b>"}]}},
        "wikipedia.org",
    ),
    (
        GitHub,
        {
            "items": [
                {
                    "full_name": "python/cpython",
                    "html_url": "https://github.com/python/cpython",
                    "description": "Python",
                }
            ]
        },
        "github.com",
    ),
    (
        Crossref,
        {
            "message": {
                "items": [
                    {
                        "title": ["A paper"],
                        "URL": "https://doi.org/10.123/example",
                        "abstract": "<p>Abstract</p>",
                    }
                ]
            }
        },
        "doi.org",
    ),
    (
        HackerNews,
        {"hits": [{"title": "Python news", "objectID": "123", "url": None}]},
        "news.ycombinator.com",
    ),
    (
        Commons,
        {
            "query": {
                "pages": {
                    "1": {
                        "title": "File:Python.jpg",
                        "imageinfo": [
                            {
                                "descriptionurl": "https://commons.wikimedia.org/wiki/File:Python.jpg",
                                "thumburl": "https://upload.wikimedia.org/python.jpg",
                                "extmetadata": {
                                    "LicenseShortName": {"value": "CC BY-SA 4.0"},
                                    "Artist": {"value": "<a>Jane</a>"},
                                },
                            }
                        ],
                    }
                }
            }
        },
        "commons.wikimedia.org",
    ),
    (
        Brave,
        {
            "web": {
                "results": [
                    {"title": "Python", "url": "https://python.org", "description": "<b>Python</b>"}
                ]
            }
        },
        "python.org",
    ),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("factory,payload,host", CASES)
async def test_official_source_normalization(factory, payload, host, monkeypatch):
    monkeypatch.setenv("BRAVE_API_KEY", "test-only")
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json=payload)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        engine = factory()
        results = await engine.search(SearchQuery(q="python"), client)
    assert len(results) == 1
    assert host in results[0].url
    assert results[0].source_engines == [engine.id]
    assert "<" not in results[0].snippet
    assert requests[0].url.scheme == "https"
    if factory is Commons:
        assert results[0].metadata["license"] == "CC BY-SA 4.0"
        assert results[0].metadata["attribution"] == "Jane"


@pytest.mark.asyncio
@pytest.mark.parametrize("factory,payload,host", CASES)
@pytest.mark.parametrize(
    "payload_override",
    [
        {},
        {
            "query": {"search": [None, 4], "pages": [None]},
            "items": [None],
            "message": {"items": [None]},
            "hits": [None],
            "web": {"results": [None]},
        },
    ],
)
async def test_empty_and_malformed_items(factory, payload, host, payload_override, monkeypatch):
    monkeypatch.setenv("BRAVE_API_KEY", "test-only")
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload_override))
    ) as client:
        assert await factory().search(SearchQuery(q="python"), client) == []


@pytest.mark.asyncio
@pytest.mark.parametrize("factory,payload,host", CASES)
async def test_throttle_propagates_retry_after(factory, payload, host, monkeypatch):
    monkeypatch.setenv("BRAVE_API_KEY", "test-only")
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(429, headers={"Retry-After": "17"}))
    ) as client:
        with pytest.raises(AdapterError) as error:
            await factory().search(SearchQuery(q="private query"), client)
    assert error.value.retry_after == 17
    assert "private query" not in str(error.value)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, text="not JSON"),
        httpx.Response(200, json=[]),
        httpx.Response(503),
        httpx.Response(200, json={"error": {"code": "failure"}}),
    ],
)
async def test_invalid_responses_raise_source_error(response):
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: response)) as client:
        with pytest.raises(AdapterError):
            await GitHub().search(SearchQuery(q="python"), client)


@pytest.mark.asyncio
async def test_missing_auth_does_not_send_request(monkeypatch):
    monkeypatch.delenv("BRAVE_API_KEY", raising=False)

    def handler(_):
        pytest.fail("An unconfigured adapter must not send a request")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        assert not Brave().configured
        with pytest.raises(AdapterError, match="requires BRAVE_API_KEY"):
            await Brave().search(SearchQuery(q="python"), client)


@pytest.mark.parametrize(
    "value",
    [
        "javascript:alert(1)",
        "https://user:password@example.org",
        "http://127.0.0.1/foo",
        "http://169.254.169.254",
        "https://localhost",
        "https://example.org\\foo",
        "https://example.org/\nfoo",
        "https://[::1]/",
        None,
    ],
)
def test_unsafe_urls_are_rejected(value):
    assert safe_url(value) is None


@pytest.mark.asyncio
async def test_bad_upstream_url_does_not_become_a_result():
    payload = {"items": [{"full_name": "bad/repo", "html_url": "javascript:alert(1)"}]}
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))
    ) as client:
        assert await GitHub().search(SearchQuery(q="python"), client) == []


def test_strip_active_markup_and_bound_snippets():
    assert clean("<script>alert(1)</script><b>Visible</b>") == "Visible"
    assert len(clean("x" * 10000)) == 600


@pytest.mark.asyncio
async def test_stream_size_bound_rejects_response():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, content=b"x" * 5_000_001))
    ) as client:
        with pytest.raises(AdapterError, match="size limit"):
            await GitHub().search(SearchQuery(q="python"), client)


@pytest.mark.asyncio
async def test_timeout_retains_timeout_classification():
    def handler(request):
        raise httpx.ReadTimeout("upstream timeout", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.TimeoutException):
            await GitHub().search(SearchQuery(q="python"), client)


@pytest.mark.asyncio
async def test_missing_retry_after_applies_default_cooldown():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(429))
    ) as client:
        with pytest.raises(AdapterError) as error:
            await GitHub().search(SearchQuery(q="python"), client)
    assert error.value.retry_after == 60


@pytest.mark.asyncio
async def test_crossref_publication_metadata():
    payload = {
        "message": {
            "items": [
                {
                    "title": ["Paper"],
                    "URL": "https://doi.org/10.1/test",
                    "DOI": "10.1/test",
                    "published": {"date-parts": [[2025, 7]]},
                    "author": [{"given": "Ada", "family": "Lovelace"}],
                    "container-title": ["Journal"],
                }
            ]
        }
    }
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))
    ) as client:
        results = await Crossref().search(SearchQuery(q="python"), client)
    assert results[0].published_at.isoformat() == "2025-07-01T00:00:00+00:00"
    assert results[0].metadata["authors"] == ["Ada Lovelace"]


@pytest.mark.asyncio
async def test_commons_requires_license():
    payload = {
        "query": {
            "pages": {
                "1": {
                    "title": "Image",
                    "imageinfo": [{"descriptionurl": "https://commons.wikimedia.org/wiki/Image"}],
                }
            }
        }
    }
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))
    ) as client:
        assert await Commons().search(SearchQuery(q="python"), client) == []


@pytest.mark.asyncio
async def test_native_github_pagination_and_optional_auth(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "fixture-token")

    def handler(request):
        assert request.url.params["page"] == "3"
        assert request.url.params["per_page"] == "5"
        assert request.headers["Authorization"] == "Bearer fixture-token"
        return httpx.Response(200, json={"items": []})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        assert await GitHub().search(SearchQuery(q="python", page=3, limit=5), client) == []


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [502, 503, 504])
async def test_transient_failure_retries_once(status, monkeypatch):
    attempts = []
    delays = []

    async def backoff(seconds):
        delays.append(seconds)

    monkeypatch.setattr("app.engines.base.asyncio.sleep", backoff)
    monkeypatch.setattr("app.engines.base.random.uniform", lambda _a, _b: 0.025)

    def handler(request):
        attempts.append(request)
        return (
            httpx.Response(status)
            if len(attempts) == 1
            else httpx.Response(200, json={"items": []})
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        assert await GitHub().search(SearchQuery(q="python"), client) == []
    assert len(attempts) == 2
    assert delays == [0.125]


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [400, 401, 403, 429])
async def test_invalid_auth_and_throttled_requests_do_not_retry(status):
    attempts = []

    def handler(request):
        attempts.append(request)
        return httpx.Response(status)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(AdapterError):
            await GitHub().search(SearchQuery(q="python"), client)
    assert len(attempts) == 1


@pytest.mark.asyncio
async def test_unavailable_retry_after_defers_to_orchestrator():
    attempts = []

    def handler(request):
        attempts.append(request)
        return httpx.Response(503, headers={"Retry-After": "21"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(AdapterError) as error:
            await GitHub().search(SearchQuery(q="python"), client)
    assert len(attempts) == 1
    assert error.value.retry_after == 21
    assert error.value.status == "unavailable"


@pytest.mark.asyncio
async def test_adapter_uses_configured_client_timeout():
    seen = []

    def handler(request):
        seen.append(request.extensions["timeout"])
        return httpx.Response(200, json={"items": []})

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), timeout=httpx.Timeout(12, connect=3)
    ) as client:
        await GitHub().search(SearchQuery(q="python"), client)
    assert seen[0]["read"] == 12
    assert seen[0]["connect"] == 3


@pytest.mark.asyncio
async def test_connection_failure_has_only_one_retry(monkeypatch):
    attempts = []

    async def backoff(_seconds):
        pass

    monkeypatch.setattr("app.engines.base.asyncio.sleep", backoff)

    def handler(request):
        attempts.append(request)
        raise httpx.ConnectError("unavailable", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(AdapterError, match="request failed"):
            await GitHub().search(SearchQuery(q="python"), client)
    assert len(attempts) == 2
