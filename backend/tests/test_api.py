from fastapi.testclient import TestClient

from app.main import create_app
from tests.test_core import Engine


def signed_identity(identity, secret, timestamp=None):
    import hashlib
    import hmac
    import time

    timestamp = str(int(time.time()) if timestamp is None else timestamp)
    signature = hmac.new(
        secret.encode(), f"request:{identity}:{timestamp}".encode(), hashlib.sha256
    ).hexdigest()
    return {"X-Lumen-Identity": f"{identity}.{timestamp}.{signature}"}


def test_signed_proxy_sessions_have_separate_limits(monkeypatch):
    secret = "s" * 32
    monkeypatch.setenv("LUMEN_PROXY_SECRET", secret)
    monkeypatch.setenv("LUMEN_RATE_LIMIT_PER_MINUTE", "2")
    with TestClient(create_app(engines={"fake": Engine()})) as client:
        first = signed_identity("a" * 32, secret)
        second = signed_identity("b" * 32, secret)
        for _ in range(2):
            assert client.get("/api/v1/search?q=python", headers=first).status_code == 200
        assert client.get("/api/v1/search?q=python", headers=first).status_code == 429
        assert client.get("/api/v1/search?q=python", headers=second).status_code == 200


def test_forged_and_expired_proxy_identity_cannot_rotate_limit(monkeypatch):
    import time

    secret = "s" * 32
    monkeypatch.setenv("LUMEN_PROXY_SECRET", secret)
    monkeypatch.setenv("LUMEN_RATE_LIMIT_PER_MINUTE", "2")
    with TestClient(create_app(engines={"fake": Engine()})) as client:
        forged = signed_identity("a" * 32, "wrong")
        expired = signed_identity("b" * 32, secret, int(time.time()) - 120)
        assert client.get("/api/v1/search?q=python", headers=forged).status_code == 200
        assert client.get("/api/v1/search?q=python", headers=expired).status_code == 200
        assert (
            client.get(
                "/api/v1/search?q=python", headers={"X-Forwarded-For": "203.0.113.2"}
            ).status_code
            == 429
        )


def test_fresh_sessions_cannot_bypass_aggregate_proxy_ceiling(monkeypatch):
    secret = "s" * 32
    monkeypatch.setenv("LUMEN_PROXY_SECRET", secret)
    monkeypatch.setenv("LUMEN_PROXY_PEER_RATE_LIMIT_PER_MINUTE", "2")
    with TestClient(create_app(engines={"fake": Engine()})) as client:
        for identity in ["a" * 32, "b" * 32]:
            assert (
                client.get(
                    "/api/v1/search?q=python", headers=signed_identity(identity, secret)
                ).status_code
                == 200
            )
        assert (
            client.get(
                "/api/v1/search?q=python", headers=signed_identity("c" * 32, secret)
            ).status_code
            == 429
        )


def test_routes_and_privacy():
    with TestClient(create_app(engines={"fake": Engine()}, diagnostics_token="secret")) as client:
        assert client.get("/api/v1/health").status_code == 200
        assert client.get("/api/v1/search", params={"q": " "}).status_code == 422
        assert (
            client.get("/api/v1/search", params={"q": "x", "engines": "unknown"}).status_code == 400
        )
        assert client.get("/api/v1/diagnostics").status_code == 403
        response = client.get("/api/v1/search", params={"q": "private python"})
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        metrics = client.get(
            "/api/v1/diagnostics", headers={"Authorization": "Bearer secret"}
        ).json()
        assert "private" not in str(metrics)
        assert "python" not in str(metrics)
        comparison = client.post(
            "/api/v1/search/compare",
            json={"q": "python", "left": {"engines": ["fake"]}, "right": {"engines": ["fake"]}},
        )
        assert comparison.status_code == 200
        assert comparison.json()["overlap"] == 1


def test_diagnostics_disabled():
    with TestClient(create_app(engines={})) as client:
        assert client.get("/api/v1/diagnostics").status_code == 404


def test_comparison_profiles_allow_default_sources_and_filters():
    with TestClient(create_app(engines={"fake": Engine()})) as client:
        response = client.post(
            "/api/v1/search/compare",
            json={
                "q": "python",
                "left": {"engines": [], "ranking": "relevance", "site": ["example.com"]},
                "right": {"engines": [], "ranking": "balanced", "exclude_site": ["example.com"]},
            },
        )
        assert response.status_code == 200
        assert response.json()["left"]["results"]
        assert not response.json()["right"]["results"]


def test_errors_do_not_echo_private_body_and_ip_headers_are_untrusted():
    with TestClient(create_app(engines={"fake": Engine()})) as client:
        response = client.post(
            "/api/v1/search/compare",
            json={"q": "my private query", "left": {"safe_search": 99}, "right": {}},
        )
        assert response.status_code == 422
        assert "my private query" not in response.text
        for number in range(121):
            response = client.get(
                "/api/v1/search",
                params={"q": "same cached"},
                headers={"X-Forwarded-For": f"192.0.2.{number}"},
            )
        assert response.status_code == 429
        assert "Retry-After" in response.headers


def test_unavailable_category_is_distinct_from_successful_empty_search():
    with TestClient(create_app(engines={"fake": Engine()})) as client:
        response = client.get("/api/v1/search", params={"q": "python", "category": "maps"})
        assert response.status_code == 422
        assert response.json()["detail"] == "No configured sources for this category"


def test_openapi_documents_validated_get_search_parameters():
    with TestClient(create_app(engines={"fake": Engine()})) as client:
        operation = client.get("/openapi.json").json()["paths"]["/api/v1/search"]["get"]
        parameters = {parameter["name"]: parameter for parameter in operation["parameters"]}
        assert parameters["q"]["required"]
        assert "science" in parameters["category"]["schema"]["enum"]
        assert parameters["engines"]["schema"]["type"] == "string"
        assert parameters["limit"]["schema"]["maximum"] == 50
        assert parameters["page"]["schema"]["maximum"] == 20
