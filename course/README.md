# course/

This directory holds the master production script for the fictional course **Understanding APIs: A Winery's Digital Cellar**, plus the fixtures that the parser in [`parser/`](../parser) is tested against.

| File | Purpose |
|---|---|
| [`master-script.md`](master-script.md) | The authoritative course script. It's a valid document. |
| [`fixtures/expected-structure.json`](fixtures/expected-structure.json) | The structure the master script is expected to have, authored independently as a test oracle |
| [`fixtures/malformed-script.md`](fixtures/malformed-script.md) | Small, deliberately invalid scripts, one defect each |
| [`fixtures/README.md`](fixtures/README.md) | The expected validation failure for each malformed case |

## Purpose and audience

The course is aimed at beginning developers who have never called a web API. It uses the Digital Cellar API in [`api/`](../api) to teach requests, responses, JSON, query parameters, and status codes.

The script also serves a second purpose. It's the primary test document for the document automation lab. A single master document holds instructions for three production teams, and the planned tooling will split it into separate documents for each of them.

## Course outline

**Stage 1: Understanding the Interface**

| Video | Title | Sections, in order |
|---|---|---|
| 1 | What Is an API? | ONSET, MOTION |
| 2 | Requests and Responses | ONSET, SCREENCAST |
| 3 | Understanding JSON | MOTION, SCREENCAST |

**Stage 2: Working with an API**

| Video | Title | Sections, in order |
|---|---|---|
| 1 | Making API Requests | ONSET, SCREENCAST |
| 2 | Handling Errors | ONSET, MOTION, SCREENCAST, ONSET |
| 3 | Wrapping Up | ONSET |

Stage 2, Video 2 is deliberately the longest video. It covers 200, 404, and 422 responses in depth so that, at the planned default speaking rate of about 140 words per minute, it exceeds the Production Summary's planned three-minute long-video threshold. The other videos are much shorter. The script doesn't contain any durations. Timing is a Phase 4 calculation.

## Script grammar

The parser must be able to find every structural element from **literal text on its own line**, without understanding Markdown. Matching ignores leading and trailing whitespace on a line. Blank lines carry no structural meaning, although the parser keeps blank lines inside content as paragraph breaks.

### Document structure

| Element | Literal form | Rules |
|---|---|---|
| Front matter | Any text before the first stage heading | Not part of any video. The parser keeps it separately (`frontMatter`) and doesn't apply section rules to it. |
| Stage heading | `Stage N: Title` | Must appear outside production sections. The script has exactly two stages, numbered from 1. |
| Video heading | `Video N: Title` | Must follow a stage heading and appear outside production sections. Each stage has exactly three videos, numbered from 1 within the stage. |
| Section open | `[ONSET]`, `[MOTION]`, `[SCREENCAST]` | Must be inside a video and on its own line. |
| Section close | `[/ONSET]`, `[/MOTION]`, `[/SCREENCAST]` | Must match the currently open section. |

Production section rules:

- Every opening tag needs a matching closing tag.
- Sections can't be nested. A section must be closed before the next one opens.
- A video can contain more than one section of the same type, and the order of sections is meaningful.
- Any non-blank line between sections that isn't a stage or video heading is invalid.

A line is treated as a tag when its entire trimmed content is an upper-case word in square brackets, with an optional `/` (regular expression `^\[/?[A-Z]+\]$`). Content that merely contains brackets, such as a JSON array inside a sentence or on a line with other text, is not a tag.

### Internal annotations

Annotations are markers inside a production section. They are not sections themselves.

| Annotation | Kind | Allowed in | Meaning | Spoken? |
|---|---|---|---|---|
| `[ACTION]` | Block | SCREENCAST | Something the screen recorder does | No |
| `[VISUAL]` | Block | MOTION | What the motion graphic should communicate | No |
| `[VOICEOVER]` | Block | MOTION, SCREENCAST | Narration recorded over the visuals or screen | **Yes** |
| `[HIGHLIGHT]` | Block | MOTION, SCREENCAST | What to emphasize on screen | No |
| `[PAUSE]` | Cue | ONSET, MOTION, SCREENCAST | A deliberate pause in delivery | No content |

Rules:

