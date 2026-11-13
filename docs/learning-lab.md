# Learning Lab (outline)

> **Status: planned.** This is an outline for a future hands-on tutorial. Only the exercises marked *available now* can be done today. The master script for Exercise 3 exists, but its guided exercise is not written yet. The other exercises depend on work in Phases 3 and 4.

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
| 3 | Explore the structured master script (see below) | Planned. The script exists; the guided exercise isn't written yet. |
| 4 | Install the Apps Script parser and run it against the master doc | Planned (Phase 3) |
| 5 | Break the document structure on purpose and read the validation findings | Planned (Phase 3) |
| 6 | Generate the Production Summary and adjust the long-video threshold | Planned (Phase 4) |
| 7 | Inspect the generation manifest | Planned (Phase 4) |

### Exercise 3: Explore the structured master script (planned)

Learners open [`course/master-script.md`](../course/master-script.md), copy it into a Google Doc, and trace how one document carries instructions for three production teams.

Planned steps:

1. Find the stage and video headings (`Stage N: Title`, `Video N: Title`) and match them to the outline in [`course/README.md`](../course/README.md).
2. For one video, list its production sections in order and compare the list with [`course/fixtures/expected-structure.json`](../course/fixtures/expected-structure.json).
3. Inside a MOTION or SCREENCAST section, sort the content into spoken (`[VOICEOVER]`) and non-spoken (`[VISUAL]`, `[ACTION]`, `[HIGHLIGHT]`) material.
4. Predict what each generated document will contain, then check the predictions in Exercises 4 to 6 once those exist.

How the tags will drive generation (planned, not implemented): each top-level tag decides which document a section goes to. `[ONSET]` content will go to the ONSET teleprompter document, `[MOTION]` to the MOTION document, and `[SCREENCAST]` to the SCREENCAST document, keeping the original video and section order. The Production Summary will use the spoken content (ONSET prose and `[VOICEOVER]` blocks) to estimate each video's length. Document generation doesn't exist yet.

## Evidence and screenshot checklist

Capture these as the lab is built, and store them in `docs/screenshots/`:

- [ ] Swagger UI showing the three endpoints
- [ ] A successful `GET /api/v1/batches?status=fermenting` response
- [ ] A 404 response for an unknown batch
- [ ] A 422 response for an unsupported status
- [ ] Passing `uv run pytest` output
- [ ] The master script pasted into Google Docs (Phase 2 content, exercise planned)
- [ ] A close-up of production tags and internal annotations in the Google Doc
- [ ] Swagger UI next to the matching SCREENCAST instructions in the script
- [ ] Apps Script project and its run log (Phase 3)
- [ ] Each of the four generated documents (Phases 3 and 4)
- [ ] A Production Summary with a long-video warning (Phase 4)
- [ ] Validation findings for a deliberately malformed script (Phase 3)
- [ ] The master script next to the generated outputs it produced (Phases 3 and 4)
