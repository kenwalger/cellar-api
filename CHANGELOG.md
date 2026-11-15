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
- Google Apps Script integration in `apps-script/` (Phase 3B):
  - Manual entry points: `validateMasterDocument()` (read-only report of diagnostics, counts, and the structure check) and `generateProductionDocuments()`.
  - `DocumentReader` extracts paragraphs as text lines, splitting soft line breaks and keeping a line→paragraph map. It reports tables, images, smart chips, extra tabs, and similar content as errors, and list formatting, page breaks, and rules as warnings.
  - Validation runs the unchanged parser, maps diagnostics to document paragraphs, and, by default, requires an exact match with `course/fixtures/expected-structure.json`. Errors block generation and warnings don't.
  - ONSET, MOTION, and SCREENCAST documents rendered verbatim in source order, with stage and video headings, `Part N of M` headings for repeated sections, and instructions styled differently from spoken narration.
  - Each run creates a new `Digital Cellar Production — <UTC timestamp> — <run id>` folder with the three documents and a provenance `manifest.json` (schema version 1: source ID, URL, title, and last-updated time; extracted-text SHA-256; parser version and core hash; output IDs and URLs; counts; warnings; status).
  - Partial failures throw, write a `"failed"` manifest, and rename the folder with ` — FAILED`. Nothing is deleted or reused.
  - Script Properties configuration (`MASTER_DOCUMENT_ID`, `OUTPUT_FOLDER_ID`, `REQUIRE_EXPECTED_STRUCTURE`). There are no triggers.
  - 67 offline `node:test` tests using Body and Drive test doubles. No npm dependencies.
- `scripts/sync-apps-script.mjs` generates `apps-script/ProductionScript.js` (a byte-for-byte copy of the parser core) and `apps-script/GeneratedData.js`, and `--check` detects drift.

### Changed

- CI gains a `parser` job (Node.js 22, `npm test`). The Python job is unchanged.
- The CI `parser` job also runs the Apps Script adapter tests and the drift check.
- `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/learning-lab.md`, `parser/README.md`, and `course/README.md` updated for Phase 3B. Live Google Apps Script verification is listed as a pending manual checkpoint.
- `.gitignore` excludes `apps-script/.clasp.json`.
- `.editorconfig` uses two-space indentation for JavaScript.
- `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/roadmap.md`, and `docs/learning-lab.md` updated for Phase 3A. They describe the implemented parser, the JavaScript conventions, and a planned parser exercise. Phase 3B and Phase 4 remain planned.
- `docs/architecture.md`, `docs/roadmap.md`, `docs/learning-lab.md`, and `README.md` updated for Phase 2. They now describe the master script as the authoritative source, mark Phase 2 complete, and outline a planned Exercise 3.
