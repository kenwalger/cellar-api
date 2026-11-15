# apps-script/

A Google Apps Script project that reads the master course script from a Google Doc, validates it with the portable parser, and generates three role-specific Google Docs (ONSET, MOTION, and SCREENCAST) plus a JSON manifest. Each run gets a new Drive folder.

**Status: Phase 3B, implementation complete and tested offline.** All logic except the Google API calls is covered by Node tests that use test doubles. **Running it against a real Google account is a manual acceptance checkpoint that hasn't been completed yet.** See [Live verification checklist](#live-verification-checklist).

The Production Summary and duration estimates are Phase 4 and aren't included.

## How it works

```text
Master Google Doc
  → DocumentReader   paragraphs → text lines (+ line→paragraph map, extraction diagnostics)
  → ProductionScript the unchanged portable parser (IR + diagnostics)
  → Validation       blocks on errors; optional check against the expected course outline
  → Render           IR → ONSET / MOTION / SCREENCAST document models
  → Generator        new run folder → 3 Google Docs → manifest.json
```

The parser decides what the document means. The adapter only reads text, writes documents, and records provenance. It never reinterprets the script.

## Files

| File | Runs in | Purpose |
|---|---|---|
| `ProductionScript.js` | Both | **Generated.** A byte-for-byte copy of `parser/src/production-script.cjs`. |
| `GeneratedData.js` | Both | **Generated.** The expected course structure (from `course/fixtures/expected-structure.json`), the parser version, and the SHA-256 of the parser core. |
| `Config.js` | Both | Reads and validates Script Properties. |
| `DocumentReader.js` | Both | Extracts text from a document body and reports unsupported content. |
| `Validation.js` | Both | Parses, compares structure, decides generate/block, and formats the log report. |
| `Render.js` | Both | Builds each role document's paragraphs from the IR. |
| `Manifest.js` | Both | Folder naming, digest hex conversion, and the manifest object. |
| `Generator.js` | Both | Orchestrates a run through an injected `services` object. |
| `GoogleServices.js` | Apps Script | The only file that calls `DocumentApp`, `DriveApp`, and `Utilities`. |
| `Main.js` | Apps Script | The manual entry points `validateMasterDocument()` and `generateProductionDocuments()`. |
| `appsscript.json` | Apps Script | V8 runtime, UTC time zone, and OAuth scopes. |
| `tests/`, `package.json` | Node | Offline tests. These aren't part of the Apps Script project. |

"Both" means the file runs in Apps Script and is also loaded by the Node tests. Every `.js` file is a plain script that defines one global and has no `import`, `export`, or `require`, as Apps Script requires. Files can be loaded in any order, because each one refers to the others only inside functions.

**Never edit the two generated files by hand.** After you change the parser core or the expected-structure fixture, run this from the repository root:

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
   `ProductionScript`, `GeneratedData`, `Config`, `DocumentReader`, `Validation`, `Render`, `Manifest`, `Generator`, `GoogleServices`, `Main`.
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

These values aren't secrets, but they identify your files, so they stay in your project and not in the repository. If a value is missing or malformed, both entry points stop with a configuration error before opening any document.

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
```

`N` is the number of lines read from the document. It can differ slightly from the Markdown file. For example, Docs may or may not keep a trailing empty paragraph.

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

Run `generateProductionDocuments`. It repeats the validation, and if there are errors it stops with *"Generation blocked ... No files were created."* Otherwise it logs:

```text
COMPLETE: run 1a2b3c4d
Output folder: https://drive.google.com/drive/folders/...
ONSET: https://docs.google.com/document/d/.../edit
MOTION: https://docs.google.com/document/d/.../edit
SCREENCAST: https://docs.google.com/document/d/.../edit
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
- **Cues:** a `[PAUSE]` cue is shown in bold dark red.
- **Verbatim text:** every source line becomes one paragraph, unchanged. Blank lines stay as empty paragraphs. URLs and JSON are copied exactly. Nothing is summarized or reworded.

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

Each run folder contains `manifest.json` (`schemaVersion` 1):

```json
{
  "schemaVersion": 1,
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
  "output": {
    "folderId": "…",
    "folderUrl": "https://drive.google.com/drive/folders/…",
    "folderName": "Digital Cellar Production — 2026-11-13 231605 UTC — 1a2b3c4d",
    "documents": [
      { "role": "ONSET", "id": "…", "title": "ONSET — Understanding APIs: A Winery's Digital Cellar — 1a2b3c4d", "url": "…", "status": "complete" },
      { "role": "MOTION", "id": "…", "title": "…", "url": "…", "status": "complete" },
      { "role": "SCREENCAST", "id": "…", "title": "…", "url": "…", "status": "complete" }
    ]
  },
  "counts": { "stages": 2, "videos": 6, "sections": { "ONSET": 6, "MOTION": 3, "SCREENCAST": 4, "total": 13 } },
  "structureCheck": { "checked": true, "matches": true },
  "warnings": [],
  "error": null
}
```

Field notes:

- **`source.extractedTextSha256`:** a hash of the exact text the parser received. Matching hashes mean identical parser input.
- **`source.lastUpdated`:** the Drive last-modified time of the master document. DocumentApp doesn't expose a revision ID, so none is recorded.
- **`parser.coreSha256`:** a hash of `parser/src/production-script.cjs`, computed by the sync script. It identifies the exact parser that ran.
- **`warnings`:** warnings only, with their source, code, line, and message. A run with errors never generates.
- **Content:** the manifest contains no document content.

## Failures

Everything that can be checked is checked before the first write: configuration, document access, extraction, parsing, structure, and the output folder. All three documents are also rendered in memory before anything is created in Drive. If a Drive or Docs call still fails partway through:

- The run **throws**, so the execution is shown as failed and never as complete.
- If the run folder was created, a `manifest.json` with `"status": "failed"`, the error message, and every document created so far is written into it. Each document has `"status": "complete"` or `"incomplete"`. The folder is renamed with ` — FAILED` at the end.
- The log lists the partial folder and document URLs.
- **Nothing is deleted.** Earlier runs are never touched, and a failed run's folder is never reused. Running again creates a new folder.
- If a document was created but couldn't be moved into the run folder, the error message includes that document's URL. It will be in My Drive.

## Live verification checklist

These steps need a person with a Google account, and **none of them has been done yet**. Record the results (and screenshots, per [`docs/learning-lab.md`](../docs/learning-lab.md)) before calling Phase 3B verified end to end.

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

## Limitations

- **Read only from the body:** headers, footers, footnote text, and comments aren't read, and multi-tab documents are rejected.
- **Unchecked formatting:** the output formatting (heading styles and colors) has been specified but not yet seen in a real document.
- **Execution time:** generation runs inside Apps Script's per-execution time limit, about six minutes for consumer accounts. The six-video course is far below it.
- **Broad scope:** the `drive` scope covers all of the user's Drive files.
- **Time zone:** run folder timestamps are UTC, regardless of your time zone.
