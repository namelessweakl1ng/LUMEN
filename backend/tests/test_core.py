import asyncio
from typing import ClassVar

import httpx
import pytest
from pydantic import ValidationError

from app.core.search import SearchService, canonical_url
from app.models import SearchQuery, SearchResult


def test_query_validation():
    with pytest.raises(ValidationError):
        SearchQuery(q="  ")
    with pytest.raises(ValidationError):
        SearchQuery(q="test", limit=51)
    with pytest.raises(ValidationError):
        SearchQuery(q="test", site=["https://bad.example/path"])


def test_canonicalization():
    assert (
        canonical_url("HTTPS://Example.COM:443/a?utm_source=x&b=2&a=1#x")
        == "https://example.com/a?a=1&b=2"
    )
    assert canonical_url("javascript:alert(1)") is None


class Engine:
    id = "fake"
    name = "Fake"
    categories: ClassVar[list[str]] = ["general"]
    configured = enabled = True
    requires_auth = False
    filters: ClassVar[list[str]] = []
    rate_limit_per_minute = 100
    calls = 0

    async def search(self, query, client):
        self.calls += 1
        return [
            SearchResult(
                title="Useful Python",
                url="https://example.com/a?utm_source=x",
                snippet="Python guide",
            ),
            SearchResult(title="Duplicate", url="https://example.com/a"),
        ]


async def test_dedup_cache_and_filter_identity():
    engine = Engine()
    async with httpx.AsyncClient() as client:
        service = SearchService({"fake": engine}, client)
        result = await service.search(SearchQuery(q="python"))
        assert result.result_count == 1
        assert result.results[0].ranking_explanation["relevance"] > 0
        assert (await service.search(SearchQuery(q="python"))).cached
        assert engine.calls == 1
        assert not (await service.search(SearchQuery(q="python", site=["other.com"]))).results
        assert engine.calls == 2


async def test_partial_timeout_and_cancellation():
    class Slow(Engine):
        id = "slow"

        async def search(self, query, client):
            await asyncio.sleep(5)
            return []

    async with httpx.AsyncClient() as client:
        service = SearchService({"fake": Engine(), "slow": Slow()}, client, timeout=0.02)
        result = await service.search(SearchQuery(q="python"))
        assert result.partial
        assert result.results
        assert result.engine_status[1].status == "timeout"


async def test_agreement_ranking_and_preferred_domain():
    class Second(Engine):
        id = "second"

        async def search(self, query, client):
            return [
                SearchResult(
                    title="Python",
                    url="https://example.com/a",
                    snippet="Much longer Python explanation",
                ),
                SearchResult(title="Python", url="https://other.com/b"),
            ]

    async with httpx.AsyncClient() as client:
        service = SearchService({"fake": Engine(), "second": Second()}, client)
        result = await service.search(SearchQuery(q="python", preferred_domains=["example.com"]))
        assert result.results[0].domain == "example.com"
        explanation = result.results[0].ranking_explanation
        assert explanation["domain_preference"] == 1
        assert explanation["source_agreement"] == 2
        assert explanation["agreement_bonus"] > 0
        assert result.results[0].snippet == "Much longer Python explanation"


async def test_cancellation_releases_outbound_permit():
    entered = asyncio.Event()
    cancelled = asyncio.Event()

    class Slow(Engine):
        async def search(self, query, client):
            entered.set()
            try:
                await asyncio.sleep(100)
            finally:
                cancelled.set()

    async with httpx.AsyncClient() as client:
        service = SearchService({"fake": Slow()}, client, concurrency=1)
        task = asyncio.create_task(service.search(SearchQuery(q="python")))
        await entered.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert cancelled.is_set()
        assert not service.semaphore.locked()


async def test_cache_bounds_expiration_and_retry_after():
    class Throttled(Engine):
        async def search(self, query, client):
            self.calls += 1
            from app.engines.base import AdapterError

            raise AdapterError("private query MUST NOT escape", retry_after=10)

    async with httpx.AsyncClient() as client:
        service = SearchService({"fake": Engine()}, client, cache_size=2, cache_ttl=0.001)
        for q in ("a", "b", "c"):
            await service.search(SearchQuery(q=q))
        assert len(service.cache) == 2
        await asyncio.sleep(0.01)
        assert not (await service.search(SearchQuery(q="c"))).cached
        engine = Throttled()
        service = SearchService({"fake": engine}, client)
        first = await service.search(SearchQuery(q="secret"))
        assert first.engine_status[0].status == "rate_limited"
        assert "private" not in first.model_dump_json()
        await service.search(SearchQuery(q="second"))
        assert engine.calls == 1


def test_repeated_query_values_preserve_order():
    assert canonical_url("https://example.com/?z=2&z=1") != canonical_url(
        "https://example.com/?z=1&z=2"
    )


