# Roadmap

Four milestones. Each phase builds on the previous one. Phases 1, 2, 3A, and 3B are complete in the repository. Phase 3B still needs a person to run it against a live Google account.

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

## Phase 3: Document parser

### Phase 3A: Portable parser and validation ✅

- Dependency-free JavaScript parser in [`parser/`](../parser) that turns script text into a deterministic IR with source line numbers
- Structural diagnostics with stable codes, line numbers, and conservative error recovery
- Node.js tests (`node:test`): the master script matches `course/fixtures/expected-structure.json`, and each malformed case reports its documented first error
- A portable core with no module system or host APIs, checked in an isolated `vm` context but not yet in Google Apps Script
- CI runs the parser tests alongside the Python checks

### Phase 3B: Google Docs integration ✅ (implementation; live check pending)

Google Apps Script tooling in [`apps-script/`](../apps-script):

- Reads a master Google Doc, turns its paragraphs into text lines (splitting soft line breaks), and reports unsupported content such as tables, images, and extra tabs.
- Runs the unchanged parser core. `apps-script/ProductionScript.js` is a byte-for-byte copy, checked in CI.
- `validateMasterDocument()` logs diagnostics with line and paragraph locations, plus counts and the expected-structure check, and makes no writes.
- `generateProductionDocuments()` stops on any error. Otherwise it creates a new timestamped run folder with ONSET, MOTION, and SCREENCAST Google Docs and a provenance `manifest.json`.
- Failures are recorded in a `"failed"` manifest, and nothing is deleted. Each run is independent of earlier runs.

**Verification status:**

- **Automated, offline (done):** 67 Node tests for extraction, validation, rendering, the manifest, generation (with fake Drive and Docs services), configuration, portability, and the drift check. These are in addition to the 50 parser tests.
- **Live Google Apps Script (not done yet):** a person must run the [live verification checklist](../apps-script/README.md#live-verification-checklist) in a real Google account. Until then, Apps Script compatibility and output formatting are unconfirmed.

## Phase 4: Production summary and learning lab (planned)

- Generate a fourth Google Doc containing approximate video durations, a configurable long-video threshold, and validation findings.
- Add screenshots (`docs/screenshots/`), step-by-step instructions, and a reproducible learning lab. See [learning-lab.md](learning-lab.md).
