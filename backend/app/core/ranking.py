"""Deterministic explainable result aggregation."""

import hashlib
import re
from datetime import UTC, datetime
from urllib.parse import urlsplit

from app.core.urls import canonical_url, matches
from app.models import SearchQuery, SearchResult


def rank_results(
    query: SearchQuery,
    batches: list[tuple[str, list[SearchResult]]],
    *,
    now: datetime | None = None,
    upstream_time_sources: set[str] | None = None,
) -> list[SearchResult]:
    upstream_time_sources = upstream_time_sources or set()
    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)
    merged: dict[str, SearchResult] = {}
    for name, results in batches:
        for upstream_rank, result in enumerate(results, 1):
            url = canonical_url(result.url)
            if not url:
                continue
            domain = urlsplit(url).hostname or ""
            if (
                query.site
                and not matches(domain, query.site)
                or matches(domain, query.exclude_site)
            ):
                continue
            if query.file_type and not urlsplit(url).path.lower().endswith("." + query.file_type):
                continue
            published = result.published_at
            if published and published.tzinfo is None:
                published = published.replace(tzinfo=UTC)
            days = {"day": 1, "week": 7, "month": 30, "year": 365}.get(query.time_range)
            age = max((now - published).total_seconds() / 86400, 0) if published else None
            if days and name not in upstream_time_sources and (age is None or age > days):
                continue
            if url in merged:
                existing = merged[url]
                if name not in existing.source_engines:
                    existing.source_engines.append(name)
                if len(result.snippet) > len(existing.snippet):
                    existing.snippet = result.snippet
                if not existing.thumbnail_url:
                    existing.thumbnail_url = result.thumbnail_url
                if not existing.published_at:
                    existing.published_at = result.published_at
                for field, value in result.metadata.items():
                    current = existing.metadata.get(field)
                    if field in {"authors", "venues"} and isinstance(value, list):
                        prior = current if isinstance(current, list) else []
                        existing.metadata[field] = sorted(
                            {item for item in prior + value if isinstance(item, str)}
                        )
                    elif current is None or current == "" or current == []:
                        existing.metadata[field] = value
                continue
            item = result.model_copy(deep=True)
            item.url, item.domain = url, domain
            item.id = hashlib.sha256(url.encode()).hexdigest()[:20]
            item.source_engines = [name]
            item.metadata["source_position"] = 1 / upstream_rank
            merged[url] = item
    for item in merged.values():
        tokens = set(re.findall(r"\w+", query.q.lower()))
        haystack = set(re.findall(r"\w+", (item.title + " " + item.snippet).lower()))
        relevance = len(tokens & haystack) / max(len(tokens), 1)
        published = item.published_at
        if published and published.tzinfo is None:
            published = published.replace(tzinfo=UTC)
        age = max((now - published).total_seconds() / 86400, 0) if published else None
        recency = 1 / (1 + age / 30) if age is not None else 0
        preference = 1.0 if matches(item.domain, query.preferred_domains) else 0
        position = float(item.metadata.pop("source_position", 0))
        weights = {
            "balanced": (0.55, 0.15, 0.2, 0.1),
            "relevance": (0.8, 0.0, 0.15, 0.05),
            "recency": (0.25, 0.6, 0.1, 0.05),
        }[query.ranking]
        item.score = round(
            sum(a * b for a, b in zip(weights, (relevance, recency, position, preference))),
            6,
        )
        item.ranking_explanation = {
            "relevance": relevance,
            "recency": recency,
            "source_position": position,
            "domain_preference": preference,
            "weights": dict(
                zip(
                    ("relevance", "recency", "source_position", "domain_preference"),
                    weights,
                )
            ),
            "strategy": query.ranking,
            "source_agreement": len(item.source_engines),
            "agreement_bonus": min(len(item.source_engines) - 1, 3) * 0.05,
        }
        item.score = round(item.score + min(len(item.source_engines) - 1, 3) * 0.05, 6)
    ranked = sorted(merged.values(), key=lambda item: (-item.score, item.url))
    for rank, item in enumerate(ranked, 1):
        item.rank = rank
    return ranked
