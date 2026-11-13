# Architecture

This document has four parts:

1. The **implemented** API (Phase 1).
2. The **written** master script and its fixtures (Phase 2).
3. The **implemented** portable parser and validator (Phase 3A).
4. The **planned** Google Docs adapter, artifact generation, and Production Summary (Phases 3B and 4).

The API and the parser exist as code. Nothing reads from or writes to Google Docs yet.

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

Two fixtures support the planned parser:

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
    Core -. planned .-> GAS["Apps Script adapter<br/>(Phase 3B)"]
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

## Part 4: Planned Google Docs workflow (not implemented)

The learning lab's real goal is to turn the master course script into several production documents. Phase 3A built the parser and validation. Everything else below is planned:

- **Google Docs adapter (Phase 3B):** read the master Google Doc as text and run the portable parser inside Google Apps Script.
- **Artifact generation (Phase 3B):** produce the ONSET, MOTION, and SCREENCAST documents from the IR.
- **Production Summary (Phase 4):** estimated durations, content statistics, the long-video threshold, and validation findings.

The planned pipeline:

```mermaid
flowchart TD
    Master["Master Google Doc<br/>course script with<br/>[ONSET] / [MOTION] / [SCREENCAST] tags"] --> Parser["Structured document parser<br/>(Google Apps Script)"]
    Parser --> IR["Intermediate representation<br/>course → videos → tagged sections"]
    IR --> Validate["Structural validation<br/>findings, not silent fixes"]
    Validate --> Onset["ONSET doc"]
    Validate --> Motion["MOTION doc"]
    Validate --> Screencast["SCREENCAST doc"]
    Validate --> Summary["Production Summary doc<br/>durations, stats, long-video threshold"]
    Onset & Motion & Screencast & Summary --> Manifest["Generation manifest"]
```

1. **Master Google Doc**: one authored script per course, organized by video, with each section tagged.
2. **Parser** *(core implemented in Phase 3A)*: reads the document structure (headings, tags, body text).
3. **Intermediate representation** *(implemented in Phase 3A)*: a plain data structure that separates parsing from output, so each generator works on clean data.
4. **Structural validation** *(implemented in Phase 3A)*: reports problems such as unknown or missing tags, empty sections, or unexpected ordering.
5. **Generators**: produce the three section-specific documents and a Production Summary with approximate video durations and a configurable long-video warning.
6. **Generation manifest**: records what was generated, from which source, and any validation findings.

### Source of truth and regeneration

- **One direction only.** Changes go into the master Google Doc. Generated documents are derivative outputs and are never edited to change the course.
- **No synchronization.** Generated documents aren't kept in sync with the master. If the master changes after generation, the existing outputs stay as they were.
- **Regeneration creates a new set.** Running the generator again produces a new, identifiable set of four documents with its own generation manifest. It doesn't update the previous set in place, so you can always tell which version of the master a set came from.

Steps 1, 5, and 6 and the Apps Script side of step 2 are intent, not a specification, and may change during Phases 3B and 4.
