# parser/

A portable JavaScript parser and validator for the master production script, [`course/master-script.md`](../course/master-script.md). It turns the script into a deterministic **intermediate representation (IR)** plus a list of **diagnostics**. The Apps Script tooling generates the ONSET, MOTION, and SCREENCAST documents from that IR, and the estimator in [`production/`](../production) uses it for the Production Summary.

**Status: Phase 3A. Implemented and tested offline with Node.js.** The Google Docs adapter that uses it is in [`apps-script/`](../apps-script) (Phase 3B). The parser itself doesn't estimate timing. That's done by [`production/`](../production) (Phase 4), which reads the IR without changing the parser.

## Layout

```text
parser/
├── package.json               no dependencies; "npm test" runs node --test
├── src/
│   ├── production-script.cjs  portable core: parser, document checks, diagnostics
│   ├── index.js               ESM entry point for Node.js
│   └── print-ir.js            prints the parse result for a file as JSON
└── tests/
    ├── fixtures.test.js       master script and malformed-case acceptance tests
    ├── parser.test.js         IR shape and grammar edge cases
    ├── validator.test.js      diagnostic codes, lines, ordering, recovery
    ├── portability.test.js    the core runs with no module system
    └── helpers.js             Node-only file loading and fixture splitting
```

The parser, document checks, and diagnostics share one file on purpose. Google Apps Script has no module system, so a single self-contained file is the simplest thing to move there. See [Portability](#portability).

## Commands

Requires Node.js 22 or newer. There's nothing to install.

```bash
cd parser
npm test                                          # run all parser tests
npm run print-ir -- ../course/master-script.md    # print the IR and diagnostics as JSON
```

`print-ir` exits with status 1 if the script has any error diagnostics.

## Public API

```javascript
import { parseProductionScript, DiagnosticCode } from "./src/index.js";

const { document, diagnostics } = parseProductionScript(sourceText);
```

- `parseProductionScript(sourceText)` takes the full script text and returns `{ document, diagnostics }`.
  - It throws `TypeError` only when `sourceText` isn't a string.
  - Malformed scripts never throw. They return a partial `document` and one or more error diagnostics.
  - The same input always produces the same output.
- `DiagnosticCode` is a frozen object of stable diagnostic codes, such as `DiagnosticCode.UNCLOSED_SECTION`.

**Before generating anything from a document, check that no diagnostic has `severity: "error"`.** A document with errors is a best-effort partial result. It's useful for reporting, not for production output.

## Intermediate representation

```javascript
{
  frontMatter: [TextItem],           // lines before the first stage heading
  stages: [{
    number: 1,
    title: "Understanding the Interface",
    sourceLine: 5,
    videos: [{
      number: 1,
      title: "What Is an API?",
      sourceLine: 7,
      sections: [{                     // in authored order; types may repeat
        type: "ONSET" | "MOTION" | "SCREENCAST",
        sourceLine: 9,                 // line of the opening tag
        endLine: 19,                   // line of the closing tag, or null if unclosed
        content: [...]                 // see below
      }]
    }]
  }]
}
```

Section `content` depends on the section type:

| Section | `content` holds | Spoken text |
|---|---|---|
| ONSET | `TextItem` and `CueItem`, in order | Every `TextItem` |
| MOTION, SCREENCAST | `BlockItem`, in order | `TextItem`s inside `VOICEOVER` blocks |

```javascript
TextItem  = { kind: "text",  sourceLine: 11, text: "Picture a small winery..." }
CueItem   = { kind: "cue",   type: "PAUSE", sourceLine: 17 }
BlockItem = { kind: "block", type: "ACTION" | "VISUAL" | "VOICEOVER" | "HIGHLIGHT",
              sourceLine: 24, content: [TextItem | CueItem] }
```

The IR marks what's spoken by structure alone: ONSET text and `VOICEOVER` blocks. The parser never guesses from the wording. It doesn't count words or estimate durations.

### Content preservation

- Each `TextItem.text` is the source line **exactly as written**. Punctuation, capitalization, URLs, JSON, and leading or trailing spaces are unchanged. Markdown isn't rendered.
- Blank lines inside a block, inside ONSET narration, or inside the front matter are kept as `TextItem`s with `text: ""`. They mark paragraph breaks. Blank lines at the start and end of each of these are dropped, because they only separate the content from its tags.
- Line endings are normalized: CRLF and lone CR become LF, and a leading byte-order mark is removed. Line numbers still count source lines from 1.
- Every stage, video, section, block, cue, and text item has a `sourceLine`, so a generator or reviewer can point back to the source.

## Grammar

The grammar is defined in [`course/README.md`](../course/README.md#script-grammar). In summary:

- Structure is recognized only from **whole lines**, compared after trimming surrounding whitespace.
- **Headings:** `Stage N: Title` and `Video N: Title`. Video numbers restart in each stage.
- **Tags:** a line is a tag only if it matches `^\[/?[A-Z]+\]$`. So `Say [ONSET] aloud`, `[voiceover]`, `[ PAUSE ]`, and JSON arrays are ordinary text.
- **Sections:** `[ONSET]`, `[MOTION]`, and `[SCREENCAST]` must be inside a video, closed by the matching tag, and not nested.
- **Block annotations:** `[ACTION]` (SCREENCAST), `[VISUAL]` (MOTION), `[VOICEOVER]` (MOTION and SCREENCAST), and `[HIGHLIGHT]` (MOTION and SCREENCAST). Each one starts a block that runs until the next block annotation or the section's closing tag.
- **Cue:** `[PAUSE]` (any section) is a standalone cue. Inside a block it's recorded within that block and **doesn't end it**.
- **Front matter:** text before the first stage heading is kept in `frontMatter`.

The parser is a line-by-line state machine with explicit states (outside a section, inside a section, inside a block). It doesn't use one large regular expression for the whole document.

The parser doesn't enforce the course's shape of two stages with three videos each. That's a property of this particular course, and the acceptance test checks it by comparing against [`course/fixtures/expected-structure.json`](../course/fixtures/expected-structure.json).

## Diagnostics

```javascript
{ code: "UNCLOSED_SECTION", severity: "error", line: 35,
  message: "The ONSET section opened on line 35 was not closed before the heading on line 42. Add [/ONSET] where the section ends." }
```

Tests and tools should rely on `code`, `severity`, and `line`. The `message` is written for people and may change.

### Structural errors

These are found while reading lines.

| Code | Reported at | Meaning |
|---|---|---|
| `UNCLOSED_SECTION` | The opening tag | Section not closed before the next heading or the end of the document |
| `UNEXPECTED_CLOSING_TAG` | The closing tag | `[/X]` with no open section, one that doesn't match the open section, or a closing tag for an annotation |
| `NESTED_SECTION` | The inner opening tag | A section opened while another is still open |
| `UNKNOWN_ANNOTATION` | The tag | A tag-shaped line that isn't a known section or annotation, such as `[NARRATION]` |
| `ANNOTATION_NOT_ALLOWED` | The tag | A known annotation used in the wrong section type, such as `[ACTION]` in MOTION |
| `ANNOTATION_OUTSIDE_SECTION` | The tag | A known annotation outside any section |
| `CONTENT_BEFORE_ANNOTATION` | First such line | MOTION or SCREENCAST text before the first block annotation |
| `SECTION_OUTSIDE_VIDEO` | The opening tag | A section before any video heading |
| `VIDEO_OUTSIDE_STAGE` | The heading | A video heading before any stage heading |
| `INVALID_HEADING` | The line | A line that looks like a heading but doesn't match, such as `Stage two: X`, `Video 2 - X`, or `Video 3:` |
| `CONTENT_OUTSIDE_SECTION` | First line of a run | Text between sections, after the first stage |

### Document checks

These run only when there are no structural errors.

| Code | Severity | Meaning |
|---|---|---|
| `NO_STAGES` | error | No stage headings. `line` is `null`. |
| `STAGE_NUMBER_SEQUENCE` | error | Stages aren't numbered 1, 2, 3, ... in order |
| `VIDEO_NUMBER_SEQUENCE` | error | Videos aren't numbered 1, 2, 3, ... within their stage |
| `EMPTY_VIDEO` | warning | A video with no sections |
| `EMPTY_SECTION` | warning | A section with no content |
| `EMPTY_BLOCK` | warning | A block annotation with no text |

### Ordering

Diagnostics are sorted by `line`, with `null` last. Ties keep the order in which the problems were found. For example, an unclosed section found at the end of the document is still listed at its opening line, before any errors inside it.

## Error recovery

The parser recovers conservatively. It reports every problem and never silently repairs or invents structure.

- **Unclosed section:** if a heading or the end of the document arrives while a section is open, the parser reports `UNCLOSED_SECTION`. The section stays in the document with `endLine: null`, and the heading is then processed normally. Sections are never closed without a diagnostic.
- **Nested opening tag:** the nested tag is reported and ignored. Following lines are read as part of the outer section, which can cause follow-on errors such as `ANNOTATION_NOT_ALLOWED` or a mismatched closing tag.
- **Mismatched or stray closing tag:** reported and ignored. It doesn't close the open section.
- **Unknown or disallowed annotation:** in MOTION and SCREENCAST, the current block ends, and following text is dropped until the next valid block annotation, so it isn't added to the wrong block. In ONSET, the text continues as narration.
- **Section outside a video:** the section is read so its closing tag still matches, but it isn't added to the document.
- **Video outside a stage:** the heading is reported and not added.
- **No invented structure:** missing stages, videos, and sections are never created.

The first diagnostic identifies the original defect. Follow-on diagnostics can come after it. Each case in [`course/fixtures/malformed-script.md`](../course/fixtures/malformed-script.md) is tested this way.

## Portability

The core, `src/production-script.cjs`, is written to run in Node.js now and in Google Apps Script later:

- It's a classic script that defines a single global, `ProductionScript`, and has no `import`, `export`, or `require`.
- It doesn't use `fs`, `path`, `process`, `Buffer`, `globalThis`, or any browser API.
- It uses a conservative set of language features: `const`/`let`, arrow functions, template literals, `Array.prototype.includes`, and `Object.freeze`. It doesn't use `?.`, `??`, or newer built-ins.
- A guard at the end, `if (typeof module === "object" && module.exports)`, exports it for Node.js. `src/index.js` then re-exports it as ESM.
- File reading, fixture splitting, and the test runner stay in `tests/` and `src/print-ir.js`.

`tests/portability.test.js` checks the source for module syntax and host globals. It also runs the core in an empty `node:vm` context, with no `module`, `require`, or `process`, and checks that the master script parses identically there. **That's an approximation. The parser has not yet been run in Google Apps Script.**

### Google Apps Script integration (Phase 3B)

1. `scripts/sync-apps-script.mjs` copies this file byte for byte to `apps-script/ProductionScript.js`. Apps Script files share a global scope, so `ProductionScript.parseProductionScript` is available to the other script files, and the CommonJS guard does nothing there.
2. The adapter in [`apps-script/`](../apps-script) reads the master Google Doc's paragraphs (splitting soft line breaks), joins them with newlines, and passes the text to `parseProductionScript`. It reports diagnostics before any generation starts.
3. `node scripts/sync-apps-script.mjs --check`, run in CI, and `apps-script/tests/sync.test.js` fail if the copy differs from this file.
4. **Running the parser inside Apps Script itself hasn't been verified yet.** That's part of the live checkpoint in [`apps-script/README.md`](../apps-script/README.md#live-verification-checklist).

**After changing this file**, run `node scripts/sync-apps-script.mjs` and commit the regenerated `apps-script/` files with it.

## Known limitations

- Only plain text goes in. Google Docs formatting such as headings, bold, and lists is ignored by design. Phase 3B must turn a document into text one paragraph per line.
- Messages are in English and may change. Codes are stable.
- The parser doesn't enforce the course's shape (two stages of three videos). The acceptance test does.
- A narration line inside a section that exactly matches `Stage N: Title` or `Video N: Title` is treated as a heading, which ends the section with `UNCLOSED_SECTION`. The grammar doesn't allow headings inside sections, so this is reported rather than guessed around.
- There's no JavaScript linter or formatter, because the project avoids npm dependencies. Code style follows the existing files and `.editorconfig`.
