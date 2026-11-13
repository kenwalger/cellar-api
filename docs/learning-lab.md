# Learning Lab (outline)

> **Status: planned.** This is an outline for a future hands-on tutorial. Only the exercises marked *available now* can be done today. Everything else depends on work in Phases 2 to 4.

## Learning objectives

By the end of the lab, a learner should be able to:

1. Explain how a single structured document can act as the source for several production artifacts.
2. Design a tagging convention (`[ONSET]`, `[MOTION]`, `[SCREENCAST]`) that a program can parse reliably.
3. Parse a Google Doc into an intermediate representation using Google Apps Script.
4. Validate document structure and report findings instead of failing silently.
5. Generate several Google Docs from one source, along with a production summary and a generation manifest.

## Prerequisites

- Comfort reading Python and JavaScript
- A Google account with access to Google Docs and Apps Script (needed from Phase 3 on)
- Python 3.11+ and `uv` (for the API exercises)

## Expected outcomes

- A working copy of the Digital Cellar API running locally
- A master course script in Google Docs
- Generated ONSET, MOTION, SCREENCAST, and Production Summary documents
- A record of the validation findings for an intentionally flawed script

## Exercises

| # | Exercise | Status |
|---|---|---|
| 1 | Run the Digital Cellar API locally and explore it in Swagger UI | Available now |
| 2 | Read the tests and add one for a new edge case | Available now |
| 3 | Study the master course script and its section tags | Planned (Phase 2) |
| 4 | Install the Apps Script parser and run it against the master doc | Planned (Phase 3) |
| 5 | Break the document structure on purpose and read the validation findings | Planned (Phase 3) |
| 6 | Generate the Production Summary and adjust the long-video threshold | Planned (Phase 4) |
| 7 | Inspect the generation manifest | Planned (Phase 4) |

## Evidence and screenshot checklist

Capture these as the lab is built, and store them in `docs/screenshots/`:

- [ ] Swagger UI showing the three endpoints
- [ ] A successful `GET /api/v1/batches?status=fermenting` response
- [ ] A 404 response for an unknown batch
- [ ] A 422 response for an unsupported status
- [ ] Passing `uv run pytest` output
- [ ] Master Google Doc showing tagged sections (Phase 2)
- [ ] Apps Script project and its run log (Phase 3)
- [ ] Each of the four generated documents (Phases 3 and 4)
- [ ] A Production Summary with a long-video warning (Phase 4)
- [ ] Validation findings for a deliberately malformed script (Phase 3)
