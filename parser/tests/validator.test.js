// Structural diagnostics: codes, lines, ordering, and recovery.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DiagnosticCode, parseProductionScript } from "../src/index.js";
import { lines } from "./helpers.js";

const header = ["Stage 1: Basics", "Video 1: Hello"];

function summarize(source) {
  return parseProductionScript(source).diagnostics.map((d) => [d.code, d.severity, d.line]);
}

describe("diagnostic shape", () => {
  test("every diagnostic has code, severity, line, and a message", () => {
    const { diagnostics } = parseProductionScript(lines(...header, "[ONSET]", "Hi."));
    assert.equal(diagnostics.length, 1);
    const [diagnostic] = diagnostics;
    assert.deepEqual(Object.keys(diagnostic).sort(), ["code", "line", "message", "severity"]);
    assert.match(diagnostic.message, /ONSET/);
    assert.match(diagnostic.message, /line 3/);
  });

  test("DiagnosticCode values equal their keys and cannot be changed", () => {
    for (const [key, value] of Object.entries(DiagnosticCode)) {
      assert.equal(key, value);
    }
    assert.ok(Object.isFrozen(DiagnosticCode));
  });
});

describe("section errors", () => {
  test("missing closing tag at end of input is reported at the opening tag", () => {
    assert.deepEqual(summarize(lines(...header, "[ONSET]", "Hi.")), [
      [DiagnosticCode.UNCLOSED_SECTION, "error", 3],
    ]);
  });

  test("a heading inside an open section reports the unclosed section and continues", () => {
    const source = lines(
      ...header,
      "[ONSET]",
      "Hi.",
      "Video 2: Next",
      "[ONSET]",
      "Fine.",
      "[/ONSET]",
    );
    const { document, diagnostics } = parseProductionScript(source);
    assert.deepEqual(
      diagnostics.map((d) => [d.code, d.line]),
      [[DiagnosticCode.UNCLOSED_SECTION, 3]],
    );
    const [first, second] = document.stages[0].videos;
    assert.equal(first.sections[0].endLine, null);
    assert.equal(second.sections[0].endLine, 8);
  });

  test("closing tag with no open section", () => {
    assert.deepEqual(summarize(lines(...header, "[/MOTION]")), [
      [DiagnosticCode.UNEXPECTED_CLOSING_TAG, "error", 3],
    ]);
  });

  test("closing tag that does not match the open section", () => {
    assert.deepEqual(summarize(lines(...header, "[ONSET]", "Hi.", "[/MOTION]", "[/ONSET]")), [
      [DiagnosticCode.UNEXPECTED_CLOSING_TAG, "error", 5],
    ]);
  });

  test("closing tag for an annotation", () => {
    assert.deepEqual(
      summarize(lines(...header, "[MOTION]", "[VISUAL]", "x", "[/VISUAL]", "[/MOTION]")),
      [[DiagnosticCode.UNEXPECTED_CLOSING_TAG, "error", 6]],
    );
  });

  test("nested section is reported and not added to the document", () => {
    const { document, diagnostics } = parseProductionScript(
      lines(...header, "[ONSET]", "Hi.", "[SCREENCAST]", "More.", "[/ONSET]"),
    );
    assert.deepEqual(
      diagnostics.map((d) => [d.code, d.line]),
      [[DiagnosticCode.NESTED_SECTION, 5]],
    );
    assert.deepEqual(
      document.stages[0].videos[0].sections.map((s) => s.type),
      ["ONSET"],
    );
  });

  test("section before any video", () => {
    const { document, diagnostics } = parseProductionScript(
      lines("Stage 1: Basics", "[ONSET]", "Hi.", "[/ONSET]", "Video 1: Hello"),
    );
    assert.deepEqual(
      diagnostics.map((d) => [d.code, d.line]),
      [[DiagnosticCode.SECTION_OUTSIDE_VIDEO, 2]],
    );
    assert.deepEqual(document.stages[0].videos[0].sections, []);
  });

  test("section in front matter, before any stage", () => {
    assert.deepEqual(
      summarize(lines("Intro", "[ONSET]", "Hi.", "[/ONSET]", ...header, "[ONSET]", "x", "[/ONSET]")),
      [[DiagnosticCode.SECTION_OUTSIDE_VIDEO, "error", 2]],
    );
  });
});

describe("heading errors", () => {
  test("video heading before any stage", () => {
    assert.deepEqual(
      summarize(lines("Video 1: Orphan", "Stage 1: Basics", "Video 1: Hello", "[ONSET]", "x", "[/ONSET]")),
      [[DiagnosticCode.VIDEO_OUTSIDE_STAGE, "error", 1]],
    );
  });

  test("malformed stage and video headings", () => {
    assert.deepEqual(
      summarize(
        lines(
          "Stage 1: Basics",
          "Video 1: Hello",
          "[ONSET]",
          "x",
          "[/ONSET]",
          "Stage two: Words",
          "Video 2 - Dash",
          "Video 3:",
        ),
      ),
      [
        [DiagnosticCode.INVALID_HEADING, "error", 6],
        [DiagnosticCode.INVALID_HEADING, "error", 7],
        [DiagnosticCode.INVALID_HEADING, "error", 8],
      ],
    );
  });

  test("stray text between sections is reported once per run", () => {
    assert.deepEqual(
      summarize(lines(...header, "Stray one.", "Stray two.", "[ONSET]", "x", "[/ONSET]", "Stray three.")),
      [
        [DiagnosticCode.CONTENT_OUTSIDE_SECTION, "error", 3],
        [DiagnosticCode.CONTENT_OUTSIDE_SECTION, "error", 8],
      ],
    );
  });

  test("words like Videos or Staged are not headings", () => {
    const { document, diagnostics } = parseProductionScript(
      lines("Videos and stages are introduced below.", "Staged content.", ...header, "[ONSET]", "x", "[/ONSET]"),
    );
    assert.deepEqual(diagnostics, []);
    assert.equal(document.frontMatter.length, 2);
  });
});

