"""Load and query the mock batch data.

Nothing in this module knows about HTTP, so it can be tested on its own.
"""

import json
from functools import cache
from pathlib import Path

from pydantic import TypeAdapter

from api.models import Batch, BatchStatus

# Resolve relative to this file, not the process working directory.
DATA_FILE = Path(__file__).parent / "data" / "batches.json"

_batch_list_adapter = TypeAdapter(list[Batch])


def load_batches(path: Path = DATA_FILE) -> list[Batch]:
    """Read, validate, and sort batches from a JSON file.

    Raises pydantic.ValidationError for malformed records and ValueError
    for duplicate batch IDs.
    """
    raw = json.loads(path.read_text(encoding="utf-8"))
    batches = _batch_list_adapter.validate_python(raw)

    seen: set[str] = set()
    for batch in batches:
        if batch.batch_id in seen:
            raise ValueError(f"Duplicate batch_id in {path.name}: {batch.batch_id}")
        seen.add(batch.batch_id)

    return sorted(batches, key=lambda batch: batch.batch_id)


@cache
def _bundled_batches() -> tuple[Batch, ...]:
    """Load the bundled dataset once. A tuple keeps the cached data immutable."""
    return tuple(load_batches())


def list_batches(status: BatchStatus | None = None) -> list[Batch]:
    """Return all batches sorted by batch_id, optionally filtered by status."""
    batches = _bundled_batches()
    if status is None:
        return list(batches)
    return [batch for batch in batches if batch.status is status]


def get_batch(batch_id: str) -> Batch | None:
    """Return the batch with the given ID, or None if it does not exist."""
    for batch in _bundled_batches():
        if batch.batch_id == batch_id:
            return batch
    return None
