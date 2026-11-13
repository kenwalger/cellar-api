"""Pydantic models describing the data the API returns."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class BatchStatus(StrEnum):
    """The production stages a batch can be in."""

    PLANNED = "planned"
    FERMENTING = "fermenting"
    AGING = "aging"
    BOTTLED = "bottled"


class Batch(BaseModel):
    """One wine production batch."""

    # Reject unexpected keys so typos in the mock data fail loudly.
    model_config = ConfigDict(extra="forbid")

    batch_id: str = Field(description="Unique identifier, e.g. 2026-014.")
    name: str = Field(description="Human-friendly batch name.")
    varietal: str = Field(description="Grape variety, e.g. Pinot Noir.")
    vintage: int = Field(description="Harvest year.")
    status: BatchStatus = Field(description="Current production stage.")
    temperature_c: float | None = Field(
        description="Latest recorded temperature in Celsius, or null if not recorded."
    )
    days_since_start: int = Field(ge=0, description="Days since the batch started.")


class HealthResponse(BaseModel):
    """Response body for the health check."""

    status: str = Field(description="Always 'ok' when the API is running.")


class ErrorResponse(BaseModel):
    """Response body returned for errors such as a missing batch."""

    detail: str
