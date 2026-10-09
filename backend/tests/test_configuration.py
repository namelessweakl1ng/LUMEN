import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.configuration import Configuration
from app.main import create_app
from tests.test_core import Engine


def test_environment_configuration_and_bounds(monkeypatch):
    monkeypatch.setenv("LUMEN_CACHE_MAX_ENTRIES", "2")
    monkeypatch.setenv("LUMEN_RATE_LIMIT_PER_MINUTE", "1")
    assert Configuration.from_environment().cache_max_entries == 2
    with TestClient(create_app(engines={"fake": Engine()})) as client:
        assert client.get("/api/v1/search", params={"q": "python"}).status_code == 200
        assert client.get("/api/v1/search", params={"q": "python"}).status_code == 429
        assert client.app.state.search_service.cache.size == 2
    monkeypatch.setenv("LUMEN_MAX_OUTBOUND_CONCURRENCY", "0")
    with pytest.raises(ValidationError):
        Configuration.from_environment()


@pytest.mark.parametrize(
    "name,value",
    [
        ("LUMEN_CACHE_TTL_SECONDS", "nan"),
        ("LUMEN_QUERY_TIMEOUT_SECONDS", "-1"),
        ("LUMEN_CACHE_MAX_ENTRIES", "5000"),
        ("LUMEN_ENGINE_TIMEOUT_SECONDS", "infinity"),
    ],
)
def test_invalid_values_fail_closed(monkeypatch, name, value):
    monkeypatch.setenv(name, value)
    with pytest.raises(ValidationError):
        Configuration.from_environment()
