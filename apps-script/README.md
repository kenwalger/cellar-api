# apps-script/

A Google Apps Script project that reads the master course script from a Google Doc, validates it with the portable parser, and generates four Google Docs plus a JSON manifest. Three are role-specific (ONSET, MOTION, and SCREENCAST), and the fourth is a **Production Summary** with spoken-word counts, estimated narration time, and long-video warnings. Each run gets a new Drive folder.

**Status:**

- **Phase 3B (ONSET, MOTION, SCREENCAST, and the manifest):** implemented and tested offline. The project owner reported a successful live run in Google Docs. Item-by-item results and screenshots for the [checklist](#live-verification-checklist) haven't been recorded in the repository.
- **Phase 4 (the estimator, the Production Summary, and manifest schema 2):** implemented and tested offline. The project owner reported a successful live run on November 16, 2026 (run `6146a211`).
- **Phase 4b (cleanup: SCREENCAST examples, PAUSE spacing, the Production Summary overview and wording, and the revised narration):** implemented and tested offline. **It hasn't been run in a live Google account yet.** See [Phase 4b](#phase-4b-cleanup-and-final-acceptance) in the checklist.

All logic except the Google API calls is covered by Node tests that use test doubles.

## How it works

```text
Master Google Doc
  → DocumentReader   paragraphs → text lines (+ line→paragraph map, extraction diagnostics)
  → ProductionScript the unchanged portable parser (IR + diagnostics)
  → Validation       blocks on errors; optional check against the expected course outline
  → ProductionEstimator  the unchanged portable estimator: IR → word counts, durations, warnings
  → Render           IR → ONSET / MOTION / SCREENCAST document models
  → Summary          estimate → Production Summary document model
  → Generator        new run folder → 4 Google Docs → manifest.json
```

The parser decides what the document means, and the estimator does every calculation. The adapter only reads text, writes documents, and records provenance. It never reinterprets the script or recalculates an estimate.

## Files

| File | Runs in | Purpose |
|---|---|---|
| `ProductionScript.js` | Both | **Generated.** A byte-for-byte copy of `parser/src/production-script.cjs`. |
| `ProductionEstimator.js` | Both | **Generated.** A byte-for-byte copy of `production/src/production-estimator.cjs`. |
| `GeneratedData.js` | Both | **Generated.** The expected course structure (from `course/fixtures/expected-structure.json`), plus the versions and SHA-256 hashes of the parser and estimator cores. |
| `Config.js` | Both | Reads and validates Script Properties, including the estimator settings. |
| `DocumentReader.js` | Both | Extracts text from a document body and reports unsupported content. |
| `Validation.js` | Both | Parses, compares structure, decides generate/block, and formats the log report. |
| `Render.js` | Both | Builds each role document's paragraphs from the IR. |
| `Summary.js` | Both | Builds the Production Summary's paragraphs and the estimate log lines from the estimator's result. |
| `Manifest.js` | Both | Folder naming, digest hex conversion, and the manifest object. |
| `Generator.js` | Both | Orchestrates a run through an injected `services` object. |
| `GoogleServices.js` | Apps Script | The only file that calls `DocumentApp`, `DriveApp`, and `Utilities`. |
| `Main.js` | Apps Script | The manual entry points `validateMasterDocument()` and `generateProductionDocuments()`. |
| `appsscript.json` | Apps Script | V8 runtime, UTC time zone, and OAuth scopes. |
| `tests/`, `package.json` | Node | Offline tests. These aren't part of the Apps Script project. |

"Both" means the file runs in Apps Script and is also loaded by the Node tests. Every `.js` file is a plain script that defines one global and has no `import`, `export`, or `require`, as Apps Script requires. Files can be loaded in any order, because each one refers to the others only inside functions.

**Never edit the three generated files by hand.** After you change the parser core, the estimator core, or the expected-structure fixture, run this from the repository root:

```bash
node scripts/sync-apps-script.mjs           # regenerate
node scripts/sync-apps-script.mjs --check   # CI runs this; exits 1 on drift
```

## Setup

You need a Google account with Google Docs and Drive. Steps 1 to 5 are done once.

### 1. Create the master Google Doc

1. Open [`course/master-script.md`](../course/master-script.md) as raw text (for example, the **Raw** view on GitHub, or a plain-text editor), select everything, and copy it.
2. Create a new Google Doc (<https://docs.new>) and paste it as **plain text** with **Ctrl+Shift+V** (**⌘+Shift+V** on a Mac). Don't use *Paste from Markdown*.
3. Check the result. Each source line should be its own paragraph, blank lines should be empty paragraphs, and the first paragraph should be `Understanding APIs: A Winery's Digital Cellar`.
4. Give the document a name, such as `Digital Cellar — Master Script`.
5. Copy the document's URL. You'll need it in step 4.

Keep the document to a single tab with plain paragraphs. Tables, images, drawings, smart chips, and extra tabs are reported as errors (see [Extraction](#extraction)).

### 2. Create the Apps Script project

Create a standalone project at <https://script.google.com> with **New project**, and name it, for example, `Digital Cellar Production`.

### 3. Add the script files

**Option A: copy and paste (no tools needed)**

1. In the editor, open **Project Settings** (the gear icon) and select **Show "appsscript.json" manifest file in editor**.
2. Back in **Editor**, replace the contents of `appsscript.json` with this repository's `apps-script/appsscript.json`.
3. Delete the default `Code.gs`.
4. For each of these files, click **+** then **Script**, type the name without `.js` (the editor adds `.gs`), and paste in the file's full contents:
   `ProductionScript`, `ProductionEstimator`, `GeneratedData`, `Config`, `DocumentReader`, `Validation`, `Render`, `Summary`, `Manifest`, `Generator`, `GoogleServices`, `Main`.

   **Upgrading a Phase 3B project:** add the two new files, `ProductionEstimator` and `Summary`, and replace the contents of every other file, because `GeneratedData`, `Config`, `Generator`, `Manifest`, `GoogleServices`, and `Main` all changed.
5. Click **Save**.

File order in the editor doesn't matter.

**Option B: [clasp](https://github.com/google/clasp) (optional)**

clasp is Google's command-line tool for Apps Script. It isn't a dependency of this repository.

```bash
npm install -g @google/clasp
clasp login
# Turn on "Google Apps Script API" at https://script.google.com/home/usersettings
cd apps-script
clasp create --type standalone --title "Digital Cellar Production"
git checkout -- appsscript.json   # in case clasp replaced it with a default manifest
clasp push
```

`.claspignore` keeps `tests/`, `package.json`, and this README out of the project. `clasp create` writes `apps-script/.clasp.json`, which contains your personal script ID. It's listed in `.gitignore`, so don't commit it.

### 4. Configure the master document

In **Project Settings** → **Script properties**, add:

| Property | Required | Value |
|---|---|---|
| `MASTER_DOCUMENT_ID` | Yes | The master Google Doc's ID or full URL |
| `OUTPUT_FOLDER_ID` | No | A Drive folder ID or URL where run folders are created. The default is the top level of My Drive. |
| `REQUIRE_EXPECTED_STRUCTURE` | No | `true` (the default) or `false`. See [Structural acceptance](#structural-acceptance). |
| `WORDS_PER_MINUTE` | No | Assumed speaking rate for the Production Summary. A number greater than 0. Default `140`. |
| `LONG_VIDEO_THRESHOLD_MINUTES` | No | A video is flagged when its estimate is **over** this many minutes. A number greater than 0. Default `3`. |
| `SCREENCAST_ALLOWANCE_SECONDS_PER_SECTION` | No | Seconds added to the estimate for each SCREENCAST section. A number of 0 or more. Default `0`, which gives a narration-only estimate. |

These values aren't secrets, but they identify your files, so they stay in your project and not in the repository. If a value is missing or malformed, both entry points stop with a configuration error before opening any document.

The three estimator settings must be plain decimal numbers, such as `150` or `2.5`. Blank or unset means the default. Anything else is an error that names the property, including units (`140 wpm`), times (`3:00`), exponents (`1e3`), hexadecimal, `Infinity`, `NaN`, negative numbers, and a zero speaking rate or threshold. They're never silently replaced with the defaults. You never need to edit a script file to change them. The method behind them is described in [`production/README.md`](../production/README.md).

### 5. Authorize

Select `validateMasterDocument` in the toolbar's function menu and click **Run**. Google asks you to authorize the project. For a personal script, Google shows *"Google hasn't verified this app"*. Choose **Advanced** → **Go to Digital Cellar Production (unsafe)** to continue with your own project.

The project requests two scopes, declared in `appsscript.json`:

- `documents`: to read the master document and write the generated documents.
- `drive`: to create the run folder, move documents into it, write `manifest.json`, and read the master document's last-updated time.

The `drive` scope is broad. It's used because the output folder can be one you created yourself (`OUTPUT_FOLDER_ID`). Narrowing it is a possible later improvement.

## Running it

### 6. Validate

Run `validateMasterDocument`, then open **Execution log**. It makes **no writes** of any kind. For the master script, the log should show:

```text
Master document: "Digital Cellar — Master Script" https://docs.google.com/document/d/.../edit
Read N lines.
Stages: 2, videos: 6, sections: 13 (ONSET 6, MOTION 3, SCREENCAST 4)
Structure check: matches the expected structure (course/fixtures/expected-structure.json).
READY: no errors. generateProductionDocuments() can run.
Estimator configuration: 140 words per minute, long-video threshold 3 minutes, screencast allowance 0 seconds per SCREENCAST section.
Stage 1, Video 1 "What Is an API?": 273 spoken words, estimated 1 min 57 s
Stage 1, Video 2 "Requests and Responses": 287 spoken words, estimated 2 min 3 s
Stage 1, Video 3 "Understanding JSON": 246 spoken words, estimated 1 min 45 s
Stage 2, Video 1 "Making API Requests": 280 spoken words, estimated 2 min 0 s
Stage 2, Video 2 "Handling Errors": 664 spoken words, estimated 4 min 45 s
Stage 2, Video 3 "Wrapping Up": 228 spoken words, estimated 1 min 38 s
Course estimate: 1978 spoken words, 14 min 8 s across 6 videos.
WARNING LONG_VIDEO_ESTIMATE: Stage 2, Video 2 "Handling Errors": estimated 4 min 45 s is over the 3 min 0 s threshold (narration only).
```

`N` is the number of lines read from the document. It can differ slightly from the Markdown file. For example, Docs may or may not keep a trailing empty paragraph.

The estimate lines appear only when there are no errors. They come from the same estimator, with the same settings, that `generateProductionDocuments` uses. A `LONG_VIDEO_ESTIMATE` warning is information for the producer. It never blocks generation.

### 7. Inspect diagnostics

Each problem is logged on one line. For example:

```text
ERROR UNCLOSED_SECTION at line 252 (document paragraph 252): "[ONSET]" — The ONSET section opened on line 252 was not closed before the heading on line 389. ...
```

- **line** is the line number in the extracted text, which is the number the parser reports.
- **document paragraph** is the position of the paragraph in the document that line came from. When a paragraph contains soft line breaks, the log adds `line K within it`.
- The quoted excerpt is the line's text, so you can find it with **Ctrl+F**.

Parser codes are documented in [`parser/README.md`](../parser/README.md#diagnostics). Extraction codes are listed [below](#extraction). The generate/block decision is:

| Severity | Effect |
|---|---|
| error | Generation is blocked and no files are created |
| warning | Logged and recorded in the manifest. Generation proceeds. |

### 8. Generate

Run `generateProductionDocuments`. It repeats the validation, and if there are errors it stops with *"Generation blocked ... No files were created."* Otherwise it logs the estimate lines shown above, followed by:

```text
COMPLETE: run 1a2b3c4d
Output folder: https://drive.google.com/drive/folders/...
ONSET: https://docs.google.com/document/d/.../edit
MOTION: https://docs.google.com/document/d/.../edit
SCREENCAST: https://docs.google.com/document/d/.../edit
PRODUCTION_SUMMARY: https://docs.google.com/document/d/.../edit
Manifest: https://drive.google.com/file/d/.../view
```

### 9. Find the output folder

The folder is in My Drive, or in `OUTPUT_FOLDER_ID` if you set it, and is named:

```text
Digital Cellar Production — 2026-11-13 231605 UTC — 1a2b3c4d
```

The timestamp is in UTC. The last part is the run ID, from a fresh UUID for each run.

### 10. Inspect the documents and manifest

Each document starts with the course title, the role, and a provenance line (source document name, generation time, and run ID). Then come stage headings (Heading 1) and video headings (Heading 2), each followed by that role's content:

| Document | Contains | Excludes |
|---|---|---|
| ONSET | Every ONSET section: narration and `[PAUSE]` cues | MOTION and SCREENCAST content |
| MOTION | Every MOTION section: `VISUAL`, `VOICEOVER`, and `HIGHLIGHT` blocks, and `[PAUSE]` cues | ONSET and SCREENCAST content |
| SCREENCAST | Every SCREENCAST section: `ACTION`, `VOICEOVER`, and `HIGHLIGHT` blocks, and `[PAUSE]` cues | ONSET and MOTION content |

The grammar doesn't allow `[HIGHLIGHT]` in ONSET, so the ONSET document only ever has `[PAUSE]` cues.

Rendering rules:

- **Order:** stages, videos, sections, blocks, and cues keep their source order.
- **Omitted videos:** a video with no sections for a role is left out of that role's document, and so is a stage with no remaining videos. If a role has no sections at all, its document contains a single note saying so.
- **Repeated sections:** when a video has more than one section of the role, each gets a `Part N of M` heading (Heading 3). For example, Stage 2, Video 2 has two ONSET parts.
- **Labels:** each block starts with its annotation name (`VISUAL`, `VOICEOVER`, `ACTION`, `HIGHLIGHT`) in bold blue.
- **Spoken and unspoken text:** spoken text (ONSET narration and `VOICEOVER`) is plain black. Production instructions (`ACTION`, `VISUAL`, `HIGHLIGHT`) are gray italics.
- **Cues:** a `[PAUSE]` cue is shown as `[PAUSE]` in bold dark red, with 6 points of space before and after. The blank lines that separate a cue's tag line from its neighbors in the script aren't written, so a cue sits directly between the lines around it, in its source position. Blank lines between other paragraphs stay. The parser's IR and the estimator are unaffected.
- **Technical examples (SCREENCAST only):** in a SCREENCAST `ACTION` or `HIGHLIGHT` block, a line ending with a colon, such as `Run:` or `The response body:`, introduces an example. The next run of non-blank lines, after any blank lines, is shown in Courier New, upright (not italic), and indented. The run ends at a blank line or a cue. This is a layout convention ([`course/README.md`](../course/README.md#technical-examples-in-screencast-sections)). The text itself is never inspected for braces, URLs, or commands, and it's never changed. Code-like text without a lead-in, such as the `"temperature_c": null` highlight or `The Request URL: http://…`, stays a gray italic direction. Narration and the ONSET and MOTION documents never use this style.
- **Verbatim text:** every source line becomes one paragraph, unchanged. Blank lines between paragraphs stay as empty paragraphs. URLs and JSON are copied exactly. Nothing is summarized or reworded.

The ONSET, MOTION, and SCREENCAST documents are unchanged by Phase 4. A test checks that the generator still writes exactly what `Render` produces.

#### Production Summary

The fourth document, titled `Production Summary — <course title> — <run ID>`, contains no script content. Every number in it comes from the estimator ([`production/README.md`](../production/README.md)). Its sections are:

| Section | Contents |
|---|---|
| Title and provenance | Course title, subtitle, generation time, source document title and link, run ID, and a note that durations are estimates |
| Estimator configuration | Words per minute, long-video threshold, screencast allowance, and estimator version |
| Course overview | Stage, video, and section counts; total spoken words; estimated narration, screencast allowance, and total; videos over the threshold |
| Video overview | A native Google Docs table with one row per video, in source order. The columns are **Video** (`S2 V2 — Handling Errors`), **Spoken words**, **Estimated duration**, and **Status** (`Within` or `Over` the threshold). The header is bold, the two number columns are right-aligned, and cells wrap, so long titles are shown in full. |
| Video breakdown | For each stage (Heading 2) and video (Heading 3): section sequence, section counts, spoken words, narration, allowance, estimated total, and status against the threshold. When some counted words are URLs, paths, or code, a note says so, with correct singular and plural wording: `Spoken words: 287 (includes 1 URL, path, or code token that may take longer to narrate)`. |
| Warnings | One bold dark-red line per `LONG_VIDEO_ESTIMATE` warning, or a note saying no video is over the threshold under the current assumptions |
| Estimation methodology | How words are counted, the speaking rate, the screencast allowance, the threshold rule, the rounding rule, and what the estimate leaves out |
| Provenance | Run ID, generation time, run folder name, a pointer to `manifest.json`, and the parser and estimator versions and hashes |

The document uses the same plain styles as the other three: built-in headings, normal text, and gray italics for notes. The video overview is its only table. There are no charts or custom fonts. Durations are shown rounded to the nearest second (`4 min 45 s`), in the table too. Calculations use the unrounded values.

Parser warnings (diagnostics) aren't repeated in the Production Summary. They're in the execution log and in the manifest's `warnings`.

`manifest.json` is described in [Manifest](#manifest).

### 11 and 12. Edit, regenerate, and confirm earlier runs are unchanged

1. Change a sentence of narration in the master document.
2. Run `validateMasterDocument`, then `generateProductionDocuments`.
3. A **second** run folder appears with a new timestamp and run ID.
4. Open the first run's documents. They still have the old text, because generated documents are never synchronized with the master.
5. Compare the two manifests. `source.extractedTextSha256` and `source.lastUpdated` differ, and `runId` and `output` point to different files.

Also try a blocked run. Change a `[/MOTION]` to `[/MOTON]` and run `generateProductionDocuments`. The log shows an error with its line and paragraph, and no folder is created. Undo the change afterward.

## Structural acceptance

With `REQUIRE_EXPECTED_STRUCTURE` set to `true` (the default), the document's structure must exactly match `course/fixtures/expected-structure.json`, embedded as `GeneratedData.expectedStructure`. That means the same stage and video numbers and titles, and the same section sequence for each video. Any difference is logged as a `STRUCTURE_MISMATCH` error with its path, for example:

```text
ERROR STRUCTURE_MISMATCH: Doesn't match the expected course outline: stages[1].videos[1].sections: expected [ONSET, MOTION, SCREENCAST, ONSET], found [ONSET, MOTION, SCREENCAST]
```

A mismatch blocks generation. This is the acceptance checkpoint for the learning lab: documents are generated only from a Google Doc that reproduces the expected six-video course. The check runs only when the document parses without errors, so it doesn't pile onto parser errors.

The parser itself stays generic. To use the tooling with a different course, set `REQUIRE_EXPECTED_STRUCTURE` to `false`.

The fixture is never regenerated from parser output. `GeneratedData.js` is generated *from the fixture*.

## Extraction

`DocumentReader` reads the body of the document's single tab:

- **Paragraphs and list items:** each one is read with `getText()`. Formatting such as headings, bold, links, and colors is ignored and never treated as structure.
- **Soft line breaks:** a soft line break within a paragraph (**Shift+Enter**) splits it into separate lines. Docs may report the break as `\r`, `\n`, or a vertical tab, and all three are handled. So a paragraph doesn't always equal one line. The line→paragraph map keeps diagnostics pointing at the right place.
- **Empty paragraphs:** these become blank lines.
- **Fidelity:** the goal is the same structure and content, not a byte-for-byte copy of the Markdown file.

| Code | Severity | Cause |
|---|---|---|
| `UNSUPPORTED_ELEMENT` | error | A body element that isn't a paragraph or list item, such as a table or table of contents. It's reported with its position and not read. |
| `UNSUPPORTED_INLINE_ELEMENT` | error | A paragraph containing an image, drawing, equation, footnote, smart chip, or other non-text element whose content would be lost |
| `IGNORED_INLINE_ELEMENT` | warning | A paragraph containing a page break or horizontal rule. No text is lost. |
| `LIST_FORMATTING_IGNORED` | warning | List items were read as plain text, so their bullets and numbers aren't included. One warning per document. |
| `MULTIPLE_TABS` | error | The document has more than one tab, and content in other tabs would be missed |

Unsupported content is reported, never dropped silently, and nothing is repaired.

## Manifest

Each run folder contains `manifest.json` (`schemaVersion` 2):

```json
{
  "schemaVersion": 2,
  "status": "complete",
  "runId": "1a2b3c4d",
  "generatedAt": "2026-11-13T23:16:05.000Z",
  "source": {
    "documentId": "…",
    "documentUrl": "https://docs.google.com/document/d/…/edit",
    "documentTitle": "Digital Cellar — Master Script",
    "lastUpdated": "2026-11-13T22:58:41.000Z",
    "extractedTextSha256": "…64 hex characters…",
    "extractedLineCount": 401
  },
  "parser": { "version": "0.1.0", "coreSha256": "…64 hex characters…" },
  "estimator": {
    "schemaVersion": 1,
    "version": "0.1.0",
    "coreSha256": "…64 hex characters…",
    "config": { "wordsPerMinute": 140, "longVideoThresholdMinutes": 3, "screencastAllowanceSecondsPerSection": 0 }
  },
  "output": {
    "folderId": "…",
    "folderUrl": "https://drive.google.com/drive/folders/…",
    "folderName": "Digital Cellar Production — 2026-11-13 231605 UTC — 1a2b3c4d",
    "documents": [
      { "role": "ONSET", "id": "…", "title": "ONSET — Understanding APIs: A Winery's Digital Cellar — 1a2b3c4d", "url": "…", "status": "complete" },
      { "role": "MOTION", "id": "…", "title": "…", "url": "…", "status": "complete" },
      { "role": "SCREENCAST", "id": "…", "title": "…", "url": "…", "status": "complete" },
      { "role": "PRODUCTION_SUMMARY", "id": "…", "title": "Production Summary — …", "url": "…", "status": "complete" }
    ]
  },
  "counts": { "stages": 2, "videos": 6, "sections": { "ONSET": 6, "MOTION": 3, "SCREENCAST": 4, "total": 13 } },
  "structureCheck": { "checked": true, "matches": true },
  "warnings": [],
  "estimate": {
    "totals": {
      "stageCount": 2,
      "videoCount": 6,
      "sectionCounts": { "ONSET": 6, "MOTION": 3, "SCREENCAST": 4 },
      "spokenWordCount": 1978,
      "technicalTokenCount": 7,
      "narrationDurationSeconds": 847.7142857142857,
      "screencastAllowanceSeconds": 0,
      "estimatedDurationSeconds": 847.7142857142857,
      "videosOverThreshold": 1
    },
    "videos": [
      { "stageNumber": 1, "videoNumber": 1, "title": "What Is an API?", "spokenWordCount": 273, "technicalTokenCount": 0, "narrationDurationSeconds": 117, "screencastAllowanceSeconds": 0, "estimatedDurationSeconds": 117 },
      "… one entry per video …"
    ],
    "warnings": [
      { "code": "LONG_VIDEO_ESTIMATE", "stageNumber": 2, "videoNumber": 2, "title": "Handling Errors", "estimatedDurationSeconds": 284.57142857142856, "thresholdSeconds": 180, "includesScreencastAllowance": false }
    ]
  },
  "error": null
}
```

Field notes:

- **`source.extractedTextSha256`:** a hash of the exact text the parser received. Matching hashes mean identical parser input.
- **`source.lastUpdated`:** the Drive last-modified time of the master document. DocumentApp doesn't expose a revision ID, so none is recorded.
- **`parser.coreSha256`:** a hash of `parser/src/production-script.cjs`, computed by the sync script. It identifies the exact parser that ran.
- **`warnings`:** parser and extraction warnings only, with their source, code, line, and message. A run with errors never generates.
- **`estimator`:** the estimator output schema, the package version, the SHA-256 of `production/src/production-estimator.cjs`, and the configuration that was used. Together with `parser` and `source.extractedTextSha256`, this is enough to reproduce every number in the Production Summary offline.
- **`estimate`:** unrounded numbers only: course totals, one entry per video, and the `LONG_VIDEO_ESTIMATE` warnings. Warning messages and methodology text are in the Production Summary, not here. Long-video warnings are separate from the diagnostic `warnings` above, and they never block generation.
- **Content:** the manifest contains no document content.

**Schema change from version 1 to 2 (Phase 4).** These are additions only: the `estimator` and `estimate` objects and a fourth `output.documents` entry with role `PRODUCTION_SUMMARY`. No version 1 field was removed or renamed. The version was raised because a reader that expects exactly three documents would otherwise misread a version 2 manifest.

## Failures

Everything that can be checked is checked before the first write: configuration (including the estimator settings), document access, extraction, parsing, structure, the production estimate, and the output folder. All four documents are also rendered in memory before anything is created in Drive. If the estimator rejects its settings or the document, the run stops with no folder created. If a Drive or Docs call still fails partway through:

- The run **throws**, so the execution is shown as failed and never as complete.
- If the run folder was created, a `manifest.json` with `"status": "failed"`, the error message, every document created so far, and the estimate is written into it. Each document has `"status": "complete"` or `"incomplete"`. The folder is renamed with ` — FAILED` at the end.
- The log lists the partial folder and document URLs.
- **Nothing is deleted.** Earlier runs are never touched, and a failed run's folder is never reused. Running again creates a new folder.
- If a document was created but couldn't be moved into the run folder, the error message includes that document's URL. It will be in My Drive.

## Live verification checklist

These steps need a person with a Google account. Record the results (and screenshots, per [`docs/learning-lab.md`](../docs/learning-lab.md)) in the repository.

### Phase 3B: three role documents and the manifest

**The project owner reported a successful live run of the Phase 3B workflow in Google Docs.** The item-by-item results and screenshots weren't supplied, so the boxes below are left for the owner to tick.

- [ ] All script files load without a syntax error, and `ProductionScript.parseProductionScript` exists. This confirms the unchanged parser core runs on Apps Script V8.
- [ ] Authorization succeeds with the two declared scopes.
- [ ] `validateMasterDocument` on the pasted master script reports 2 stages, 6 videos, 13 sections, a matching structure, and READY.
- [ ] Soft line breaks: put a Shift+Enter inside one paragraph of a scratch copy. Validation reports the correct line and the "line K within it" location.
- [ ] A table or image added to a scratch copy is reported as an error.
- [ ] A malformed tag blocks generation, and no folder is created.
- [ ] `generateProductionDocuments` creates one folder containing three documents and `manifest.json`.
- [ ] The documents follow the [rendering rules](#10-inspect-the-documents-and-manifest), and their formatting is readable.
- [ ] `manifest.json` is valid JSON with the fields above, and its URLs open the right files.
- [ ] A second run creates a second folder, and the first run's files are unchanged.

### Phase 4: Production Summary

**The project owner reported a successful live Phase 4 run on November 16, 2026 (run `6146a211`, parser and estimator 0.1.0).** It produced all four documents, with 2 stages, 6 videos, 13 sections, 1,980 spoken words, 14 min 9 s of estimated narration, and one long-video warning. The item-by-item results below weren't supplied, so the boxes are left for the owner to tick. The figures in this list are for the script *before* the Phase 4b edit. After that edit, use the [Phase 4b](#phase-4b-cleanup-and-final-acceptance) figures.

- [ ] `ProductionEstimator.js` and `Summary.js` load without a syntax error, and `ProductionEstimator.estimateProduction` exists. This confirms that the estimator core, including its Unicode regular expression, runs on Apps Script V8.
- [ ] With no estimator properties set, `validateMasterDocument` logs the default configuration (140, 3, 0), the six per-video lines and course estimate shown in [step 6](#6-validate), and one `LONG_VIDEO_ESTIMATE` warning for Stage 2, Video 2.
- [ ] Setting `WORDS_PER_MINUTE` to `fast` (or `0`) makes both entry points stop with a configuration error that names the property, and no folder is created.
- [ ] `generateProductionDocuments` creates one folder containing **four** documents and `manifest.json`, and logs a `PRODUCTION_SUMMARY` URL.
- [ ] The ONSET, MOTION, and SCREENCAST documents look the same as in a Phase 3B run.
- [ ] The Production Summary has the [sections described above](#production-summary), its numbers match the validation log, the warning line is bold dark red, and it's readable without the manifest.
- [ ] `manifest.json` has `"schemaVersion": 2`, an `estimator` object whose `coreSha256` equals `GeneratedData.estimatorCoreSha256`, and four `output.documents`.
- [ ] Setting `WORDS_PER_MINUTE` to `230` removes the warning, and setting `SCREENCAST_ALLOWANCE_SECONDS_PER_SECTION` to `60` flags Stage 1, Video 2 and Stage 2, Video 2, but not Stage 2, Video 1, which lands at exactly 180 s. Each change gives a new run folder, and earlier runs are unchanged.

### Phase 4b: cleanup and final acceptance

Phase 4b changes how SCREENCAST technical examples and `[PAUSE]` cues are rendered. It adds a video overview table to the Production Summary and fixes the technical-token wording. It also revises one passage of the master script. **None of these steps has been done yet.** The repository's `course/master-script.md` and your master Google Doc are separate copies. Editing one never changes the other, and earlier generated documents are never updated.

1. **Rename the master Google Doc.** The live run recorded the source title as `Digital Cellar - Master Prduction Script`. Choose **File** → **Rename** and change it to `Digital Cellar - Master Production Script`. The generator records whatever the title actually is. It never corrects titles.
2. **Apply the revised status-code narration.** In the master Google Doc, open **Edit** → **Find and replace** (**Ctrl+H**, or **⌘+Shift+H** on a Mac). This passage is in Stage 2, Video 2 (*Handling Errors*), in the second paragraph of its first ONSET section.
   - Find: `Codes in the 400s mean there was a problem with the request the client sent. Codes in the 500s mean something went wrong on the server, even though the request itself was fine.`
   - Replace with: `Codes in the 400s generally mean the server can't or won't fulfill the client's request. Codes in the 500s mean the server encountered an error while trying to handle the request.`
   - **Replace** should report exactly one replacement. The preceding sentence, `Codes in the 200s mean the request succeeded.`, is unchanged. Don't add or remove paragraphs. If Docs turns the apostrophes into curly ones, the word count is the same.
3. **Update the Apps Script files.** `Render.js`, `Summary.js`, and `GoogleServices.js` changed. Replace their contents in the editor, or run `clasp push`. `ProductionScript.js`, `ProductionEstimator.js`, and `GeneratedData.js` didn't change.
4. **Validate.** Run `validateMasterDocument`. *Expected:* 2 stages, 6 videos, 13 sections, a matching structure, and READY. Stage 2, Video 2 shows `664 spoken words, estimated 4 min 45 s`, and the course estimate is `1978 spoken words, 14 min 8 s across 6 videos.` There's one `LONG_VIDEO_ESTIMATE` warning. If Stage 2, Video 2 still shows 666, step 2 didn't apply.
5. **Generate.** Run `generateProductionDocuments`. *Expected:* a new run folder with four documents and `manifest.json`.
6. **SCREENCAST examples.** *Expected:* the four JSON bodies and the two `curl` commands are each in Courier New, upright, indented, and character-for-character identical to the script. Their lead-ins (`Run:`, `The response body:`) and the other directions stay gray italic.
7. **PAUSE cues.** In ONSET and SCREENCAST, *expected:* each `[PAUSE]` is bold dark red and sits directly between the paragraphs around it, with a small, even gap above and below and no empty paragraphs around it. ONSET has four cues and SCREENCAST has two, in the same places as in the script.
8. **Production Summary.** *Expected:*
   - A **Video overview** table after the course overview, with six rows in source order. Only `S2 V2 — Handling Errors` reads `Over`.
   - The breakdown says `Spoken words: 287 (includes 1 URL, path, or code token that may take longer to narrate)` for Stage 1, Video 2, and uses `tokens` for Stage 1, Video 3 (2) and Stage 2, Video 3 (3).
   - The title line shows the corrected source title.
9. **Narration totals.** *Expected:* the course overview shows `Spoken words: 1978` and `Estimated total: 14 min 8 s`, down from 1,980 and 14 min 9 s in run `6146a211`.
10. **Provenance.** *Expected:* `manifest.json` has `"schemaVersion": 2`, `source.documentTitle` with the corrected title, and a new `source.extractedTextSha256`. The `parser.coreSha256` and `estimator.coreSha256` values match `GeneratedData.js`, and there are four `output.documents`. Run `6146a211`'s folder and documents are still present and unchanged.

Record the results, and the screenshots listed in [`docs/learning-lab.md`](../docs/learning-lab.md), before calling Phase 4b verified.

## Limitations

- **Read only from the body:** headers, footers, footnote text, and comments aren't read, and multi-tab documents are rejected.
- **Formatting checked only offline:** Node tests check which paragraph kind each line gets, and that the text is unchanged. The Docs styling itself can only be checked by eye in a live document: Courier New and indentation for examples, cue spacing, and the table's bold header, right-aligned numbers, and wrapping. The Production Summary's formatting was reported working in run `6146a211`, before the Phase 4b table was added.
- **Technical examples need a lead-in:** only lines after a colon lead-in in a SCREENCAST `ACTION` or `HIGHLIGHT` block are styled as examples. A code fragment written as its own direction, or inside a sentence, stays a direction. A grammar-level marker would be the reliable fix (see [`course/README.md`](../course/README.md#technical-examples-in-screencast-sections)). This phase deliberately doesn't change the grammar.
- **Estimates, not measurements:** the Production Summary's durations come from a fixed speaking rate and an optional fixed allowance. See [`production/README.md`](../production/README.md#what-the-estimate-leaves-out).
- **Execution time:** generation runs inside Apps Script's per-execution time limit, about six minutes for consumer accounts. The six-video course is far below it.
- **Broad scope:** the `drive` scope covers all of the user's Drive files.
- **Time zone:** run folder timestamps are UTC, regardless of your time zone.
