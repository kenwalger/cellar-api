# Roadmap

Five milestones. Each phase builds on the previous one. Phases 1, 2, 3A, 3B, 4, and 5 are implemented in the repository. The project owner reported successful live Google Docs runs of Phases 3B and 4. The Phase 4b cleanup still needs a person to run it against a live Google account. The Phase 5 learning lab is written and checked in CI. Its screenshots are still to come.

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

### Phase 3B: Google Docs integration ✅

Google Apps Script tooling in [`apps-script/`](../apps-script):

- Reads a master Google Doc, turns its paragraphs into text lines (splitting soft line breaks), and reports unsupported content such as tables, images, and extra tabs.
- Runs the unchanged parser core. `apps-script/ProductionScript.js` is a byte-for-byte copy, checked in CI.
- `validateMasterDocument()` logs diagnostics with line and paragraph locations, plus counts and the expected-structure check, and makes no writes.
- `generateProductionDocuments()` stops on any error. Otherwise it creates a new timestamped run folder with ONSET, MOTION, and SCREENCAST Google Docs and a provenance `manifest.json`.
- Failures are recorded in a `"failed"` manifest, and nothing is deleted. Each run is independent of earlier runs.

**Verification status:**

- **Automated, offline (done):** 67 Node tests for extraction, validation, rendering, the manifest, generation (with fake Drive and Docs services), configuration, portability, and the drift check. These are in addition to the 50 parser tests.
- **Live Google Apps Script (reported):** the project owner reported a successful live Google Docs run. The item-by-item [checklist](../apps-script/README.md#phase-3b-three-role-documents-and-the-manifest) results and screenshots haven't been recorded in the repository yet.

## Phase 4: Production summary ✅

A portable estimator in [`production/`](../production) and a fourth generated document:

- `estimateProduction(document, options)` reads the parser's IR (it never reparses) and counts spoken words: ONSET text and `VOICEOVER` blocks only, as the grammar defines them. It follows a documented word-count policy.
- Narration seconds = words / words per minute × 60, plus an optional fixed allowance per SCREENCAST section. Values are kept at full precision, and stage and course totals add up exactly.
- Configurable assumptions: 140 words per minute, a three-minute threshold, and a 0-second screencast allowance (a narration-only baseline) by default. Invalid settings are rejected, never defaulted.
- `LONG_VIDEO_ESTIMATE` warnings for videos strictly over the threshold. At the defaults, only Stage 2, Video 2 (664 words, about 4 min 45 s) is flagged. Warnings never block generation.
- The Apps Script generator estimates before the first write and creates a **Production Summary** Google Doc with the configuration, a course overview, a per-video breakdown, warnings, the methodology and its exclusions, and provenance.
- The manifest moves to schema version 2. It adds the estimator version, core hash, configuration, totals, per-video figures, and warnings, plus the fourth output document.
- `apps-script/ProductionEstimator.js` is a byte-for-byte copy of the estimator core, checked by the sync script in CI.

**Verification status:**

- **Automated, offline (done):** 75 estimator tests, 107 Apps Script adapter tests (up from 67), and the 50 unchanged parser tests, plus the parser and estimator drift check.
- **Live Google Apps Script (reported):** the project owner reported a successful run on November 16, 2026 (run `6146a211`): four documents, 1,980 spoken words, 14 min 9 s, and one warning. Item-by-item [checklist](../apps-script/README.md#phase-4-production-summary) results haven't been recorded.

### Phase 4b: Cleanup and final acceptance ✅ (implementation; live check pending)

A narrowly scoped cleanup based on the live run's documents. There's no new phase of functionality, the parser grammar and estimator are unchanged, and the manifest stays at schema version 2.

- **SCREENCAST technical examples:** the JSON bodies and `curl` commands that follow a colon lead-in (`Run:`, `The response body:`) in an `ACTION` or `HIGHLIGHT` block are shown in Courier New, upright and indented, with their text unchanged. This is a layout convention documented in [`course/README.md`](../course/README.md#technical-examples-in-screencast-sections). The text is never inspected for code-like content.
- **PAUSE cues:** the blank separator lines next to a cue are no longer written. Each cue gets the same small space before and after.
- **Production Summary:** a native video overview table (video, spoken words, estimated duration, status), and singular and plural technical-token wording.
- **Master script:** the 400s and 500s sentences in Stage 2, Video 2 are more precise. That video goes from 666 to 664 spoken words, and the course from 1,980 to 1,978 (14 min 9 s to 14 min 8 s). Structure is unchanged (2 stages, 6 videos, 13 sections), and Stage 2, Video 2 is still the only long video.
- **Live (not done yet):** rename the master Google Doc (its title has a typo), apply the narration edit there, and run the [Phase 4b checklist](../apps-script/README.md#phase-4b-cleanup-and-final-acceptance).

## Phase 5: Developer learning lab ✅ (screenshots pending)

A guided, local-first lab in [`docs/lab/`](lab/README.md) that teaches the existing system. It adds no application features.

- Five core exercises (about 57 minutes, no Google account): inspect the source, parse and validate, break the contract, estimate production, and provenance and regeneration. There's one optional Google Docs exercise.
- A GitHub Pages-ready landing page ([`docs/index.md`](index.md)) with a Mermaid architecture diagram. Nothing has been deployed.
- An evidence and screenshot guide, a troubleshooting page, and a maintainer and instructor guide with a 60-minute workshop plan.
- Instructional example manifests produced offline by the real generator code with test doubles, clearly labeled as not from a live run.
- A learner-facing outline command for the parser (`npm run print-outline`), and `node scripts/lab-docs.mjs --check` in CI, which keeps the documented outputs, estimate tables, example manifests, links, and commands in step with the code.
- **Not done:** no screenshots have been captured yet (see the [evidence inventory](lab/evidence/README.md#inventory)), and the Phase 4b live checkpoint is still open.
