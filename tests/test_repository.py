"""Tests for the data-access layer, independent of HTTP."""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from api.models import Batch, BatchStatus
from api.repository import (
    DATA_FILE,
    get_batch,
    list_batches,
    load_batches,
)

EXPECTED_BATCH_COUNT = 12


def test_load_batches_returns_expected_count() -> None:
    assert len(load_batches()) == EXPECTED_BATCH_COUNT


def test_every_batch_id_is_unique() -> None:
    batch_ids = [batch.batch_id for batch in load_batches()]
    assert len(batch_ids) == len(set(batch_ids))


def test_dataset_contains_a_null_temperature() -> None:
    assert any(batch.temperature_c is None for batch in load_batches())


def test_raw_records_satisfy_the_schema() -> None:
    raw_records = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    for record in raw_records:
        Batch.model_validate(record)


def test_dataset_uses_more_than_one_status() -> None:
    statuses = {batch.status for batch in load_batches()}
    assert len(statuses) > 1


def test_loading_does_not_depend_on_working_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    assert len(load_batches()) == EXPECTED_BATCH_COUNT


def test_list_batches_is_sorted_by_batch_id() -> None:
    batch_ids = [batch.batch_id for batch in list_batches()]
    assert batch_ids == sorted(batch_ids)


def test_list_batches_filters_by_status() -> None:
    batches = list_batches(status=BatchStatus.AGING)
    assert batches
    assert all(batch.status is BatchStatus.AGING for batch in batches)


def test_get_batch_returns_matching_record() -> None:
    batch = get_batch("2026-014")
    assert batch is not None
    assert batch.name == "North Block Pinot Noir"


def test_get_batch_returns_none_for_unknown_id() -> None:
    assert get_batch("1999-000") is None


def test_load_batches_rejects_malformed_record(tmp_path: Path) -> None:
    bad_file = tmp_path / "batches.json"
    bad_file.write_text(
        json.dumps([{"batch_id": "2026-001", "name": "Missing fields"}]),
        encoding="utf-8",
    )
    with pytest.raises(ValidationError):
        load_batches(bad_file)


def test_load_batches_rejects_unknown_status(tmp_path: Path) -> None:
    bad_file = tmp_path / "batches.json"
    record = {
        "batch_id": "2026-001",
        "name": "Mystery Batch",
        "varietal": "Merlot",
        "vintage": 2026,
        "status": "evaporated",
        "temperature_c": 18.0,
        "days_since_start": 3,
    }
    bad_file.write_text(json.dumps([record]), encoding="utf-8")
    with pytest.raises(ValidationError):
        load_batches(bad_file)


def test_load_batches_rejects_duplicate_ids(tmp_path: Path) -> None:
    record = {
        "batch_id": "2026-001",
        "name": "Twin Batch",
        "varietal": "Syrah",
        "vintage": 2026,
        "status": "planned",
        "temperature_c": None,
        "days_since_start": 0,
    }
    bad_file = tmp_path / "batches.json"
    bad_file.write_text(json.dumps([record, record]), encoding="utf-8")
    with pytest.raises(ValueError, match="Duplicate batch_id"):
        load_batches(bad_file)
