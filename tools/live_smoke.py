"""Optional read-only live source verification; not part of deterministic CI.

From backend: uv run python ../tools/live_smoke.py
Each configured source receives one request. No query history or credential values are emitted.
"""

import asyncio
import json
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.engines import create_engines
from app.models import SearchQuery


async def main():
    async with httpx.AsyncClient(
        headers={"User-Agent": "LUMEN/2.0 (live readiness smoke)"}
    ) as client:

        async def check(engine):
            if not engine.configured:
                return {"engine": engine.id, "status": "unconfigured", "results": 0}
            start = time.perf_counter()
            try:
                async with asyncio.timeout(10):
                    results = await engine.search(SearchQuery(q="python", limit=3), client)
                return {
                    "engine": engine.id,
                    "status": "success",
                    "results": len(results),
                    "latency_ms": round((time.perf_counter() - start) * 1000, 3),
                }
            except Exception as error:  # noqa: BLE001 - isolate live source failures for the smoke report
                return {
                    "engine": engine.id,
                    "status": "failed",
                    "error_type": type(error).__name__,
                    "latency_ms": round((time.perf_counter() - start) * 1000, 3),
                }

        report = await asyncio.gather(*(check(engine) for engine in create_engines().values()))
        print(
            json.dumps(
                {
                    "mode": "live official provider APIs, one request per configured source",
                    "sources": report,
                },
                indent=2,
            )
        )
        return (
            0
            if sum(
                r["engine"] != "brave" and r["status"] == "success" and r.get("results", 0) > 0
                for r in report
            )
            >= 3
            else 1
        )


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
