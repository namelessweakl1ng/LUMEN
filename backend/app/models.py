"""Public API contracts; query validation happens before any upstream request."""

import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Category = Literal["general", "developer", "science", "news", "images", "videos", "maps", "files"]


class SearchQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    q: str = Field(min_length=1, max_length=500)
    category: Category = "general"
    engines: list[str] = Field(default_factory=list, max_length=20)
    language: str = "en"
    time_range: Literal["none", "day", "week", "month", "year"] = "none"
    safe_search: int = Field(default=1, ge=0, le=2)
    page: int = Field(default=1, ge=1, le=20)
    limit: int = Field(default=20, ge=1, le=50)
    site: list[str] = Field(default_factory=list, max_length=20)
    exclude_site: list[str] = Field(default_factory=list, max_length=20)
    file_type: str | None = None
    ranking: Literal["balanced", "relevance", "recency"] = "balanced"
    preferred_domains: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("q")
    @classmethod
    def clean_query(cls, value: str) -> str:
        value = value.strip()
        if not value or any(ord(char) < 32 for char in value):
            raise ValueError("query must contain text without control characters")
        return value

    @field_validator("site", "exclude_site", "preferred_domains")
    @classmethod
    def domains(cls, values: list[str]) -> list[str]:
        normalized = [v.lower().strip().rstrip(".") for v in values]
        if any(
            not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", v)
            for v in normalized
        ):
            raise ValueError("filters require domain names, without schemes or paths")
        return sorted(set(normalized))

    @field_validator("language")
    @classmethod
    def language_code(cls, value: str) -> str:
        if not re.fullmatch(r"[a-z]{2,3}(?:-[A-Za-z]{2,4})?", value):
            raise ValueError("invalid language code")
        return value

    @field_validator("engines")
    @classmethod
    def engine_ids(cls, values: list[str]) -> list[str]:
        if any(not re.fullmatch(r"[a-z][a-z0-9_-]{0,39}", v) for v in values):
            raise ValueError("invalid engine identifier")
        return sorted(set(values))

    @field_validator("file_type")
    @classmethod
    def extension(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(r"[a-z0-9]{1,10}", value):
            raise ValueError("invalid file extension")
        return value


class SearchResult(BaseModel):
    id: str = ""
    title: str = Field(max_length=1000)
    url: str = Field(max_length=4096)
    domain: str = ""
    snippet: str = Field(default="", max_length=10000)
    category: str = "general"
    source_engines: list[str] = Field(default_factory=list)
    published_at: datetime | None = None
    thumbnail_url: str | None = None
    score: float = 0
    rank: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)
    ranking_explanation: dict[str, Any] = Field(default_factory=dict)


class EngineStatus(BaseModel):
    engine: str
    status: Literal["success", "error", "timeout", "rate_limited", "unavailable"]
    latency_ms: float = 0
    message: str | None = None


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    result_count: int
    category: str
    page: int
    limit: int
    has_more: bool
    timing_ms: float
    engine_status: list[EngineStatus]
    partial: bool = False
    cached: bool = False
    applied_filters: dict[str, Any] = Field(default_factory=dict)
    suggestions: list[str] = Field(default_factory=list)


class CompareSide(SearchQuery):
    # Inherit the exact search validation; the top-level comparison supplies q.
    q: str = Field(default="comparison", exclude=True)


class CompareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    q: str
    left: CompareSide
    right: CompareSide
