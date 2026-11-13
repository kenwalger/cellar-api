# CLAUDE.md

Guidance for Claude Code (and other coding agents) working in this repository. **Read this file before making changes.**

## Project purpose

This is an open-source learning lab about document automation. A structured master Google Doc (a video course script) will eventually be parsed into four production documents: ONSET, MOTION, SCREENCAST, and a Production Summary.

The fictional course is *Understanding APIs: A Winery's Digital Cellar*. The FastAPI app in `api/` is the **subject** of that course. It's a teaching fixture, not a product. Keep it small, readable, and deterministic.

## Current implementation status

| Phase | Scope | Status |
|---|---|---|
| 1 | Repository foundation, FastAPI app, mock data, tests, docs | **Implemented** |
| 2 | Master course script (six videos), structure oracle, malformed fixtures | **Implemented** (content) |
| 3A | Portable JavaScript parser, IR, diagnostics, Node tests (`parser/`) | **Implemented** (Node.js only; not yet run in Apps Script) |
| 3B | Google Apps Script adapter and ONSET/MOTION/SCREENCAST generation | Planned, not started |
| 4 | Production Summary doc and learning lab | Planned, not started |

`apps-script/` and `docs/screenshots/` contain placeholders only. `course/` holds the master script and parser fixtures. Its grammar is defined in `course/README.md`. If the API's behavior changes, recheck the script's examples against it. Don't regenerate `course/fixtures/expected-structure.json` from the script, because it's an independent oracle. Don't describe planned work as done, and don't claim an unimplemented feature works.

## Commands

```bash
uv sync                                # install from uv.lock
uv run uvicorn api.main:app --reload   # run the API on http://127.0.0.1:8000
uv run pytest                          # run tests
uv run ruff check .                    # lint
uv run ruff format --check .           # check formatting (CI runs this)
uv run ruff format .                   # apply formatting

cd parser && npm test                  # parser tests (Node.js 22+, no npm install needed)
cd parser && npm run print-ir -- ../course/master-script.md   # print IR + diagnostics as JSON
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
course/
  master-script.md   Authoritative six-video course script (plain-text grammar)
  README.md          Section and annotation grammar, outline, recording setup
  fixtures/          expected-structure.json oracle; malformed-script.md cases
parser/
  src/production-script.cjs  Portable core: parser, document checks, diagnostics (one global)
  src/index.js               ESM wrapper for Node.js
  src/print-ir.js            Prints parse result for a file
  tests/                     node:test suites (fixtures, parser, validator, portability)
apps-script/       Phase 3B placeholder
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

### JavaScript (parser/)

- Node.js 22+ for development. Use `node:test` and `node:assert/strict`. Don't add npm dependencies, build tools, bundlers, or TypeScript without approval.
- **The portable core, `parser/src/production-script.cjs`, must stay host-neutral.** It's a classic script that defines a single global, `ProductionScript`, plus the CommonJS guard at the end. Don't use `import`/`export`, `require`, `fs`, `path`, `process`, `Buffer`, `globalThis`, or browser APIs in it. `tests/portability.test.js` enforces this.
- Use a conservative set of language features in the core, for Google Apps Script V8: `const`/`let`, arrow functions, and template literals. Don't use `?.`, `??`, or newer built-ins. Node-only code (`src/index.js`, `src/print-ir.js`, `tests/`) can use modern Node features.
- Keep the parser line-oriented, with explicit state. Don't parse the whole document with one large regular expression.
- Malformed input returns diagnostics and never throws. Only invalid API use, such as a non-string argument, throws `TypeError`. Never silently repair, auto-close, or invent structure.
- Diagnostic `code` values are a stable contract. Tests assert on `code`, `severity`, and `line`, never on the full `message`. If you add a code, document it in `parser/README.md`.
- Preserve source text verbatim in the IR. Only line endings are normalized.
- Two-space indentation (see `.editorconfig`). There's no JS formatter, so match the existing style.

## Deterministic behavior

- Batch listings are always sorted by `batch_id`.
- The dataset must stay at exactly 12 batches, with unique IDs and at least one `null` temperature. Tests enforce this. If you change the count, update the tests and docs in the same change, and only with approval.
- No randomness, clocks, or network calls in the API, the parser, or tests. The parser's output must be identical for identical input.
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
- Parser tests go in `parser/tests/`. Acceptance tests must use `course/fixtures/` as the oracle. Never regenerate a fixture from parser output.
- Run `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .`, and `npm test` in `parser/` before you report work as done.
- **Never invent or paraphrase test results.** Report only what you actually ran, including failures. If you skipped a check, say so.

## Authorship and attribution

- The author and copyright holder is **Ken W. Alger**. Use that exact name everywhere it appears: LICENSE, README, `pyproject.toml`, and any new files.
- **Don't add AI or co-author attribution.** Commit messages, pull request descriptions, and files must not include `Co-Authored-By` trailers, "Generated with Claude Code" lines, or similar AI attribution.
- The maintainer runs git commands manually. When asked for a commit message, write it to `commit-message.txt` (which is gitignored) and don't run any git commands.

## Documentation maintenance

When behavior changes, update in the same change: `README.md` (endpoints, examples), this file (status, layout), `docs/architecture.md`, and `CHANGELOG.md` (Unreleased). Example responses in the README must match real API output.

## Document automation architecture

Steps 2 to 4 below exist as the portable parser in `parser/` (Phase 3A), tested in Node.js only. Steps 1, 5, and 6, and running the parser inside Google Apps Script, are **planned and don't exist yet**.

1. **Master Google Doc**: the authored course script, with sections tagged `[ONSET]`, `[MOTION]`, and `[SCREENCAST]`.
2. **Structured document parser**: the portable core is implemented. A planned Apps Script adapter will feed it the doc's text.
3. **Intermediate representation**: implemented. Stages → videos → sections → blocks, cues, and text, with source lines. See `parser/README.md`.
4. **Structural validation**: implemented as diagnostics with stable codes. Findings are reported, not silently fixed.
5. **Four output generators** *(planned)*: ONSET, MOTION, and SCREENCAST docs, plus a Production Summary with approximate durations, content statistics, and a configurable long-video threshold.
6. **Generation manifest** *(planned)*: a record of what was generated, from which source, and any validation findings.

The planned steps may change when they're implemented. Treat them as intent, not a spec.
