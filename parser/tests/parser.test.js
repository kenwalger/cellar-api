// Intermediate representation and grammar edge cases.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DiagnosticCode, parseProductionScript } from "../src/index.js";
import { lines } from "./helpers.js";

function onlyVideo(source) {
  const result = parseProductionScript(source);
  return { ...result, video: result.document.stages[0].videos[0] };
}

const text = (sourceLine, value) => ({ kind: "text", sourceLine, text: value });
const pause = (sourceLine) => ({ kind: "cue", type: "PAUSE", sourceLine });

describe("public API", () => {
  test("throws TypeError for non-string input", () => {
    for (const value of [undefined, null, 42, {}, ["Stage 1: A"]]) {
      assert.throws(() => parseProductionScript(value), TypeError);
    }
  });

  test("returns an empty document and NO_STAGES for empty input", () => {
    const { document, diagnostics } = parseProductionScript("");
    assert.deepEqual(document, { frontMatter: [], stages: [] });
    assert.deepEqual(
      diagnostics.map((d) => [d.code, d.severity, d.line]),
      [[DiagnosticCode.NO_STAGES, "error", null]],
    );
  });
});

describe("intermediate representation", () => {
  test("represents ONSET narration and cues in order", () => {
    const { diagnostics, video } = onlyVideo(
      lines(
        "Stage 1: Basics",
        "Video 1: Hello",
        "[ONSET]",
        "",
        "First paragraph.",
        "",
        "[PAUSE]",
        "",
        "Second paragraph.",
        "",
        "[/ONSET]",
      ),
    );
    assert.deepEqual(diagnostics, []);
    assert.deepEqual(video, {
      number: 1,
      title: "Hello",
      sourceLine: 2,
      sections: [
        {
          type: "ONSET",
          sourceLine: 3,
          endLine: 11,
          content: [
            text(5, "First paragraph."),
            text(6, ""),
            pause(7),
            text(8, ""),
            text(9, "Second paragraph."),
          ],
        },
      ],
    });
  });

  test("represents MOTION and SCREENCAST content as typed blocks", () => {
    const { diagnostics, video } = onlyVideo(
      lines(
        "Stage 1: Basics",
        "Video 1: Hello",
        "[MOTION]",
        "[VISUAL]",
        "Show a client.",
        "[VOICEOVER]",
        "The client asks.",
        "[/MOTION]",
        "[SCREENCAST]",
        "[ACTION]",
        "Open the docs.",
        "[HIGHLIGHT]",
        "The response code.",
        "[/SCREENCAST]",
      ),
    );
    assert.deepEqual(diagnostics, []);
    assert.deepEqual(
      video.sections.map((s) => [s.type, s.content.map((b) => [b.kind, b.type, b.sourceLine])]),
      [
        ["MOTION", [["block", "VISUAL", 4], ["block", "VOICEOVER", 6]]],
        ["SCREENCAST", [["block", "ACTION", 10], ["block", "HIGHLIGHT", 12]]],
      ],
    );
    assert.deepEqual(video.sections[0].content[1].content, [text(7, "The client asks.")]);
  });

  test("keeps a [PAUSE] inside the active block without ending it", () => {
    const { diagnostics, video } = onlyVideo(
      lines(
        "Stage 1: Basics",
        "Video 1: Hello",
        "[SCREENCAST]",
        "[VOICEOVER]",
        "Before the pause.",
        "[PAUSE]",
        "After the pause.",
        "[/SCREENCAST]",
      ),
    );
    assert.deepEqual(diagnostics, []);
    const blocks = video.sections[0].content;
    assert.equal(blocks.length, 1);
    assert.deepEqual(blocks[0].content, [
      text(5, "Before the pause."),
      pause(6),
      text(7, "After the pause."),
    ]);
  });

  test("allows repeated section types and preserves their order", () => {
    const { diagnostics, video } = onlyVideo(
      lines(
        "Stage 1: Basics",
        "Video 1: Hello",
        "[ONSET]",
        "One.",
        "[/ONSET]",
        "[SCREENCAST]",
        "[ACTION]",
        "Click.",
        "[/SCREENCAST]",
        "[ONSET]",
        "Two.",
        "[/ONSET]",
        "[ONSET]",
        "Three.",
        "[/ONSET]",
      ),
    );
    assert.deepEqual(diagnostics, []);
    assert.deepEqual(
      video.sections.map((s) => s.type),
      ["ONSET", "SCREENCAST", "ONSET", "ONSET"],
    );
  });

  test("preserves JSON, URLs, inner whitespace, and interior blank lines verbatim", () => {
    const json =
      '{"detail":[{"type":"enum","loc":["query","status"],"msg":"Input should be \'planned\'"}]}';
    const { diagnostics, video } = onlyVideo(
      lines(
        "Stage 1: Basics",
        "Video 1: Hello",
        "[SCREENCAST]",
        "[ACTION]",
        "",
        "Open http://127.0.0.1:8000/docs?x=1&y=[2].",
        "",
        "",
        json,
        "    indented   text  ",
        "",
        "[/SCREENCAST]",
      ),
    );
    assert.deepEqual(diagnostics, []);
    assert.deepEqual(video.sections[0].content[0].content, [
      text(6, "Open http://127.0.0.1:8000/docs?x=1&y=[2]."),
      text(7, ""),
      text(8, ""),
      text(9, json),
      text(10, "    indented   text  "),
    ]);
  });

  test("treats inline or lower-case tag-like text as content", () => {
    const { diagnostics, video } = onlyVideo(
      lines(
        "Stage 1: Basics",
        "Video 1: Hello",
        "[ONSET]",
        "Say [ONSET] and [VOICEOVER] out loud.",
        "[voiceover]",
        "[ PAUSE ]",
        "[]",
        "[ONSET] trailing text",
        "[/ONSET]",
      ),
    );
    assert.deepEqual(diagnostics, []);
    assert.deepEqual(
      video.sections[0].content.map((item) => item.text),
      [
        "Say [ONSET] and [VOICEOVER] out loud.",
        "[voiceover]",
        "[ PAUSE ]",
        "[]",
        "[ONSET] trailing text",
      ],
    );
  });

  test("recognizes structural lines with surrounding whitespace", () => {
    const { diagnostics, document } = parseProductionScript(
      lines("  Stage 1: Basics  ", "\tVideo 1: Hello", "  [ONSET]  ", "Hi.", " [/ONSET]"),
    );
    assert.deepEqual(diagnostics, []);
    assert.equal(document.stages[0].title, "Basics");
    assert.equal(document.stages[0].videos[0].sections[0].endLine, 5);
  });

  test("normalizes CRLF line endings without shifting line numbers", () => {
    const lf = lines("Stage 1: Basics", "Video 1: Hello", "[ONSET]", "Hi.", "[/ONSET]");
    const crlf = lf.replaceAll("\n", "\r\n");
    assert.deepEqual(parseProductionScript(crlf), parseProductionScript(lf));
    assert.equal(
      parseProductionScript(crlf).document.stages[0].videos[0].sections[0].content[0].text,
      "Hi.",
    );
  });

  test("restarts video numbering in each stage", () => {
    const { diagnostics, document } = parseProductionScript(
      lines(
        "Stage 1: A",
        "Video 1: One",
        "[ONSET]",
        "x",
        "[/ONSET]",
        "Stage 2: B",
        "Video 1: One again",
        "[ONSET]",
        "y",
        "[/ONSET]",
      ),
    );
    assert.deepEqual(diagnostics, []);
    assert.deepEqual(
      document.stages.map((s) => s.videos.map((v) => v.number)),
      [[1], [1]],
    );
  });
});
