# CLAUDE.md

Guidance for Claude Code (and other coding agents) working in this repository. **Read this file before making changes.**

## Project purpose

This is an open-source learning lab about document automation. A structured master Google Doc (a video course script) will eventually be parsed into four production documents: ONSET, MOTION, SCREENCAST, and a Production Summary.

The fictional course is *Understanding APIs: A Winery's Digital Cellar*. The FastAPI app in `api/` is the **subject** of that course. It's a teaching fixture, not a product. Keep it small, readable, and deterministic.

## Current implementation status

| Phase | Scope | Status |
|---|---|---|
| 1 | Repository foundation, FastAPI app, mock data, tests, docs | **Implemented** |
| 2 | Master course script (six videos) | Planned, not started |
| 3 | Google Apps Script document parser | Planned, not started |
| 4 | Production Summary doc and learning lab | Planned, not started |

`course/`, `apps-script/`, and `docs/screenshots/` contain placeholders only. Don't describe planned work as done, and don't claim an unimplemented feature works.

## Commands

```bash
uv sync                                # install from uv.lock
uv run uvicorn api.main:app --reload   # run the API on http://127.0.0.1:8000
uv run pytest                          # run tests
uv run ruff check .                    # lint
uv run ruff format --check .           # check formatting (CI runs this)
uv run ruff format .                   # apply formatting
```

## Repository layout

```text
api/
  models.py        Pydantic models; BatchStatus enum
  repository.py    Loads/validates api/data/batches.json; list/filter/get functions
  main.py          FastAPI app and routes, HTTP concerns only
  data/batches.json  12 fictional batches
tests/
  test_api.py         Endpoint tests (TestClient, no running server)
  test_repository.py  Data-layer tests, independent of HTTP
course/            Phase 2 placeholder
apps-script/       Phase 3 placeholder
docs/              architecture.md, roadmap.md, learning-lab.md, screenshots/
.github/           CI workflow, issue and PR templates
```

## Implemented API

- `GET /api/v1/health` returns `{"status": "ok"}`.
- `GET /api/v1/batches` returns all batches sorted by `batch_id`. The optional `status` filter takes one of `planned | fermenting | aging | bottled`. Anything else returns 422. A valid status with no matches returns `[]`.
- `GET /api/v1/batches/{batch_id}` returns one batch, or 404 with `{"detail": "Batch not found"}`.
- FastAPI's `/docs`, `/redoc`, and `/openapi.json` are kept.
- The API is read-only. There are no write endpoints.

## Coding conventions

- Python 3.11+ with modern annotations (`X | None`, `list[T]`, `StrEnum`).
- Keep HTTP logic in `main.py` and data access in `repository.py`. Repository functions must not import FastAPI.
- Prefer clear, plain functions. Don't add service layers, DI frameworks, plugin systems, or base classes.
- Fail loudly. Malformed data must raise an error, not be skipped. Don't swallow exceptions.
- Resolve file paths relative to `__file__`, never the working directory.
- Use descriptive names and short functions, and add docstrings where they help a beginner.
- Ruff settings live in `pyproject.toml`. Code must pass `ruff check` and `ruff format --check`.

## Deterministic behavior

- Batch listings are always sorted by `batch_id`.
- The dataset must stay at exactly 12 batches, with unique IDs and at least one `null` temperature. Tests enforce this. If you change the count, update the tests and docs in the same change, and only with approval.
- No randomness, clocks, or network calls in the API or tests.
- Mock data is illustrative. Don't add winemaking science or claims about ideal temperatures.

## Scope boundaries

Don't add any of the following without explicit approval from the maintainer:

- Databases, ORMs, or persistence
- Authentication or authorization
- Write endpoints
- Docker, Kubernetes, or cloud infrastructure
- AI or LLM integrations
- Frontend frameworks
- External API dependencies
- New runtime dependencies
- Deployment or publishing workflows

Don't start a later phase's work unless asked.

## Testing expectations

- Every behavior change comes with a test. Write the test first where practical.
- Tests must not need a running server, network access, or a database.
- Test data-layer behavior in `test_repository.py` and HTTP behavior in `test_api.py`.
- Run `uv run pytest`, `uv run ruff check .`, and `uv run ruff format --check .` before you report work as done.
- **Never invent or paraphrase test results.** Report only what you actually ran, including failures. If you skipped a check, say so.

## Authorship and attribution

- The author and copyright holder is **Ken W. Alger**. Use that exact name everywhere it appears: LICENSE, README, `pyproject.toml`, and any new files.
- **Don't add AI or co-author attribution.** Commit messages, pull request descriptions, and files must not include `Co-Authored-By` trailers, "Generated with Claude Code" lines, or similar AI attribution.
- The maintainer runs git commands manually. When asked for a commit message, write it to `commit-message.txt` (which is gitignored) and don't run any git commands.

## Documentation maintenance

When behavior changes, update in the same change: `README.md` (endpoints, examples), this file (status, layout), `docs/architecture.md`, and `CHANGELOG.md` (Unreleased). Example responses in the README must match real API output.

## Planned document automation architecture (not implemented)

Phases 3 and 4 plan the following pipeline. **None of it exists yet.**

1. **Master Google Doc**: the authored course script, with sections tagged `[ONSET]`, `[MOTION]`, and `[SCREENCAST]`.
2. **Structured document parser**: Google Apps Script that reads the doc's headings, tags, and body.
3. **Intermediate representation**: a plain data structure (course → videos → tagged sections) that separates parsing from output.
4. **Structural validation**: checks for missing or unknown tags, empty sections, out-of-order videos, and similar problems. Findings are reported, not silently fixed.
5. **Four output generators**: ONSET, MOTION, and SCREENCAST docs, plus a Production Summary with approximate durations, content statistics, and a configurable long-video threshold.
6. **Generation manifest**: a record of what was generated, from which source, and any validation findings.

The design may change when it's implemented. Treat this section as intent, not a spec.
