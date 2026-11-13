# Roadmap

Four milestones. Each phase builds on the previous one, and only Phase 1 is complete.

## Phase 1: Repository and API ✅

Build the FastAPI application, mock data, tests, and documentation.

- Read-only winery API: health, batch list with status filter, and single batch lookup
- 12 fictional batches validated with Pydantic
- pytest suite, Ruff, and GitHub Actions CI
- README, CLAUDE.md, community files, and architecture notes

## Phase 2: Master course script (planned)

Write the fictional six-video course *Understanding APIs: A Winery's Digital Cellar*, organized into two stages of three videos each.

- Tag each section `[ONSET]`, `[MOTION]`, or `[SCREENCAST]`.
- Use the Phase 1 API as the subject of the screencast segments.
- Include one deliberately long video so the production-summary threshold can be tested.
- Keep the script in a format that can be reproduced as a Google Doc. Sample fixtures go in `course/`.

## Phase 3: Document parser (planned)

Build Google Apps Script tooling, in `apps-script/`, that:

- Reads a master Google Doc.
- Validates its structure and reports findings.
- Generates separate ONSET, MOTION, and SCREENCAST Google Docs.

## Phase 4: Production summary and learning lab (planned)

- Generate a fourth Google Doc containing approximate video durations, a configurable long-video threshold, and validation findings.
- Add screenshots (`docs/screenshots/`), step-by-step instructions, and a reproducible learning lab. See [learning-lab.md](learning-lab.md).
