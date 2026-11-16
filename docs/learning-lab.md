# Learning Lab (outline)

> **Status: planned.** This is an outline for a future hands-on tutorial. Only the exercises marked *available now* can be done today. The master script for Exercise 3 exists, but its guided exercise is not written yet. The parser for Exercise 4 and the Google Docs tooling for Exercise 5 also exist, and their walkthroughs are also unwritten. The estimator and Production Summary for Exercises 6 to 8 exist (Phase 4). Their offline steps work today, but their Google Docs steps haven't been checked in a live account.

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
| 4 | Parse the master script locally and break it on purpose (see below) | Planned. The parser exists; the guided exercise isn't written yet. |
| 5 | Generate production documents from a Google Doc (see below) | Planned. The tooling exists; the guided exercise isn't written yet, and the tooling hasn't been checked in a live account. |
| 6 | Change the speaking rate and watch the Production Summary change (see below) | Offline steps available now. The Google Docs steps are written but not yet checked in a live account. |
| 7 | Add a screencast allowance and see which videos cross the threshold (see below) | Offline steps available now. The Google Docs steps are written but not yet checked in a live account. |
| 8 | Compare the Production Summary with the generation manifest | Planned. The tooling exists; the guided exercise isn't written yet. |

### Exercise 3: Explore the structured master script (planned)

Learners open [`course/master-script.md`](../course/master-script.md), copy it into a Google Doc, and trace how one document carries instructions for three production teams.

Planned steps:

1. Find the stage and video headings (`Stage N: Title`, `Video N: Title`) and match them to the outline in [`course/README.md`](../course/README.md).
2. For one video, list its production sections in order and compare the list with [`course/fixtures/expected-structure.json`](../course/fixtures/expected-structure.json).
3. Inside a MOTION or SCREENCAST section, sort the content into spoken (`[VOICEOVER]`) and non-spoken (`[VISUAL]`, `[ACTION]`, `[HIGHLIGHT]`) material.
4. Predict what each generated document will contain, then check the predictions once document generation exists.

How the tags will drive generation (planned, not implemented): each top-level tag decides which document a section goes to. `[ONSET]` content will go to the ONSET teleprompter document, `[MOTION]` to the MOTION document, and `[SCREENCAST]` to the SCREENCAST document, keeping the original video and section order. The Production Summary will use the spoken content (ONSET prose and `[VOICEOVER]` blocks) to estimate each video's length. Document generation doesn't exist yet.

### Exercise 4: Parse the master script and break it (planned)

This works today with Node.js 22 or newer. The written walkthrough is still planned.

1. **Inspect the master script.** Open [`course/master-script.md`](../course/master-script.md) and pick a video, such as Stage 2, Video 2.
2. **Run the parser tests.** Run `cd parser` and then `npm test`, and note which tests compare the master script with `course/fixtures/expected-structure.json`.
3. **Examine the IR.** Run `npm run print-ir -- ../course/master-script.md`, and find the chosen video's sections, blocks, cues, and `sourceLine` values. Confirm that the section order is ONSET, MOTION, SCREENCAST, ONSET.
4. **Introduce a malformed tag.** In a copy of the script, delete one closing tag such as `[/MOTION]`, or rename a `[VOICEOVER]` to `[NARRATION]`.
5. **Observe the diagnostic.** Run `print-ir` on the copy. It exits with status 1. Read the first diagnostic's `code` and `line`, then compare them with the table in [`parser/README.md`](../parser/README.md#diagnostics).

Generating Google Docs isn't possible yet. This exercise stops at the IR and diagnostics.

### Exercise 5: Generate production documents from a Google Doc (planned)

This needs a Google account. Setup is described step by step in [`apps-script/README.md`](../apps-script/README.md). The project owner reported a successful live run of the Phase 3B workflow. The Production Summary (Phase 4) hasn't been checked in a live account yet, so treat that part as a trial run.

1. **Create the master Google Doc.** Paste `course/master-script.md` into a new Google Doc as plain text.
   *Screenshot:* the top of the document, and one MOTION section showing its tags and annotations.
2. **Set up the Apps Script project.** Add the script files and set `MASTER_DOCUMENT_ID` in Script Properties.
   *Screenshot:* the editor's file list and the Script properties panel. Hide the ID if you'll share the screenshot.
3. **Validate.** Run `validateMasterDocument`.
   *Expected:* `Stages: 2, videos: 6, sections: 13`, a matching structure, and `READY`.
   *Screenshot:* the execution log.
4. **Break it.** Change one `[/MOTION]` to `[/MOTON]` and run `generateProductionDocuments`.
   *Expected:* an `ERROR` line with the line and paragraph numbers, the message *"Generation blocked ... No files were created"*, and no new folder in Drive.
   *Screenshot:* the error in the log. Then undo the change.
5. **Generate.** Run `generateProductionDocuments`.
   *Expected:* a `COMPLETE` log entry and a new run folder containing four documents (ONSET, MOTION, SCREENCAST, and Production Summary) and `manifest.json`.
   *Screenshot:* the folder in Drive.
