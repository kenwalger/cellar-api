# Winery API Document Automation Lab

An open-source learning lab about **turning one structured master document into several production documents**.

The running example is a fictional video course, *Understanding APIs: A Winery's Digital Cellar*. The course teaches API basics using a small winery production API, and that API lives in this repository.

To be clear about what's what:

- **The winery API is the subject of the course.** It's a deliberately small teaching fixture, not a winery management system.
- **Document automation is what this lab teaches.** The eventual goal is to parse a master course script (a Google Doc) into four separate Google Docs:
  1. **ONSET**: presenter narration and teleprompter content.
  2. **MOTION**: motion graphics instructions and voiceover.
  3. **SCREENCAST**: screen recording instructions and narration.
  4. **Production Summary**: per-video duration estimates, content statistics, and configurable long-video warnings.

> **Status: Phase 3A complete.** The FastAPI application, the master course script, and a portable JavaScript parser that validates the script exist today. The parser runs in Node.js. The Google Apps Script integration, document generation, and Production Summary are planned, not built. See [docs/roadmap.md](docs/roadmap.md).

## What's in the repository

- A read-only FastAPI app with three endpoints.
- 12 fictional wine production batches in a JSON file, validated with Pydantic.
- A pytest suite covering the endpoints and the data layer.
- Ruff linting and formatting, run in GitHub Actions.
- A six-video master course script, [`course/master-script.md`](course/master-script.md), tagged with `[ONSET]`, `[MOTION]`, and `[SCREENCAST]` sections. See [course/README.md](course/README.md) for its grammar.
- Parser test fixtures: an expected-structure oracle and isolated malformed-script cases in [`course/fixtures/`](course/fixtures/).
- A dependency-free JavaScript parser, [`parser/`](parser/README.md). It turns the script into a structured intermediate representation with source line numbers, reports structural problems as diagnostics, and is tested with Node's built-in test runner.
- Project documentation and a placeholder directory for the Apps Script tooling.

## Architecture

```text
api/
├── models.py       Pydantic models and the BatchStatus enum
├── repository.py   Loads, validates, and queries api/data/batches.json
├── main.py         FastAPI app and routes (HTTP only)
└── data/
    └── batches.json
parser/
├── src/production-script.cjs   portable parser core (no Node or browser APIs)
├── src/index.js                Node.js ESM entry point
└── tests/                      node:test suites
```

Routes in `main.py` call plain functions in `repository.py`. The repository has no HTTP dependencies, so it can be tested on its own. The parser is independent of the API. It reads production-script text and returns an IR and diagnostics. See [docs/architecture.md](docs/architecture.md) for more detail and for the planned Google Docs workflow.

## Prerequisites

- Python 3.11 or newer (`.python-version` pins 3.12 for local development)
- [uv](https://docs.astral.sh/uv/)
- Node.js 22 or newer, for the parser only. There are no npm packages to install.

You don't need a database, a network connection, or any external service.

## Installation

```bash
uv sync
```

This creates `.venv/` and installs the exact versions recorded in `uv.lock`.

## Running the API

```bash
uv run uvicorn api.main:app --reload
```

The API listens on `http://127.0.0.1:8000`.

### Interactive documentation

FastAPI generates the documentation from the code:

- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>
- OpenAPI schema: <http://127.0.0.1:8000/openapi.json>

In Swagger UI, open an endpoint, click **Try it out**, then **Execute** to send a real request.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/health` | Returns `{"status": "ok"}` |
| GET | `/api/v1/batches` | Lists all batches, sorted by `batch_id`. Optional `status` filter. |
| GET | `/api/v1/batches/{batch_id}` | Returns one batch, or 404 if it doesn't exist |

The API is read-only. There are no write endpoints.

### Example requests

**Health check**

```bash
curl http://127.0.0.1:8000/api/v1/health
```

```json
{"status": "ok"}
```

**Filter batches by status**

```bash
curl "http://127.0.0.1:8000/api/v1/batches?status=fermenting"
```

```json
[
  {
    "batch_id": "2026-005",
    "name": "East Terrace Chardonnay",
    "varietal": "Chardonnay",
    "vintage": 2026,
    "status": "fermenting",
    "temperature_c": 17.3,
    "days_since_start": 12
  },
  ...
]
```

Supported `status` values: `planned`, `fermenting`, `aging`, `bottled`. Matching is exact and case-sensitive. Any other value returns **422 Unprocessable Entity**. A valid status with no matching batches returns `[]`.

**Get one batch**

```bash
curl http://127.0.0.1:8000/api/v1/batches/2026-014
```

```json
{
  "batch_id": "2026-014",
  "name": "North Block Pinot Noir",
  "varietal": "Pinot Noir",
  "vintage": 2026,
  "status": "fermenting",
  "temperature_c": 21.4,
  "days_since_start": 8
}
```

**Missing batch**

```bash
curl -i http://127.0.0.1:8000/api/v1/batches/1999-000
```

```text
HTTP/1.1 404 Not Found
...
{"detail": "Batch not found"}
```

## About the data

`api/data/batches.json` holds 12 fictional batches across six varietals and four production statuses. Names, numbers, and temperatures are illustrative. **They are not winemaking guidance** and make no claim about real fermentation or storage practice. A `temperature_c` of `null` means no reading has been recorded, for example for a batch that hasn't started yet.

The data is loaded once, from a path relative to the source file, so the app works no matter which directory you start it from. Malformed records, unknown fields, unknown statuses, and duplicate IDs all raise an error at load time. Nothing is silently skipped.

## Testing, linting, and formatting

```bash
uv run pytest               # run the test suite
uv run ruff check .         # lint
uv run ruff format --check . # verify formatting
uv run ruff format .        # apply formatting
```

The tests use FastAPI's `TestClient`, so they don't need a running server.

### Parser

```bash
cd parser
npm test                                          # run the parser tests
npm run print-ir -- ../course/master-script.md    # print the IR and diagnostics as JSON
```

See [parser/README.md](parser/README.md) for the IR, the diagnostic codes, and error recovery.

## Limitations

- The data is read from a static JSON file. Edits take effect only after a restart.
- There's no authentication, persistence, pagination, or write access. These are deliberate omissions for a teaching fixture.
- The parser runs in Node.js only. It hasn't been run in Google Apps Script, and nothing reads or writes Google Docs yet.
- The ONSET, MOTION, SCREENCAST, and Production Summary documents are not generated yet.

## Roadmap

1. **Phase 1: Repository and API** (done)
2. **Phase 2: Master course script** (done), a six-video course tagged with `[ONSET]`, `[MOTION]`, and `[SCREENCAST]`
3. **Phase 3: Document parser**
   - **3A: Portable parser and validation** (done)
   - **3B: Google Docs integration** (planned): an Apps Script adapter and generation of the three section docs
4. **Phase 4: Production summary and learning lab**

Details are in [docs/roadmap.md](docs/roadmap.md). The planned hands-on tutorial is outlined in [docs/learning-lab.md](docs/learning-lab.md).

## Contributing

Small, focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and expectations, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). To report a security issue, follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Ken W. Alger
