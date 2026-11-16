# Architecture

This document has five parts:

1. The **implemented** API (Phase 1).
2. The **written** master script and its fixtures (Phase 2).
3. The **implemented** portable parser and validator (Phase 3A).
4. The **implemented** portable production estimator (Phase 4).
5. The **implemented** Google Docs integration: ONSET, MOTION, and SCREENCAST generation (Phase 3B) and the Production Summary (Phase 4).

All implemented code is tested offline. The project owner reported a successful live Google Docs run of the Phase 3B workflow. The Phase 4 additions haven't been run in a real Google account yet. That's a manual checkpoint, described in [`apps-script/README.md`](../apps-script/README.md#live-verification-checklist).

## Part 1: Implemented API

The API is three small modules plus a data file.

```mermaid
flowchart LR
    Client["Client<br/>(curl, browser, Swagger UI)"] -->|HTTP| Main["api/main.py<br/>routes"]
    Main -->|function calls| Repo["api/repository.py<br/>load, list, get"]
    Repo -->|validates with| Models["api/models.py<br/>Batch, BatchStatus"]
    Repo -->|reads once| Data[("api/data/batches.json")]
```

| Module | Responsibility | Depends on |
|---|---|---|
| `models.py` | Pydantic models (`Batch`, `HealthResponse`, `ErrorResponse`) and the `BatchStatus` enum | Pydantic |
| `repository.py` | Reads the JSON file, validates every record, rejects duplicate IDs, sorts by `batch_id`, and provides `list_batches` and `get_batch` | `models.py` |
| `main.py` | Defines the FastAPI app, routes, response models, and the 404 error | `models.py`, `repository.py` |

### Design notes

- **HTTP is separate from data access.** `repository.py` doesn't import FastAPI. Its functions return models or `None`, and `main.py` decides on status codes. That's why `tests/test_repository.py` can test the data layer without HTTP.
- **Paths don't depend on the working directory.** The data file is found with `Path(__file__).parent / "data" / "batches.json"`.
- **Validation happens at load time.** `Batch` uses `extra="forbid"`, `status` must be a `BatchStatus`, and `days_since_start` must be ≥ 0. A bad record raises an error instead of being skipped.
- **The data is loaded once.** The bundled dataset is cached with `functools.cache` as an immutable tuple. Because the file never changes while the app runs, the cache can't go stale. The file is re-read on restart.
- **The output is deterministic.** Results are sorted by `batch_id`, and nothing depends on time, randomness, or the network.
- **Status filtering uses an enum.** FastAPI validates `?status=` against `BatchStatus`, so it returns 422 for unsupported values automatically, and the allowed values appear in the OpenAPI schema.

## Part 2: The master script (implemented as content)

[`course/master-script.md`](../course/master-script.md) is the **authoritative source** for every production document. It's plain text built around literal stage and video headings, `[ONSET]` / `[MOTION]` / `[SCREENCAST]` sections, and internal annotations. The full grammar is in [`course/README.md`](../course/README.md#script-grammar).

Two fixtures support the parser:

- [`course/fixtures/expected-structure.json`](../course/fixtures/expected-structure.json): the expected stages, videos, and section order, written independently of the script.
- [`course/fixtures/malformed-script.md`](../course/fixtures/malformed-script.md): isolated invalid cases, with their expected failures documented in [`course/fixtures/README.md`](../course/fixtures/README.md).

The parser in Part 3 reads the script and fixtures in its tests.

## Part 3: Implemented parser and validation (Phase 3A)

[`parser/`](../parser) contains a dependency-free JavaScript parser. It turns script text into an intermediate representation (IR) and a list of diagnostics. The details are in [`parser/README.md`](../parser/README.md).

```mermaid
flowchart LR
    Text["Script text<br/>(master-script.md, or text<br/>from a Google Doc later)"] --> Core
    subgraph Core["production-script.cjs (portable core)"]
        Lines["Line-by-line<br/>state machine"] --> IR["IR<br/>stages → videos → sections<br/>→ blocks / cues / text"]
        Lines --> Diag["Diagnostics<br/>code, severity, line, message"]
        IR --> Checks["Document checks<br/>numbering, empty items"]
        Checks --> Diag
    end
    Core --> Node["index.js (ESM)<br/>Node tests, print-ir"]
    Core --> GAS["apps-script/ProductionScript.js<br/>(byte-for-byte copy, Phase 3B)"]
```

| Component | Responsibility | Runs in |
|---|---|---|
| `src/production-script.cjs` | Parsing, IR construction, structural and document checks, diagnostics | Any JavaScript engine: no modules or host APIs |
| `src/index.js` | Re-exports the core as an ES module | Node.js |
| `src/print-ir.js` | Prints the parse result for a file as JSON | Node.js |
| `tests/` | Acceptance tests against the course fixtures, plus edge-case, diagnostic, and portability tests | Node.js `node:test` |

### Design notes

- **The IR says what each piece of content is.** Section order is kept exactly as written, including repeated types. Annotations become typed blocks, and `[PAUSE]` becomes a cue. Text lines are kept verbatim with their source line numbers. Generators won't need to reread the source.
- **What's spoken is marked by structure.** ONSET text and `VOICEOVER` blocks are spoken. The parser never judges content by its wording.
- **Diagnostics are returned, not thrown.** Malformed input produces a partial document and stable diagnostic codes, sorted by line. Only a non-string argument throws.
- **Recovery is conservative.** Nothing is closed, created, or repaired without a diagnostic. Document checks run only when there are no structural errors, which keeps follow-on noise down.
- **The parser checks grammar, not the course's shape.** The two-stages-of-three-videos shape is checked by the acceptance test against `course/fixtures/expected-structure.json`.
- **The core is portable.** It's one classic script with a single global and a CommonJS guard for Node. Tests run it in an empty `vm` context, but it hasn't yet been run in Google Apps Script.

## Part 4: Implemented production estimator (Phase 4)

[`production/`](../production) contains a dependency-free JavaScript estimator. It reads the parser's IR and returns word counts, estimated durations, long-video warnings, and the assumptions behind them. The details are in [`production/README.md`](../production/README.md).

```mermaid
flowchart LR
    IR["Parser IR<br/>(no error diagnostics)"] --> Core
    Options["Options<br/>WPM · threshold · allowance"] --> Core
    subgraph Core["production-estimator.cjs (portable core)"]
        Classify["Spoken content<br/>ONSET text + VOICEOVER<br/>(from the grammar)"] --> Count["Word count<br/>whitespace tokens with<br/>a letter or digit"]
        Count --> Durations["Durations<br/>words × 60 / WPM<br/>+ allowance per SCREENCAST"]
        Durations --> Warnings["LONG_VIDEO_ESTIMATE<br/>estimate over threshold"]
    end
    Core --> Result["videos · stages · totals<br/>warnings · assumptions"]
    Core --> GAS["apps-script/ProductionEstimator.js<br/>(byte-for-byte copy)"]
```

### Design notes

- **The grammar decides what's spoken.** The estimator counts ONSET text and `VOICEOVER` text and nothing else. It refuses (throws on) any section type, block type, or content kind whose spoken status it doesn't know, instead of guessing.
- **It never reparses.** The input is the IR. The parser and the generation gate decide validity. An unclosed section, which only a failed parse produces, is refused.
- **Facts and assumptions stay separate.** Section counts and word counts are observations. Durations and warnings depend on a configuration that's echoed in every result, along with plain-language assumption statements.
- **Fail loudly on configuration.** Unknown, non-numeric, non-finite, zero (for the rate or threshold), and negative values are errors. They never fall back to the defaults.
- **Exact arithmetic where it matters.** Values keep full precision, multiplication comes before division, and totals are summed from the video values in document order. Rounding happens only for display.
- **Same core, two hosts.** Like the parser, it's one classic script with one global. It's copied into Apps Script by the sync script and checked for drift in CI.

## Part 5: Google Docs workflow

### Implemented (Phases 3B and 4)

[`apps-script/`](../apps-script) is a Google Apps Script project with two manual entry points: `validateMasterDocument()` (read-only) and `generateProductionDocuments()`. Setup and operation are documented in [`apps-script/README.md`](../apps-script/README.md).

```mermaid
flowchart TD
    Master["Master Google Doc"] --> Reader["DocumentReader<br/>paragraphs → lines<br/>line → paragraph map"]
    Reader --> Parser["ProductionScript<br/>(unchanged parser core)"]
    Parser --> Validation["Validation<br/>errors block · warnings pass<br/>expected-structure check"]
    Validation -- errors --> Stop["Log diagnostics<br/>no files created"]
    Validation -- no errors --> Estimator["ProductionEstimator<br/>(unchanged estimator core)"]
    Estimator -- invalid settings --> Stop
    Estimator --> Summary["Summary<br/>Production Summary model"]
    Validation -- no errors --> Render["Render<br/>ONSET · MOTION · SCREENCAST models"]
    Render --> Generator["Generator"]
    Summary --> Generator
    Generator --> Folder["New run folder<br/>Digital Cellar Production — date UTC — run ID"]
    Folder --> Docs["4 Google Docs"]
    Folder --> Manifest["manifest.json"]
```

| File | Responsibility | Tested offline |
|---|---|---|
| `ProductionScript.js` | Byte-for-byte copy of the parser core | Yes. A drift check runs in CI. |
| `ProductionEstimator.js` | Byte-for-byte copy of the estimator core | Yes. A drift check runs in CI. |
| `GeneratedData.js` | Expected structure, plus parser and estimator versions and core hashes, generated from the repository | Yes. A drift check runs in CI. |
| `Config.js` | Script Properties: master document ID, optional output folder, structure-check switch, and the three estimator settings | Yes |
| `DocumentReader.js` | Body → text lines, soft line breaks, and unsupported-content diagnostics | Yes, with Body test doubles |
| `Validation.js` | Parse, map diagnostics to paragraphs, compare structure, decide generate/block, format the log | Yes |
| `Render.js` | Role selection and paragraph models, verbatim and in source order | Yes |
| `Summary.js` | Production Summary paragraph model and estimate log lines, from the estimator's result | Yes |
| `Manifest.js` | Run folder naming and the manifest object | Yes |
| `Generator.js` | Run orchestration through injected services, including partial-failure handling | Yes, with fake services |
| `GoogleServices.js` | `DocumentApp`, `DriveApp`, and `Utilities` calls | No. Covered only by the live checkpoint. |
| `Main.js` | Entry points and logging | No. Covered only by the live checkpoint. |

### Design notes

- **The parser is the only interpreter, and the estimator is the only calculator.** The adapter only turns paragraphs into text, and it never infers structure from formatting. All structure comes from the unchanged parser core. Every number in the Production Summary comes from the estimator core.
- **The parser and estimator each exist once.** `parser/src/production-script.cjs` and `production/src/production-estimator.cjs` are the sources. `scripts/sync-apps-script.mjs` writes the Apps Script copies, and `--check` (run in CI) fails on any difference.
- **Logic is testable apart from Google.** Every Google API call is in `GoogleServices.js`. The other files load in Node exactly as Apps Script loads them: as plain scripts in one shared global scope.
- **The decision comes before the first write.** Configuration (including the estimator settings), document access, extraction, parsing, the structure check, the production estimate, and the output folder are all checked, and all four documents are rendered in memory, before anything is created in Drive. Error-level diagnostics, invalid estimator settings, and an estimator failure all stop the run with no files created. Diagnostic warnings and long-video warnings are allowed and recorded in the manifest.
- **The acceptance checkpoint.** By default (`REQUIRE_EXPECTED_STRUCTURE=true`), the Google Doc must reproduce `course/fixtures/expected-structure.json` exactly. The parser stays generic, and the check can be turned off for other courses.
- **Runs are independent.** Every run creates a new folder named with its UTC timestamp and run ID. Nothing from earlier runs is reused, overwritten, or deleted.
- **Provenance.** `manifest.json` (schema version 2) records:
  - the source document's ID, URL, title, and last-updated time, and a SHA-256 hash of the extracted text
  - the parser's version and core hash, and the estimator's version, core hash, and configuration
  - each output's role, ID, and URL
  - counts and diagnostic warnings
  - the estimate's totals, per-video figures, and long-video warnings
  - the run's status

  It contains no document content.
- **Partial failures.** A failed write throws. If the run folder exists, a `"failed"` manifest listing every created document is written to it, and the folder is renamed with ` — FAILED`. Nothing is deleted.

### Full pipeline

```mermaid
flowchart TD
    Master["Master Google Doc<br/>course script with<br/>[ONSET] / [MOTION] / [SCREENCAST] tags"] --> Parser["Structured document parser<br/>(implemented)"]
    Parser --> IR["Intermediate representation<br/>course → videos → tagged sections"]
    IR --> Validate["Structural validation<br/>findings, not silent fixes"]
    Validate --> Onset["ONSET doc"]
    Validate --> Motion["MOTION doc"]
    Validate --> Screencast["SCREENCAST doc"]
    Validate --> Estimate["Production estimator<br/>(implemented)"]
    Estimate --> Summary["Production Summary doc"]
    Onset & Motion & Screencast & Summary --> Manifest["Generation manifest"]
```

1. **Master Google Doc** *(read in Phase 3B)*: one authored script per course, organized by video, with each section tagged.
2. **Parser** *(core in Phase 3A, running in Apps Script in Phase 3B)*: reads the document structure (headings, tags, body text).
3. **Intermediate representation** *(implemented in Phase 3A)*: a plain data structure that separates parsing from output, so each generator works on clean data.
4. **Structural validation** *(implemented in Phase 3A)*: reports problems such as unknown or missing tags, empty sections, or unexpected ordering.
5. **Generators**: the three section-specific documents are implemented (Phase 3B). The Production Summary, with estimated narration durations, content statistics, and a configurable long-video warning, is implemented (Phase 4) on top of the portable estimator.
6. **Generation manifest** *(implemented in Phase 3B, extended in Phase 4)*: records what was generated, from which source, with which parser and estimator, and any warnings.

### Source of truth and regeneration

- **One direction only.** Changes go into the master Google Doc. Generated documents are derivative outputs and are never edited to change the course.
- **No synchronization.** Generated documents aren't kept in sync with the master. If the master changes after generation, the existing outputs stay as they were.
- **Regeneration creates a new set.** Running the generator again produces a new, identifiable set of four documents with its own generation manifest. It doesn't update the previous set in place, so you can always tell which version of the master a set came from. To compare assumptions, change an estimator setting and generate again. The source script doesn't change.
