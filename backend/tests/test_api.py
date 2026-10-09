from fastapi.testclient import TestClient

from app.main import create_app
from tests.test_core import Engine


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