describe("annotation errors", () => {
  test("unknown annotation inside a section", () => {
    assert.deepEqual(
      summarize(lines(...header, "[SCREENCAST]", "[ACTION]", "Click.", "[NARRATION]", "Hello.", "[/SCREENCAST]")),
      [[DiagnosticCode.UNKNOWN_ANNOTATION, "error", 6]],
    );
  });

  test("content after an invalid annotation is not attached to the previous block", () => {
    const { document } = parseProductionScript(
      lines(...header, "[SCREENCAST]", "[ACTION]", "Click.", "[NARRATION]", "Hello.", "[VOICEOVER]", "Spoken.", "[/SCREENCAST]"),
    );
    const blocks = document.stages[0].videos[0].sections[0].content;
    assert.deepEqual(
      blocks.map((b) => [b.type, b.content.map((i) => i.text)]),
      [
        ["ACTION", ["Click."]],
        ["VOICEOVER", ["Spoken."]],
      ],
    );
  });

  test("unknown annotation outside a section", () => {
    assert.deepEqual(summarize(lines(...header, "[NOTES]", "[ONSET]", "x", "[/ONSET]")), [
      [DiagnosticCode.UNKNOWN_ANNOTATION, "error", 3],
    ]);
  });

  test("known annotation outside a section", () => {
    assert.deepEqual(summarize(lines(...header, "[PAUSE]", "[ONSET]", "x", "[/ONSET]")), [
      [DiagnosticCode.ANNOTATION_OUTSIDE_SECTION, "error", 3],
    ]);
  });

  test("annotation not allowed in the section type", () => {
    assert.deepEqual(
      summarize(
        lines(
          ...header,
          "[ONSET]",
          "[VOICEOVER]",
          "Hi.",
          "[/ONSET]",
          "[MOTION]",
          "[ACTION]",
          "x",
          "[/MOTION]",
          "[SCREENCAST]",
          "[VISUAL]",
          "y",
          "[/SCREENCAST]",
        ),
      ),
      [
        [DiagnosticCode.ANNOTATION_NOT_ALLOWED, "error", 4],
        [DiagnosticCode.ANNOTATION_NOT_ALLOWED, "error", 8],
        [DiagnosticCode.ANNOTATION_NOT_ALLOWED, "error", 12],
      ],
    );
  });

  test("MOTION or SCREENCAST content before the first block annotation", () => {
    assert.deepEqual(
      summarize(lines(...header, "[MOTION]", "", "Loose text.", "More loose text.", "[PAUSE]", "[VISUAL]", "x", "[/MOTION]")),
      [[DiagnosticCode.CONTENT_BEFORE_ANNOTATION, "error", 5]],
    );
  });
});

describe("document checks", () => {
  test("stage and video numbers must run 1, 2, 3 in order", () => {
    assert.deepEqual(
      summarize(
        lines(
          "Stage 1: A",
          "Video 1: One",
          "[ONSET]",
          "x",
          "[/ONSET]",
          "Video 3: Skipped two",
          "[ONSET]",
          "y",
          "[/ONSET]",
          "Stage 3: Skipped two",
          "Video 1: One",
          "[ONSET]",
          "z",
          "[/ONSET]",
        ),
      ),
      [
        [DiagnosticCode.VIDEO_NUMBER_SEQUENCE, "error", 6],
        [DiagnosticCode.STAGE_NUMBER_SEQUENCE, "error", 10],
      ],
    );
  });

  test("empty videos, sections, and blocks are warnings", () => {
    assert.deepEqual(
      summarize(
        lines(
          "Stage 1: A",
          "Video 1: Empty",
          "Video 2: Has empties",
          "[ONSET]",
          "",
          "[/ONSET]",
          "[SCREENCAST]",
          "[ACTION]",
          "[VOICEOVER]",
          "Spoken.",
          "[/SCREENCAST]",
        ),
      ),
      [
        [DiagnosticCode.EMPTY_VIDEO, "warning", 2],
        [DiagnosticCode.EMPTY_SECTION, "warning", 4],
        [DiagnosticCode.EMPTY_BLOCK, "warning", 8],
      ],
    );
  });

  test("front matter only is NO_STAGES", () => {
    assert.deepEqual(summarize("Just a title"), [[DiagnosticCode.NO_STAGES, "error", null]]);
  });

  test("diagnostics are sorted by line regardless of detection order", () => {
    // The unclosed section is detected at end of input, but its line comes first.
    assert.deepEqual(
      summarize(lines(...header, "[SCREENCAST]", "[ACTION]", "x", "[BOGUS]")),
      [
        [DiagnosticCode.UNCLOSED_SECTION, "error", 3],
        [DiagnosticCode.UNKNOWN_ANNOTATION, "error", 6],
      ],
    );
  });
});
