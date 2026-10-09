"""Size and lifetime bounded in-memory cache with hashed complete query identity."""

import hashlib
import time
from collections import OrderedDict

from app.models import SearchQuery, SearchResponse


class SearchCache:
    def __init__(self, size: int, ttl: float):
        self.size = max(size, 0)
        self.ttl = max(ttl, 0)
        self.entries: OrderedDict[str, tuple[float, SearchResponse]] = OrderedDict()

    def __len__(self) -> int:
        return len(self.entries)

    def get(self, query: SearchQuery) -> SearchResponse | None:
        now = time.monotonic()
        for key in list(self.entries):
            if self.entries[key][0] <= now:
                del self.entries[key]
        key = hashlib.sha256(query.model_dump_json().encode()).hexdigest()
        value = self.entries.get(key)
        if not value:
            return None
        self.entries.move_to_end(key)
        return value[1].model_copy(deep=True)

    def put(self, query: SearchQuery, response: SearchResponse) -> None:
        if not self.size:
            return
        key = hashlib.sha256(query.model_dump_json().encode()).hexdigest()
        self.entries[key] = (time.monotonic() + self.ttl, response.model_copy(deep=True))
        self.entries.move_to_end(key)
        while len(self.entries) > self.size:
            self.entries.popitem(last=False)
