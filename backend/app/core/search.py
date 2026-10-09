"""Bounded async orchestration, canonical deduplication, and explainable ranking."""

import asyncio
import time
from collections import deque
from collections.abc import Mapping
from typing import ClassVar, Literal, Protocol

import httpx

from app.core.cache import SearchCache
from app.core.ranking import rank_results
from app.core.urls import canonical_url  # noqa: F401 - public backwards compatible export
from app.engines.base import AdapterError
from app.models import EngineStatus, SearchQuery, SearchResponse, SearchResult


class Engine(Protocol):
    id: str
    name: str
    categories: ClassVar[list[str]]
    configured: bool
    enabled: bool
    requires_auth: bool
    filters: ClassVar[list[str]]
    rate_limit_per_minute: int

    async def search(self, query: SearchQuery, client: httpx.AsyncClient) -> list[SearchResult]: ...


class SearchService:
    def __init__(
        self,
        engines: Mapping[str, Engine],
        client: httpx.AsyncClient,
        *,
        timeout: float = 8,
        overall_timeout: float = 9,
        concurrency: int = 12,
        cache_size: int = 128,
        cache_ttl: float = 120,
    ):
        self.engines = engines
        self.client = client
        self.timeout = timeout
        self.overall_timeout = overall_timeout
        self.semaphore = asyncio.Semaphore(concurrency)
        self.cache_size = cache_size
        self.cache_ttl = cache_ttl
        self.cache = SearchCache(cache_size, cache_ttl)
        self.calls: dict[str, deque[float]] = {key: deque() for key in engines}
        self.cooldown: dict[str, float] = {}
        self.cooldown_status: dict[str, Literal["error", "rate_limited", "unavailable"]] = {}
        self.engine_metrics = {
            name: {
                "requests": 0,
                "successes": 0,
                "errors": 0,
                "timeouts": 0,
                "rate_limited": 0,
                "unavailable": 0,
                "latency_total_ms": 0.0,
            }
            for name in engines
        }
        self.metrics = {"requests": 0, "cache_hits": 0, "engine_errors": 0, "engine_timeouts": 0}

    def diagnostics(self) -> dict:
        sources = {}
        for name, values in self.engine_metrics.items():
            count = values["requests"]
            sources[name] = {
                **values,
                "mean_latency_ms": round(values["latency_total_ms"] / count, 3) if count else None,
                "failure_rate": (
                    values["errors"]
                    + values["timeouts"]
                    + values["rate_limited"]
                    + values["unavailable"]
                )
                / count
                if count
                else None,
            }
        return {**self.metrics, "engines": sources}

    def observe(self, status: EngineStatus) -> None:
        values = self.engine_metrics[status.engine]
        values["requests"] += 1
        field = {
            "success": "successes",
            "error": "errors",
            "timeout": "timeouts",
            "rate_limited": "rate_limited",
            "unavailable": "unavailable",
        }[status.status]
        values[field] += 1
        values["latency_total_ms"] += status.latency_ms

    async def run_engine(
        self, key: str, query: SearchQuery
    ) -> tuple[list[SearchResult], EngineStatus]:
        start = time.monotonic()
        engine = self.engines[key]
        history = self.calls[key]
        while history and history[0] <= start - 60:
            history.popleft()
        if self.cooldown.get(key, 0) > start:
            status = self.cooldown_status.get(key, "rate_limited")
            return [], EngineStatus(
                engine=key,
                status=status,
                message="Source temporarily unavailable"
                if status == "unavailable"
                else "Source request limit reached",
            )
        if len(history) >= engine.rate_limit_per_minute:
            return [], EngineStatus(
                engine=key, status="rate_limited", message="Source request limit reached"
            )
        history.append(start)
        try:
            async with asyncio.timeout(self.timeout):
                async with self.semaphore:
                    results = await engine.search(query, self.client)
            return results[:100], EngineStatus(
                engine=key, status="success", latency_ms=round((time.monotonic() - start) * 1000, 2)
            )
        except (TimeoutError, httpx.TimeoutException):
            self.metrics["engine_timeouts"] += 1
            return [], EngineStatus(
                engine=key,
                status="timeout",
                message="Source deadline exceeded",
                latency_ms=round((time.monotonic() - start) * 1000, 2),
            )
        except Exception as error:  # noqa: BLE001 - isolate third-party adapter failures
            self.metrics["engine_errors"] += 1
            retry = getattr(error, "retry_after", None)
            if retry is not None:
                self.cooldown[key] = time.monotonic() + min(max(float(retry), 1), 3600)
                self.cooldown_status[key] = (
                    error.status if isinstance(error, AdapterError) else "rate_limited"
                )
            return [], EngineStatus(
                engine=key,
                status=error.status
                if isinstance(error, AdapterError)
                else "rate_limited"
                if retry is not None
                else "error",
                message="Source temporarily unavailable",
                latency_ms=round((time.monotonic() - start) * 1000, 2),
            )

    async def search(self, query: SearchQuery) -> SearchResponse:
        start = time.monotonic()
        self.metrics["requests"] += 1
        hit = self.cache.get(query)
        if hit:
            self.metrics["cache_hits"] += 1
            return hit.model_copy(
                deep=True,
                update={"cached": True, "timing_ms": round((time.monotonic() - start) * 1000, 2)},
            )
        requested = query.engines or [
            name
            for name, engine in self.engines.items()
            if query.category in engine.categories and engine.configured and engine.enabled
        ]
        unknown = [name for name in requested if name not in self.engines]
        if unknown:
            raise ValueError("Unknown engine selection")
        selected = [
            name
            for name in requested
            if query.category in self.engines[name].categories
            and self.engines[name].configured
            and self.engines[name].enabled
        ]
        tasks = [asyncio.create_task(self.run_engine(name, query)) for name in selected]
        completed: list[tuple[list[SearchResult], EngineStatus]] = []
        if tasks:
            try:
                _, pending = await asyncio.wait(tasks, timeout=self.overall_timeout)
                for task in pending:
                    task.cancel()
                await asyncio.gather(*pending, return_exceptions=True)
                for name, task in zip(selected, tasks):
                    if task.cancelled():
                        self.metrics["engine_timeouts"] += 1
                        completed.append(
                            (
                                [],
                                EngineStatus(
                                    engine=name,
                                    status="timeout",
                                    message="Search deadline exceeded",
                                    latency_ms=round((time.monotonic() - start) * 1000, 2),
                                ),
                            )
                        )
                    else:
                        completed.append(task.result())
            finally:
                for task in tasks:
                    if not task.done():
                        task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
        statuses = [status for _, status in completed]
        statuses.extend(
            EngineStatus(
                engine=name, status="unavailable", message="Source unavailable for this category"
            )
            for name in requested
            if name not in selected
        )
        for status in statuses:
            self.observe(status)
        ranked = rank_results(
            query,
            [(name, results) for name, (results, _) in zip(selected, completed)],
            upstream_time_sources={
                name for name in selected if "time_range" in self.engines[name].filters
            },
        )
        response = SearchResponse(
            query=query.q,
            results=ranked[: query.limit],
            result_count=min(len(ranked), query.limit),
            category=query.category,
            page=query.page,
            limit=query.limit,
            has_more=any(len(results) >= query.limit for results, _ in completed),
            timing_ms=round((time.monotonic() - start) * 1000, 2),
            engine_status=statuses,
            partial=any(status.status != "success" for status in statuses),
            applied_filters={
                "local": {
                    "site": query.site,
                    "exclude_site": query.exclude_site,
                    "file_type": query.file_type,
                    "time_range": query.time_range,
                    "time_range_sources": [
                        name for name in selected if "time_range" not in self.engines[name].filters
                    ],
                    "time_range_behavior": "Fallback date filtering for sources without upstream freshness; undated fallback results excluded",
                },
                "upstream": {
                    name: {
                        field: getattr(query, field)
                        for field in self.engines[name].filters
                        if field in SearchQuery.model_fields
                    }
                    for name in selected
                },
                "unsupported_by_source": {
                    name: [
                        field
                        for field in ("language", "safe_search", "time_range")
                        if field not in self.engines[name].filters
                    ]
                    for name in selected
                },
                "pagination": "Source-native pages; ranking is within the current page",
            },
        )
        if not response.partial and selected:
            self.cache.put(query, response)
        return response