6. **Inspect the outputs.** Open each document and confirm it contains only its own role's sections. Stage 2, Video 2 should show `Part 1 of 2` and `Part 2 of 2` in the ONSET document. Instructions should look different from spoken narration.
   *Screenshot:* one page of each document.
7. **Trace the provenance.** Open `manifest.json` and match its `source.documentId`, `output.documents` URLs, and counts to what you see.
   *Screenshot:* the manifest.
8. **Regenerate.** Edit one sentence in the master and generate again.
   *Expected:* a second folder appears, the first run's documents still have the old sentence, and the two manifests have different `extractedTextSha256` values.
   *Screenshot:* both folders side by side.

### Exercise 6: Change the speaking rate

The Production Summary is a calculation from the master script plus a few stated assumptions. This exercise changes one assumption and leaves the script alone. The method is in [`production/README.md`](../production/README.md).

**Offline (Node.js 22 or newer):**

1. Run `cd production`, then `npm run print-estimate -- ../course/master-script.md`. Find Stage 2, Video 2. *Expected:* `spokenWordCount` 666, `estimatedDurationSeconds` about 285.43, and one `LONG_VIDEO_ESTIMATE` warning, because 285.43 s is over 180 s.
2. Run it again with a faster rate: `npm run print-estimate -- ../course/master-script.md '{"wordsPerMinute": 160}'`. *Expected:* every `spokenWordCount` is the same, but every duration is shorter. Stage 2, Video 2 is now about 249.75 s and still flagged.
3. Try `'{"wordsPerMinute": 230}'`. *Expected:* Stage 2, Video 2 drops to about 173.74 s, and `warnings` is empty.
4. Try `'{"wordsPerMinute": 0}'` and `'{"wordsPerMinuet": 160}'`. *Expected:* both are rejected with an `Invalid estimator configuration` error. The estimator never falls back to a default.
5. Confirm with `git status` that `course/master-script.md` is unchanged.

**In Google Docs** (after the setup in Exercise 5):

1. In **Project Settings** → **Script properties**, add `WORDS_PER_MINUTE` with the value `160`.
2. Run `validateMasterDocument`. *Expected:* the log's estimator configuration line says 160 words per minute, and the per-video estimates are shorter.
3. Run `generateProductionDocuments`, and open the new run's Production Summary next to an earlier one. *Expected:* the word counts and section counts are identical. The configuration, durations, and possibly the warnings differ.
   *Screenshot:* the two summaries' course overview sections side by side.
4. Set `WORDS_PER_MINUTE` to `230` and generate again. *Expected:* the Warnings section says no video is over the threshold under the current assumptions.
5. Delete the property, or leave it blank, to go back to 140.

### Exercise 7: Add a screencast allowance

The default screencast allowance is 0 seconds, because no evidence-based figure exists for how long on-screen actions take. That makes the default a narration-only estimate. This exercise adds an assumed allowance and checks which videos cross the three-minute threshold.

1. Predict first. From [`course/README.md`](../course/README.md#course-outline), list the videos with a SCREENCAST section. With a 60-second allowance for each one, which do you expect to go over three minutes?
2. Offline, run `npm run print-estimate -- ../course/master-script.md '{"screencastAllowanceSecondsPerSection": 60}'` in `production/`. *Expected:* Stage 1, Video 2 (123 s + 60 s = 183 s) and Stage 2, Video 2 are flagged, with `includesScreencastAllowance: true`. Stage 2, Video 1 comes to exactly 180 s and is **not** flagged, because only estimates strictly over the threshold are. Stage 1, Video 3 comes to about 165 s.
3. In Google Docs, set `SCREENCAST_ALLOWANCE_SECONDS_PER_SECTION` to `60` and generate. *Expected:* the Production Summary lists two warnings, and its methodology section describes the 60-second allowance as an assumption, not a measurement.
   *Screenshot:* the Warnings section.
4. Discuss: the allowance is the same for every SCREENCAST section, whatever its content. What evidence would you need before choosing a real figure?

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
- [ ] Passing `npm test` output for the parser (Phase 3A)
- [ ] `print-ir` output for one video, showing sections, blocks, and line numbers (Phase 3A)
- [ ] A diagnostic produced by a deliberately broken copy of the script (Phase 3A)
- [ ] Apps Script project and its validation log (Phase 3B)
- [ ] A blocked generation run with its error line, and no new folder (Phase 3B)
- [ ] A run folder with four documents and `manifest.json` (Phases 3B and 4)
- [ ] Two run folders after regeneration, with the first unchanged (Phase 3B)
- [ ] Each of the four generated documents (Phases 3 and 4)
- [ ] A Production Summary with a long-video warning (Phase 4)
- [ ] Two Production Summaries at different speaking rates, side by side (Phase 4, Exercise 6)
- [ ] A Production Summary's Warnings section with a 60-second screencast allowance (Phase 4, Exercise 7)
- [ ] Validation findings for a deliberately malformed script (Phase 3)
- [ ] The master script next to the generated outputs it produced (Phases 3 and 4)
