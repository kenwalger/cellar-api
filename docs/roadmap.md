# Roadmap

Four milestones. Each phase builds on the previous one. Phases 1 and 2 are complete.

## Phase 1: Repository and API ✅

Build the FastAPI application, mock data, tests, and documentation.

- Read-only winery API: health, batch list with status filter, and single batch lookup
- 12 fictional batches validated with Pydantic
- pytest suite, Ruff, and GitHub Actions CI
- README, CLAUDE.md, community files, and architecture notes

## Phase 2: Master course script ✅

Write the fictional six-video course *Understanding APIs: A Winery's Digital Cellar*, organized into two stages of three videos each.

- Master script in [`course/master-script.md`](../course/master-script.md), with sections tagged `[ONSET]`, `[MOTION]`, or `[SCREENCAST]` and internal annotations documented in [`course/README.md`](../course/README.md)
- Screencast segments that use the Phase 1 API, with every example checked against the implementation
- Stage 2, Video 2 (*Handling Errors*) deliberately long, so the Production Summary's three-minute threshold can be tested
- Plain-text structure that survives copying into Google Docs
- An independently authored structural oracle (`course/fixtures/expected-structure.json`) and four isolated malformed cases (`course/fixtures/malformed-script.md`)

## Phase 3: Document parser (planned)

Build Google Apps Script tooling, in `apps-script/`, that:

- Reads a master Google Doc.
- Validates its structure and reports findings.
- Generates separate ONSET, MOTION, and SCREENCAST Google Docs.

## Phase 4: Production summary and learning lab (planned)

- Generate a fourth Google Doc containing approximate video durations, a configurable long-video threshold, and validation findings.
- Add screenshots (`docs/screenshots/`), step-by-step instructions, and a reproducible learning lab. See [learning-lab.md](learning-lab.md).
