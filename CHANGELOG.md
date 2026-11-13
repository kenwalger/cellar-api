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
- Placeholder directories for the planned course script (`course/`) and Apps Script tooling (`apps-script/`).
