from .base import AdapterError, SearchEngine, clean, safe_url
from .brave import Brave
from .commons import Commons
from .crossref import Crossref
from .github import GitHub
from .hackernews import HackerNews
from .wikipedia import Wikipedia

__all__ = [
    "AdapterError",
    "Brave",
    "Commons",
    "Crossref",
    "GitHub",
    "HackerNews",
    "SearchEngine",
    "Wikipedia",
    "clean",
    "create_engines",
    "safe_url",
]


def create_engines() -> dict[str, SearchEngine]:
    return {
        engine.id: engine
        for engine in [Wikipedia(), GitHub(), Crossref(), HackerNews(), Commons(), Brave()]
    }