- Each annotation goes on its own line. There are no closing annotation tags, and annotations can't be nested.
- A **block** annotation starts a block that continues until the next block annotation or the end of the enclosing section.
- `[PAUSE]` is a **standalone cue**. It has no content and **does not end the current block**, so the text after it continues the same block. In a `[VOICEOVER]` block, for example, narration continues after the pause.
- ONSET sections contain only narration prose and `[PAUSE]` cues. All prose in an ONSET section is spoken.
- In MOTION and SCREENCAST sections, the first non-blank line must be a block annotation. Only `[VOICEOVER]` content is spoken.
- Any other bracketed upper-case tag, such as `[NARRATION]`, is an unknown annotation and an error.

**Why `[HIGHLIGHT]` is a block.** A bare `[HIGHLIGHT]` line can't say what to highlight. So `[HIGHLIGHT]` introduces a short block that names the on-screen element, often with the exact text to look for, such as the `"temperature_c": null` line in a response. This makes `[HIGHLIGHT]` follow the same rule as the other block annotations, which keeps the parser simpler. Only `[PAUSE]` is a standalone cue.

### Spoken words versus non-spoken content

The planned timing estimate counts only spoken words:

- **Counted:** prose in ONSET sections and the content of `[VOICEOVER]` blocks.
- **Not counted:** `[ACTION]`, `[VISUAL]`, and `[HIGHLIGHT]` content, which includes URLs, commands, and JSON examples. Headings, front matter, and the tags themselves are also not counted.

## Google Docs portability

The script will be copied into Google Docs, so:

- Structure is defined only by literal text lines. It doesn't rely on headings, bold, tables, lists, or code fences.
- Every tag, heading, and paragraph is its own paragraph, separated by a blank line.
- API examples are plain text, and each JSON example fits on a single line. This keeps them intact when pasted, and their brackets are never mistaken for tags.
- The `.md` extension is only for convenient viewing on GitHub. The content is plain text.

## Relationship to the FastAPI application

Every endpoint, batch ID, field value, and response body in the script comes from the Phase 1 API and was checked against it:

- `GET /api/v1/batches/2026-014` and `/2026-025` (200)
- `GET /api/v1/batches` (12 batches, `2025-003` through `2027-002`)
- `GET /api/v1/batches?status=fermenting` (`2026-005`, `2026-009`, `2026-014`, `2026-025`)
- `GET /api/v1/batches?status=planned` (2 batches, both with a `null` temperature)
- `GET /api/v1/batches/1999-000` (404 `{"detail": "Batch not found"}`)
- `GET /api/v1/batches?status=spilled` and `?status=Fermenting` (422)

The 422 body is FastAPI and Pydantic's default validation error. Its exact wording depends on the library versions locked in `uv.lock`, so recheck it after upgrading dependencies.

### Recording setup

Before recording any screencast, start the API from the repository root:

```bash
uv sync
uv run uvicorn api.main:app
```

The screencasts use Swagger UI at `http://127.0.0.1:8000/docs`. The 422 demonstration uses `curl` in a terminal, because Swagger UI steers you toward valid values for the `status` parameter.

## Fixtures

- **Expected structure.** [`fixtures/expected-structure.json`](fixtures/expected-structure.json) lists each stage and video by number and title, plus the exact sequence of production sections in each video. It was written from the course outline *before* the script was finished, not generated from the script. That keeps it an independent acceptance target for the parser.
- **Malformed scripts.** [`fixtures/malformed-script.md`](fixtures/malformed-script.md) contains four isolated cases. See [`fixtures/README.md`](fixtures/README.md).

## Production artifacts

The parser in [`parser/`](../parser) (Phase 3A) reads and validates the script. The Apps Script tooling in [`apps-script/`](../apps-script) (Phase 3B) reads the script from a Google Doc and generates the first three documents below. The Production Summary is planned for Phase 4.

- **ONSET**: presenter narration for the teleprompter.
- **MOTION**: visual instructions and voiceover for the motion designer.
- **SCREENCAST**: actions and voiceover for the screen recording.
- **Production Summary** *(planned, Phase 4)*: estimated duration per video, content statistics, a configurable long-video warning (default three minutes), and validation findings.

The ONSET, MOTION, and SCREENCAST generators are implemented and tested offline. Running them against a real Google account is a manual checkpoint (see [`apps-script/README.md`](../apps-script/README.md#live-verification-checklist)). See [`docs/roadmap.md`](../docs/roadmap.md).
