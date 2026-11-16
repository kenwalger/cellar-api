# Winery API Document Automation Lab

An open-source learning lab about **turning one structured master document into several production documents**.

The running example is a fictional video course, *Understanding APIs: A Winery's Digital Cellar*. The course teaches API basics using a small winery production API, and that API lives in this repository.

To be clear about what's what:

- **The winery API is the subject of the course.** It's a deliberately small teaching fixture, not a winery management system.
- **Document automation is what this lab teaches.** The tooling parses a master course script (a Google Doc) into four separate Google Docs:
  1. **ONSET**: presenter narration and teleprompter content.
  2. **MOTION**: motion graphics instructions and voiceover.
  3. **SCREENCAST**: screen recording instructions and narration.
  4. **Production Summary**: per-video duration estimates, content statistics, and configurable long-video warnings.

> **Status: Phase 5 implemented: a [developer learning lab](docs/lab/README.md).** The FastAPI application, the master course script, a portable JavaScript parser, a portable production estimator, and Google Apps Script tooling that generates all four documents from a Google Doc exist today. Everything is tested offline. The project owner reported successful live Google Docs runs of Phase 3B and Phase 4 (run `6146a211`). **The Phase 4b cleanup hasn't been run in a live Google account yet.** It changes how SCREENCAST examples and PAUSE cues are rendered, adds a Production Summary overview table, and revises the status-code narration. That's a manual checkpoint (see [apps-script/README.md](apps-script/README.md#phase-4b-cleanup-and-final-acceptance)). The learning lab's screenshots haven't been captured yet. See [docs/roadmap.md](docs/roadmap.md).

## Learning lab

**Start with [the learning lab](docs/lab/README.md).** Five guided exercises (about an hour, with no Google account or paid service) take you through the master script, the parser and its diagnostics, a deliberately broken copy, the duration estimate and its assumptions, and the provenance manifest. An optional sixth exercise generates the four Google Docs in your own account. You need Git, Node.js 22+, and a terminal.

| | Exercise | Time |
|---|---|---|
| 0 | [Set up](docs/lab/00-setup.md) | 5 min |
| 1 | [Inspect the source](docs/lab/01-inspect-the-source.md) | 10 min |
| 2 | [Parse and validate](docs/lab/02-parse-and-validate.md) | 10 min |
| 3 | [Break the contract](docs/lab/03-break-the-contract.md) | 10 min |
| 4 | [Estimate production](docs/lab/04-estimate-production.md) | 12 min |
| 5 | [Provenance and regeneration](docs/lab/05-provenance-and-regeneration.md) | 10 min |
| 6 | [Optional: generate the Google Docs](docs/lab/06-google-docs-extension.md) | 45 to 60 min |

The lab is set up to be published with GitHub Pages and the Merlot theme at <https://kenwalger.github.io/cellar-api/>, with [`docs/index.md`](docs/index.md) as its home page. Pages hasn't been enabled yet. The one-time settings change is in the [maintainer guide](docs/lab/maintainers.md#publishing-the-lab-with-github-pages), which instructors and maintainers should read anyway.

## What's in the repository

- A read-only FastAPI app with three endpoints.
- 12 fictional wine production batches in a JSON file, validated with Pydantic.
- A pytest suite covering the endpoints and the data layer.
- Ruff linting and formatting, run in GitHub Actions.
- A six-video master course script, [`course/master-script.md`](course/master-script.md), tagged with `[ONSET]`, `[MOTION]`, and `[SCREENCAST]` sections. See [course/README.md](course/README.md) for its grammar.
- Parser test fixtures: an expected-structure oracle and isolated malformed-script cases in [`course/fixtures/`](course/fixtures/).
- A dependency-free JavaScript parser, [`parser/`](parser/README.md). It turns the script into a structured intermediate representation with source line numbers, reports structural problems as diagnostics, and is tested with Node's built-in test runner.
- A dependency-free JavaScript production estimator, [`production/`](production/README.md). It reads the parser's IR, counts spoken words with a documented policy, estimates narration time at a configurable speaking rate, and flags videos over a configurable threshold. It never reparses the script.
- A Google Apps Script project, [`apps-script/`](apps-script/README.md). It reads the master Google Doc, validates it with the unchanged parser, and generates ONSET, MOTION, SCREENCAST, and Production Summary Google Docs plus a provenance manifest in a new folder for each run. Its logic is tested offline with test doubles.
- A developer learning lab, [`docs/lab/`](docs/lab/README.md), whose documented outputs and examples are checked against the code in CI.
- Project documentation.

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
production/
├── src/production-estimator.cjs  portable estimator core (no Node or browser APIs)
├── src/index.js                  Node.js ESM entry point
└── tests/                        node:test suites
apps-script/                    Google Apps Script adapter (see its README)
```

Routes in `main.py` call plain functions in `repository.py`. The repository has no HTTP dependencies, so it can be tested on its own. The parser is independent of the API. It reads production-script text and returns an IR and diagnostics. The estimator reads that IR and returns word counts, duration estimates, and warnings. See [docs/architecture.md](docs/architecture.md) for more detail, including the Google Docs workflow.

## Prerequisites

- Python 3.11 or newer (`.python-version` pins 3.12 for local development)
- [uv](https://docs.astral.sh/uv/)
- Node.js 22 or newer, for the parser, estimator, and Apps Script tests only. There are no npm packages to install.
- A Google account, only for running the Apps Script tooling in Google (see [apps-script/README.md](apps-script/README.md)).

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
npm run print-outline -- ../course/master-script.md   # print a short outline and the diagnostics
```

See [parser/README.md](parser/README.md) for the IR, the diagnostic codes, and error recovery.

### Production estimator

```bash
cd production
npm test                                                  # run the estimator tests
npm run print-estimate -- ../course/master-script.md      # print the estimate as JSON
npm run print-estimate -- ../course/master-script.md '{"wordsPerMinute": 160}'
```

See [production/README.md](production/README.md) for the word-count policy, the duration method, the warning rule, and the master script's figures. At the defaults (140 words per minute, a three-minute threshold, and no screencast allowance), the course has 1978 spoken words, about 14 min 8 s of narration, and one long video: Stage 2, Video 2.

### Apps Script adapter

```bash
cd apps-script && npm test                       # adapter tests (offline, no Google account)
node scripts/sync-apps-script.mjs --check        # parser and estimator copies and generated data match their sources
```

To run the tooling in Google, follow [apps-script/README.md](apps-script/README.md).

### Learning lab

```bash
node scripts/lab-docs.mjs --check   # documented outputs, estimate tables, example manifests, links, and commands match the code
node scripts/lab-docs.mjs           # refresh them after a parser, estimator, or script change, then review the diff
```

## Limitations

- The data is read from a static JSON file. Edits take effect only after a restart.
- There's no authentication, persistence, pagination, or write access. These are deliberate omissions for a teaching fixture.
- The Phase 4b presentation changes haven't been run against a real Google account yet (see the live checklist in [apps-script/README.md](apps-script/README.md#live-verification-checklist)). The project owner reported live runs of the Phase 3B documents and the Phase 4 Production Summary.
- Durations in the Production Summary are estimates from a fixed speaking rate, not predictions of finished video length. See [production/README.md](production/README.md#what-the-estimate-leaves-out).

## Roadmap

1. **Phase 1: Repository and API** (done)
2. **Phase 2: Master course script** (done), a six-video course tagged with `[ONSET]`, `[MOTION]`, and `[SCREENCAST]`
3. **Phase 3: Document parser**
   - **3A: Portable parser and validation** (done)
   - **3B: Google Docs integration** (done; live run reported by the project owner): an Apps Script adapter and generation of the three section docs
4. **Phase 4: Production summary** (done; live run reported by the project owner): a portable estimator and the fourth document
   - **4b: Cleanup and final acceptance** (implemented; live check pending): clearer SCREENCAST examples and PAUSE cues, a video overview table, and more precise status-code narration
5. **Phase 5: Developer learning lab** (done; screenshots pending): five local exercises, an optional Google Docs exercise, an evidence guide, and a GitHub Pages-ready landing page

Details are in [docs/roadmap.md](docs/roadmap.md).

## Contributing

Small, focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and expectations, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). To report a security issue, follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Ken W. Alger
