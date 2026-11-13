"""HTTP-level tests using FastAPI's TestClient (no running server needed)."""

import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health_returns_200(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200


def test_health_response_body(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.json() == {"status": "ok"}


def test_list_batches_returns_twelve_records(client: TestClient) -> None:
    response = client.get("/api/v1/batches")
    assert response.status_code == 200
    assert len(response.json()) == 12


def test_list_batches_is_sorted_by_batch_id(client: TestClient) -> None:
    batch_ids = [batch["batch_id"] for batch in client.get("/api/v1/batches").json()]
    assert batch_ids == sorted(batch_ids)


def test_filter_by_fermenting_returns_only_fermenting(client: TestClient) -> None:
    response = client.get("/api/v1/batches", params={"status": "fermenting"})
    batches = response.json()
    assert response.status_code == 200
    assert batches
    assert all(batch["status"] == "fermenting" for batch in batches)


def test_filter_results_are_sorted(client: TestClient) -> None:
    response = client.get("/api/v1/batches", params={"status": "bottled"})
    batch_ids = [batch["batch_id"] for batch in response.json()]
    assert batch_ids == sorted(batch_ids)


def test_unsupported_status_returns_422(client: TestClient) -> None:
    response = client.get("/api/v1/batches", params={"status": "spilled"})
    assert response.status_code == 422


def test_status_filter_is_case_sensitive(client: TestClient) -> None:
    response = client.get("/api/v1/batches", params={"status": "Fermenting"})
    assert response.status_code == 422


def test_valid_filter_with_no_matches_returns_empty_list(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The bundled dataset has every status, so simulate a dataset
    # where "planned" has no matches.
    from api import main

    monkeypatch.setattr(main, "list_batches", lambda status=None: [])
    response = client.get("/api/v1/batches", params={"status": "planned"})
    assert response.status_code == 200
    assert response.json() == []


def test_get_existing_batch(client: TestClient) -> None:
    response = client.get("/api/v1/batches/2026-014")
    assert response.status_code == 200
    assert response.json() == {
        "batch_id": "2026-014",
        "name": "North Block Pinot Noir",
        "varietal": "Pinot Noir",
        "vintage": 2026,
        "status": "fermenting",
        "temperature_c": 21.4,
        "days_since_start": 8,
    }


def test_get_missing_batch_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/batches/1999-000")
    assert response.status_code == 404


def test_missing_batch_error_message(client: TestClient) -> None:
    response = client.get("/api/v1/batches/1999-000")
    assert response.json() == {"detail": "Batch not found"}


def test_null_temperature_is_serialized_as_null(client: TestClient) -> None:
    batches = client.get("/api/v1/batches").json()
    assert any(batch["temperature_c"] is None for batch in batches)


def test_openapi_schema_lists_endpoints(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/health" in paths
    assert "/api/v1/batches" in paths
    assert "/api/v1/batches/{batch_id}" in paths


@pytest.mark.parametrize("path", ["/docs", "/redoc"])
def test_interactive_docs_are_available(client: TestClient, path: str) -> None:
    response = client.get(path)
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_no_write_endpoints(client: TestClient) -> None:
    response = client.post("/api/v1/batches", json={})
    assert response.status_code == 405
