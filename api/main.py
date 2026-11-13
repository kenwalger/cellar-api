"""FastAPI application: HTTP routes for the Digital Cellar API."""

from fastapi import FastAPI, HTTPException

from api.models import Batch, BatchStatus, ErrorResponse, HealthResponse
from api.repository import get_batch, list_batches

app = FastAPI(
    title="Digital Cellar API",
    description=(
        "A small, read-only winery production API used as the teaching subject "
        "for *Understanding APIs: A Winery's Digital Cellar*. "
        "All data is fictional and illustrative."
    ),
    version="0.1.0",
)


@app.get(
    "/api/v1/health",
    response_model=HealthResponse,
    summary="Check that the API is running",
    tags=["health"],
)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get(
    "/api/v1/batches",
    response_model=list[Batch],
    summary="List production batches",
    description=(
        "Returns every batch, sorted by `batch_id`. "
        "Pass `status` to return only batches in that production stage."
    ),
    tags=["batches"],
)
def read_batches(status: BatchStatus | None = None) -> list[Batch]:
    return list_batches(status=status)


@app.get(
    "/api/v1/batches/{batch_id}",
    response_model=Batch,
    summary="Get one batch by ID",
    responses={404: {"model": ErrorResponse, "description": "Batch not found"}},
    tags=["batches"],
)
def read_batch(batch_id: str) -> Batch:
    batch = get_batch(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch
