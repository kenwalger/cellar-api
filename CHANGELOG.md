# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Repository foundation: `pyproject.toml` with uv lockfile, Ruff and pytest configuration, `.editorconfig`, and `.python-version`.
- Read-only FastAPI application (`api/`) with:
  - `GET /api/v1/health`
  - `GET /api/v1/batches` with an optional, validated `status` filter and results sorted by `batch_id`
  - `GET /api/v1/batches/{batch_id}`, which returns 404 `{"detail": "Batch not found"}` for unknown IDs
- Twelve fictional wine production batches in `api/data/batches.json`, validated at load time with Pydantic. Malformed records, unknown fields, and duplicate IDs are rejected.
- pytest suite covering the endpoints and the data layer.
- GitHub Actions CI that runs Ruff lint, the Ruff format check, and pytest.
- Project documentation: README, CLAUDE.md, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, architecture, roadmap, and learning-lab outline.
- Master course script `course/master-script.md` for *Understanding APIs: A Winery's Digital Cellar*: two stages of three videos each, with `[ONSET]`, `[MOTION]`, and `[SCREENCAST]` sections and `[ACTION]`, `[VISUAL]`, `[VOICEOVER]`, `[HIGHLIGHT]`, and `[PAUSE]` annotations. Every API example was checked against the implementation. Stage 2, Video 2 is deliberately long, for testing the long-video threshold.
- Script grammar, annotation conventions, and Google Docs portability rules in `course/README.md`.
- Independently authored structural oracle `course/fixtures/expected-structure.json`.
- Four isolated malformed-script cases in `course/fixtures/malformed-script.md` (missing closing tag, unexpected closing tag, nested section, unknown annotation), with their expected failures documented in `course/fixtures/README.md`.
- Portable JavaScript parser in `parser/` (Phase 3A):
  - `parseProductionScript(sourceText)` returns a deterministic IR (stages, videos, sections in authored order, typed annotation blocks, `PAUSE` cues, verbatim text, source line numbers) and diagnostics.
  - Seventeen stable diagnostic codes for structural errors and document checks, sorted by line, with conservative error recovery documented in `parser/README.md`.
  - A host-neutral core (`src/production-script.cjs`) with no module syntax or Node/browser APIs, an ESM wrapper, and a `print-ir` inspection script.
  - `node:test` suites: master-script acceptance against `course/fixtures/expected-structure.json`, each malformed fixture case, IR and grammar edge cases, diagnostics, and an isolated-`vm` portability check. No npm dependencies.
- Placeholder directory for the planned Apps Script tooling (`apps-script/`).

### Changed

- CI gains a `parser` job (Node.js 22, `npm test`). The Python job is unchanged.
- `.editorconfig` uses two-space indentation for JavaScript.
- `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/roadmap.md`, and `docs/learning-lab.md` updated for Phase 3A. They describe the implemented parser, the JavaScript conventions, and a planned parser exercise. Phase 3B and Phase 4 remain planned.
- `docs/architecture.md`, `docs/roadmap.md`, `docs/learning-lab.md`, and `README.md` updated for Phase 2. They now describe the master script as the authoritative source, mark Phase 2 complete, and outline a planned Exercise 3.
