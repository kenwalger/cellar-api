# Learning Lab

**The document automation lab is in [`docs/lab/`](lab/README.md)** (Phase 5). It has five local exercises that need no Google account, one optional Google Docs exercise, an [evidence and screenshot guide](lab/evidence/README.md), [troubleshooting](lab/troubleshooting.md), and a [maintainer and instructor guide](lab/maintainers.md). The published-site entry point is [`docs/index.md`](index.md).

This page used to hold the lab's planning outline. Its exercises have moved:

| Former outline exercise | Now |
|---|---|
| 3: Explore the structured master script | [Exercise 1: Inspect the source](lab/01-inspect-the-source.md) |
| 4: Parse the master script and break it | [Exercise 2: Parse and validate](lab/02-parse-and-validate.md) and [Exercise 3: Break the contract](lab/03-break-the-contract.md) |
| 5: Generate production documents from a Google Doc | [Exercise 6: Generate the Google Docs](lab/06-google-docs-extension.md) |
| 6: Change the speaking rate, and 7: Add a screencast allowance | [Exercise 4: Estimate production](lab/04-estimate-production.md), offline. Exercise 6 has the same changes in Google Docs. |
| 8: Compare the Production Summary with the manifest | [Exercise 5: Provenance and regeneration](lab/05-provenance-and-regeneration.md) |
| Evidence and screenshot checklist | [Evidence guide](lab/evidence/README.md) |

## The winery API (outside the lab)

The lab teaches document automation, not the API. If you'd like to explore the API the course is about, these two activities don't depend on the lab:

1. **Run it and explore it in Swagger UI.** Follow [Running the API](../README.md#running-the-api), open <http://127.0.0.1:8000/docs>, and try `GET /api/v1/batches?status=fermenting`, an unknown batch ID (404), and `status=spilled` (422).
2. **Read the tests and add one.** Read [`tests/test_api.py`](../tests/test_api.py) and [`tests/test_repository.py`](../tests/test_repository.py), add a test for an edge case of your choice, and run `uv run pytest`.

Useful screenshots for an article about the API include Swagger UI with the three endpoints, a 200 response for `?status=fermenting`, a 404 for an unknown batch, a 422 for an unsupported status, and passing `uv run pytest` output. None have been captured yet.
