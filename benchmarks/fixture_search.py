"""Reproducible fixture benchmark. Does not measure live provider performance.

From backend: uv run python ../benchmarks/fixture_search.py
"""

import asyncio
import json
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from tests.e2e_server import app, client


async def main():
    service = app.state.search_service
    for engine in service.engines.values():
        engine.rate_limit_per_minute = 10_000  # Fixture-only isolation from provider quotas.
    transport = httpx.ASGITransport(app=app)
    latencies = []
    async with httpx.AsyncClient(transport=transport, base_url="http://fixture") as api:

        async def request(query):
            start = time.perf_counter()
            response = await api.get("/api/v1/search", params={"q": query})
            response.raise_for_status()
            body = response.json()
            latencies.append((time.perf_counter() - start) * 1000)
            return body

        for index in range(20):
            await request(f"linux-fixture-{index}")
        for _ in range(20):
            await request("linux-fixture-0")
        start = time.perf_counter()
        responses = await asyncio.gather(*(request(f"concurrent-fixture-{i}") for i in range(10)))
        concurrent_ms = (time.perf_counter() - start) * 1000
    ordered = sorted(latencies)
    report = {
        "mode": "fixture HTTP transport, 15ms delay per source; not live-provider measurements",
        "requests": len(latencies),
        "median_ms": round(statistics.median(latencies), 3),
        "p95_ms": round(ordered[int(len(ordered) * 0.95) - 1], 3),
        "concurrent_batch_requests": 10,
        "concurrent_batch_ms": round(concurrent_ms, 3),
        "concurrent_results": sum(len(r["results"]) for r in responses),
        "cache_hit_rate": service.metrics["cache_hits"] / service.metrics["requests"],
        "engine_failures": service.metrics["engine_errors"],
        "engine_timeouts": service.metrics["engine_timeouts"],
    }
    print(json.dumps(report, indent=2))
    await client.aclose()


if __name__ == "__main__":
    import httpx

    asyncio.run(main())
