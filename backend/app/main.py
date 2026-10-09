"""Privacy-first search API: no query logging, aggregate protected diagnostics."""

import asyncio
import hashlib
import hmac
import os
import time
from collections import OrderedDict, deque
from contextlib import asynccontextmanager
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.core.configuration import Configuration
from app.core.search import SearchService
from app.models import CompareRequest, SearchQuery, SearchResponse


def search_parameters() -> list[dict[str, Any]]:
    """Document the exact validator model, adapting arrays to the GET CSV boundary."""
    contract = SearchQuery.model_json_schema()
    parameters = []
    for name, original in contract["properties"].items():
        schema = original.copy()
        title = schema.pop("title", name.replace("_", " ").capitalize())
        description = title
        if schema.get("type") == "array":
            maximum = schema.get("maxItems", 20)
            schema = {"type": "string", "default": ""}
            description += f"; comma-separated values, at most {maximum} items"
        parameters.append(
            {
                "name": name,
                "in": "query",
                "required": name in contract.get("required", []),
                "schema": schema,
                "description": description,
            }
        )
    return parameters


def create_app(
    *,
    engines: dict[str, Any] | None = None,
    client: httpx.AsyncClient | None = None,
    diagnostics_token: str | None = None,
) -> FastAPI:
    config = Configuration.from_environment()
    if engines is None:
        from app.engines import create_engines

        engines = create_engines()
    token = (
        diagnostics_token if diagnostics_token is not None else os.getenv("LUMEN_DIAGNOSTICS_TOKEN")
    )
    outbound = client or httpx.AsyncClient(
        timeout=httpx.Timeout(
            config.engine_timeout_seconds, connect=min(3, config.engine_timeout_seconds)
        ),
        limits=httpx.Limits(
            max_connections=config.max_outbound_concurrency,
            max_keepalive_connections=config.max_outbound_concurrency,
        ),
        follow_redirects=False,
        headers={"User-Agent": "LUMEN/2.0 (privacy-first metasearch)"},
    )
    service = SearchService(
        engines,
        outbound,
        timeout=config.engine_timeout_seconds,
        overall_timeout=config.query_timeout_seconds,
        concurrency=config.max_outbound_concurrency,
        cache_size=config.cache_max_entries,
        cache_ttl=config.cache_ttl_seconds,
    )
    clients: OrderedDict[str, deque[float]] = OrderedDict()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        yield
        if client is None:
            await outbound.aclose()

    application = FastAPI(title="LUMEN", version="2.0.0", lifespan=lifespan)
    application.state.search_service = service

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        # Pydantic errors ordinarily echo the invalid input, including private query text.
        return JSONResponse(
            status_code=422,
            content={
                "detail": [
                    {"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]}
                    for item in error.errors()
                ]
            },
        )

    @application.middleware("http")
    async def privacy_and_limits(request: Request, call_next):
        if request.url.path.startswith("/api/v1/search"):
            # Forwarded headers are untrusted. An IP digest lives in memory for one minute only.
            now = time.monotonic()
            for old in list(clients):
                if not clients[old] or clients[old][-1] <= now - 60:
                    del clients[old]
            address = request.client.host if request.client else "unknown"
            identity = hashlib.sha256(address.encode()).hexdigest()
            history = clients.setdefault(identity, deque())
            clients.move_to_end(identity)
            while history and history[0] <= now - 60:
                history.popleft()
            if len(history) >= config.rate_limit_per_minute:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Request limit exceeded"},
                    headers={
                        "Retry-After": str(max(1, int(60 - (now - history[0])))),
                        "Cache-Control": "no-store",
                    },
                )
            history.append(now)
            while len(clients) > 4096:
                clients.popitem(last=False)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @application.get("/api/v1/health")
    async def health():
        return {"status": "ok", "version": "2.0.0"}

    @application.get("/api/v1/engines")
    async def engine_metadata():
        return {
            "engines": [
                {
                    "id": name,
                    "name": engine.name,
                    "categories": engine.categories,
                    "requires_auth": engine.requires_auth,
                    "configured": engine.configured,
                    "enabled": engine.enabled,
                    "filters": engine.filters,
                    "rate_limit_per_minute": engine.rate_limit_per_minute,
                }
                for name, engine in service.engines.items()
            ]
        }

    @application.get("/api/v1/categories")
    async def categories():
        names = ["general", "developer", "science", "news", "images", "videos", "maps", "files"]
        return {
            "categories": [
                {
                    "id": name,
                    "name": name.title(),
                    "available": any(
                        name in e.categories and e.configured and e.enabled
                        for e in service.engines.values()
                    ),
                    "engines": [
                        key
                        for key, e in service.engines.items()
                        if name in e.categories and e.configured and e.enabled
                    ],
                }
                for name in names
            ]
        }

    async def execute(query: SearchQuery) -> SearchResponse:
        if not query.engines and not any(
            query.category in engine.categories and engine.configured and engine.enabled
            for engine in service.engines.values()
        ):
            raise HTTPException(422, "No configured sources for this category")
        try:
            return await service.search(query)
        except ValueError:
            raise HTTPException(400, "Unknown engine selection") from None

    @application.get(
        "/api/v1/search",
        response_model=SearchResponse,
        openapi_extra={"parameters": search_parameters()},
    )
    async def search(request: Request):
        allowed = set(SearchQuery.model_fields)
        raw: dict[str, Any] = dict(request.query_params)
        if set(raw) - allowed:
            raise HTTPException(422, "Unknown query parameter")
        for field in ("engines", "site", "exclude_site", "preferred_domains"):
            if field in raw:
                raw[field] = [part.strip() for part in raw[field].split(",") if part.strip()]
        try:
            query = SearchQuery.model_validate(raw)
        except ValidationError:
            raise HTTPException(422, "Invalid search parameters") from None
        return await execute(query)

    @application.post("/api/v1/search/compare")
    async def compare(body: CompareRequest):
        try:
            left_query = SearchQuery(q=body.q, **body.left.model_dump())
            right_query = SearchQuery(q=body.q, **body.right.model_dump())
        except ValidationError:
            raise HTTPException(422, "Invalid comparison parameters") from None
        left, right = await asyncio.gather(execute(left_query), execute(right_query))
        a, b = {r.url for r in left.results}, {r.url for r in right.results}
        return {
            "left": left,
            "right": right,
            "shared": sorted(a & b),
            "left_only": sorted(a - b),
            "right_only": sorted(b - a),
            "overlap": len(a & b) / len(a | b) if a | b else 0,
        }

    @application.get("/api/v1/diagnostics")
    async def diagnostics(request: Request):
        if not token:
            raise HTTPException(404, "Not found")
        if not hmac.compare_digest(request.headers.get("authorization", ""), "Bearer " + token):
            raise HTTPException(403, "Forbidden")
        return {
            "metrics": service.diagnostics(),
            "cache_entries": len(service.cache),
            "configured_sources": sum(e.configured for e in service.engines.values()),
        }

    return application


app = create_app()