async def test_page_two_retains_source_native_results():
    async with httpx.AsyncClient() as client:
        response = await SearchService({"fake": Engine()}, client).search(
            SearchQuery(q="python", page=2)
        )
        assert response.results
        assert response.page == 2


async def test_overall_deadline_keeps_finished_results():
    class Slow(Engine):
        async def search(self, query, client):
            await asyncio.sleep(10)
            return []

    async with httpx.AsyncClient() as client:
        service = SearchService(
            {"fake": Engine(), "slow": Slow()}, client, timeout=1, overall_timeout=0.02
        )
        response = await service.search(SearchQuery(q="python"))
        assert response.results
        assert response.partial
        assert response.engine_status[1].status == "timeout"
        assert not service.semaphore.locked()


async def test_metrics_aggregate_actual_source_outcomes():
    class Failing(Engine):
        async def search(self, query, client):
            raise ValueError("secret query")

    async with httpx.AsyncClient() as client:
        service = SearchService({"fake": Engine(), "failed": Failing()}, client)
        await service.search(SearchQuery(q="private python"))
        measured = service.diagnostics()
        assert measured["engines"]["fake"]["successes"] == 1
        assert measured["engines"]["failed"]["failure_rate"] == 1
        assert measured["engines"]["fake"]["mean_latency_ms"] > 0
        assert "private" not in str(measured)
        assert "secret" not in str(measured)


def test_duplicate_metadata_merges_without_erasing_first_values():
    from app.core.ranking import rank_results

    results = rank_results(
        SearchQuery(q="python"),
        [
            (
                "wiki",
                [
                    SearchResult(
                        title="Python",
                        url="https://example.com/a",
                        metadata={"authors": ["Zoe"], "venue": "First", "description": ""},
                    )
                ],
            ),
            (
                "hn",
                [
                    SearchResult(
                        title="Python",
                        url="https://example.com/a",
                        metadata={
                            "authors": ["Amy", "Zoe"],
                            "venue": "Later",
                            "discussion_url": "https://news.ycombinator.com/item?id=1",
                            "description": "Useful",
                        },
                    )
                ],
            ),
        ],
    )
    assert results[0].metadata["authors"] == ["Amy", "Zoe"]
    assert results[0].metadata["venue"] == "First"
    assert results[0].metadata["description"] == "Useful"
    assert results[0].metadata["discussion_url"].endswith("id=1")


def test_recency_ranking_uses_one_injectable_clock():
    from datetime import UTC, datetime

    from app.core.ranking import rank_results

    batches = [
        (
            "fake",
            [
                SearchResult(
                    title="Python",
                    url="https://example.com/old",
                    published_at=datetime(2026, 1, 1, tzinfo=UTC),
                ),
                SearchResult(
                    title="Python",
                    url="https://example.com/new",
                    published_at=datetime(2026, 1, 2, tzinfo=UTC),
                ),
            ],
        )
    ]
    query = SearchQuery(q="python", ranking="recency")
    moment = datetime(2026, 1, 3, tzinfo=UTC)
    first = rank_results(query, batches, now=moment)
    second = rank_results(query, batches, now=moment)
    assert [item.model_dump() for item in first] == [item.model_dump() for item in second]
    assert next(item for item in first if item.url.endswith("/new")).ranking_explanation[
        "recency"
    ] == 1 / (1 + 1 / 30)


async def test_upstream_freshness_keeps_undated_brave_results(monkeypatch):
    from app.engines.brave import Brave
    from app.engines.wikipedia import Wikipedia

    monkeypatch.setenv("BRAVE_API_KEY", "fixture-not-real")

    def upstream(request):
        if request.url.host == "api.search.brave.com":
            assert request.url.params["freshness"] == "pd"
            return httpx.Response(
                200,
                json={
                    "web": {
                        "results": [
                            {
                                "title": "Fresh Python",
                                "url": "https://python.org/fresh",
                                "description": "Recent",
                            }
                        ]
                    }
                },
            )
        return httpx.Response(
            200, json={"query": {"search": [{"title": "Python", "snippet": "Undated"}]}}
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(upstream)) as client:
        response = await SearchService({"brave": Brave(), "wikipedia": Wikipedia()}, client).search(
            SearchQuery(q="python", time_range="day")
        )
        assert [item.url for item in response.results] == ["https://python.org/fresh"]
        assert response.applied_filters["upstream"]["brave"]["time_range"] == "day"
        assert response.applied_filters["local"]["time_range_sources"] == ["wikipedia"]


async def test_result_count_counts_returned_page_not_candidate_pool():
    class Many(Engine):
        async def search(self, query, client):
            return [SearchResult(title="Python", url=f"https://example.com/{i}") for i in range(10)]

    async with httpx.AsyncClient() as client:
        response = await SearchService({"many": Many()}, client).search(
            SearchQuery(q="python", limit=3)
        )
        assert response.result_count == len(response.results) == 3
        assert response.has_more
