// Google Docs text extraction (DocumentReader), using Body test doubles.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  bodyFromText,
  element,
  fakeBody,
  listItem,
  loadAppsScript,
  paragraph,
  plain,
  readRepoFile,
} from "./helpers.js";

const { DocumentReader } = loadAppsScript();
const read = (specs, options) => plain(DocumentReader.readBody(fakeBody(specs), options));

describe("paragraph extraction", () => {
  test("keeps paragraph order and maps each line to its element", () => {
    const result = read([paragraph("Stage 1: A"), paragraph("Video 1: B"), paragraph("[ONSET]")]);
    assert.equal(result.text, "Stage 1: A\nVideo 1: B\n[ONSET]");
    assert.deepEqual(result.lines, [
      { element: 1, partInElement: 1 },
      { element: 2, partInElement: 1 },
      { element: 3, partInElement: 1 },
    ]);
    assert.equal(result.elementCount, 3);
    assert.deepEqual(result.diagnostics, []);
  });

  test("keeps empty paragraphs as blank lines", () => {
    const result = read([paragraph("One."), paragraph(""), paragraph(""), paragraph("Two.")]);
    assert.equal(result.text, "One.\n\n\nTwo.");
    assert.equal(result.lines.length, 4);
  });

  test("splits soft line breaks inside a paragraph into separate lines", () => {
    for (const lineBreak of ["\r", "\n", "\r\n", "\u000b"]) {
      const result = read([paragraph(`[VOICEOVER]${lineBreak}Spoken text.`), paragraph("[/MOTION]")]);
      assert.equal(result.text, "[VOICEOVER]\nSpoken text.\n[/MOTION]");
      assert.deepEqual(result.lines, [
        { element: 1, partInElement: 1 },
        { element: 1, partInElement: 2 },
        { element: 2, partInElement: 1 },
      ]);
    }
  });

  test("preserves text exactly, including URLs, JSON, and spacing", () => {
    const json = '{"detail":[{"loc":["query","status"],"input":"spilled"}]}';
    const result = read([paragraph("  Open http://127.0.0.1:8000/docs.  "), paragraph(json)]);
    assert.equal(result.text, `  Open http://127.0.0.1:8000/docs.  \n${json}`);
  });

  test("reconstructs the master script exactly from a one-paragraph-per-line document", () => {
    const master = readRepoFile("course/master-script.md");
    const result = plain(DocumentReader.readBody(bodyFromText(master)));
    assert.equal(result.text, master);
    assert.deepEqual(result.diagnostics, []);
  });
});

describe("unsupported content is reported, not dropped silently", () => {
  test("a table is an error at its element position", () => {
    const result = read([paragraph("Before"), element("TABLE"), paragraph("After")]);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.code, d.severity, d.element]),
      [["UNSUPPORTED_ELEMENT", "error", 2]],
    );
    assert.equal(result.text, "Before\nAfter");
    assert.deepEqual(result.lines, [
      { element: 1, partInElement: 1 },
      { element: 3, partInElement: 1 },
    ]);
  });

  test("an inline image or drawing inside a paragraph is an error", () => {
    const result = read([
      paragraph("Look here", ["TEXT", "INLINE_IMAGE"]),
      paragraph("And here", ["INLINE_DRAWING"]),
    ]);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.code, d.severity, d.element]),
      [
        ["UNSUPPORTED_INLINE_ELEMENT", "error", 1],
        ["UNSUPPORTED_INLINE_ELEMENT", "error", 2],
      ],
    );
  });

  test("page breaks and horizontal rules are warnings, since no text is lost", () => {
    const result = read([paragraph("", ["PAGE_BREAK"]), paragraph("Text", ["TEXT", "HORIZONTAL_RULE"])]);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.code, d.severity, d.element]),
      [
        ["IGNORED_INLINE_ELEMENT", "warning", 1],
        ["IGNORED_INLINE_ELEMENT", "warning", 2],
      ],
    );
  });

  test("list items keep their text and produce one warning", () => {
    const result = read([paragraph("Intro"), listItem("First"), listItem("Second")]);
    assert.equal(result.text, "Intro\nFirst\nSecond");
    assert.deepEqual(
      result.diagnostics.map((d) => [d.code, d.severity, d.element]),
      [["LIST_FORMATTING_IGNORED", "warning", 2]],
    );
    assert.match(result.diagnostics[0].message, /2 list items/);
  });

  test("a document with more than one tab is an error", () => {
    const result = read([paragraph("Stage 1: A")], { tabCount: 2 });
    assert.deepEqual(
      result.diagnostics.map((d) => [d.code, d.severity, d.element]),
      [["MULTIPLE_TABS", "error", null]],
    );
  });
});
