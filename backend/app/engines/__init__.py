"""Independent adapters for documented public source APIs."""

from .sources import AdapterError, SearchEngine, create_engines

__all__ = ["AdapterError", "SearchEngine", "create_engines"]
