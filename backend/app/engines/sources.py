from .arxiv import Arxiv
from .base import SearchEngine
from .commons import Commons
from .crossref import Crossref
from .github import GitHub
from .hackernews import HackerNews
from .wikipedia import Wikipedia

__all__ = ["create_engines"]


def create_engines() -> dict[str, SearchEngine]:
    return {
        engine.id: engine
        for engine in [
            Wikipedia(),
            GitHub(),
            Crossref(),
            HackerNews(),
            Commons(),
            Arxiv(),
        ]
    }
