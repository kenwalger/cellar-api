// Acceptance tests against the Phase 2 course fixtures.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DiagnosticCode, parseProductionScript } from "../src/index.js";
import { lineOf, readRepoFile, splitMalformedCases } from "./helpers.js";

const masterText = readRepoFile("course/master-script.md");
const expectedStructure = JSON.parse(
  readRepoFile("course/fixtures/expected-structure.json"),
);

function structureOf(document) {
  return {
    stages: document.stages.map((stage) => ({
      number: stage.number,
      title: stage.title,
      videos: stage.videos.map((video) => ({
        number: video.number,
        title: video.title,
        sections: video.sections.map((section) => section.type),
      })),
    })),
  };
}

function allSections(document) {
  return document.stages.flatMap((stage) =>
    stage.videos.flatMap((video) => video.sections),
  );
}

describe("master script", () => {
  const { document, diagnostics } = parseProductionScript(masterText);

  test("parses with no diagnostics", () => {
    assert.deepEqual(diagnostics, []);
  });

  test("has two stages with three videos each, numbered from 1", () => {
    assert.deepEqual(
      document.stages.map((stage) => stage.number),
      [1, 2],
    );
    for (const stage of document.stages) {
      assert.deepEqual(
        stage.videos.map((video) => video.number),
        [1, 2, 3],
      );
    }
  });

  test("matches the independent expected-structure fixture exactly", () => {
    assert.deepEqual(structureOf(document), expectedStructure);
  });

  test("preserves the repeated ONSET section in Stage 2, Video 2", () => {
    const video = document.stages[1].videos[1];
    assert.equal(video.title, "Handling Errors");
    assert.deepEqual(
      video.sections.map((section) => section.type),
      ["ONSET", "MOTION", "SCREENCAST", "ONSET"],
    );
  });

  test("recognizes every annotation in the script", () => {
    // Counts verified independently during Phase 2.
    const counts = {};
    const bump = (type) => {
      counts[type] = (counts[type] ?? 0) + 1;
    };
    for (const section of allSections(document)) {
      for (const item of section.content) {
        if (item.kind === "block") {
          bump(item.type);
          item.content.filter((i) => i.kind === "cue").forEach((i) => bump(i.type));
        } else if (item.kind === "cue") {
          bump(item.type);
        }
      }
    }
    assert.deepEqual(counts, {
      ACTION: 12,
      VISUAL: 11,
      VOICEOVER: 31,
      HIGHLIGHT: 13,
      PAUSE: 6,
    });
  });

  test("keeps the front matter before the first stage", () => {
    assert.equal(
      document.frontMatter[0].text,
      "Understanding APIs: A Winery's Digital Cellar",
    );
    assert.equal(document.frontMatter[0].sourceLine, 1);
  });

  test("points every source line at the text it came from", () => {
    const sourceLines = masterText.split("\n");
    const at = (lineNumber) => sourceLines[lineNumber - 1];

    for (const stage of document.stages) {
      assert.equal(at(stage.sourceLine).trim(), `Stage ${stage.number}: ${stage.title}`);
      for (const video of stage.videos) {
        assert.equal(at(video.sourceLine).trim(), `Video ${video.number}: ${video.title}`);
        for (const section of video.sections) {
          assert.equal(at(section.sourceLine).trim(), `[${section.type}]`);
          assert.equal(at(section.endLine).trim(), `[/${section.type}]`);
          for (const item of section.content) {
            const nested = item.kind === "block" ? item.content : [];
            if (item.kind === "block" || item.kind === "cue") {
              assert.equal(at(item.sourceLine).trim(), `[${item.type}]`);
            } else {
              assert.equal(at(item.sourceLine), item.text);
            }
            for (const inner of nested) {
              if (inner.kind === "cue") {
                assert.equal(at(inner.sourceLine).trim(), `[${inner.type}]`);
              } else {
                assert.equal(at(inner.sourceLine), inner.text);
              }
            }
          }
        }
      }
    }
    assert.equal(document.stages[0].sourceLine, lineOf(masterText, "Stage 1: Understanding the Interface"));
  });

  test("produces identical results for identical input", () => {
    const again = parseProductionScript(masterText);
    assert.deepEqual(again, { document, diagnostics });
    assert.equal(JSON.stringify(again), JSON.stringify({ document, diagnostics }));
  });
});

describe("malformed fixture cases", () => {
  const cases = splitMalformedCases(readRepoFile("course/fixtures/malformed-script.md"));

  // Expected first diagnostic for each case, per course/fixtures/README.md.
  const expectations = {
    "missing-closing-tag": { code: DiagnosticCode.UNCLOSED_SECTION, marker: "[ONSET]" },
    "unexpected-closing-tag": {
      code: DiagnosticCode.UNEXPECTED_CLOSING_TAG,
      marker: "[/SCREENCAST]",
    },
    "nested-section": { code: DiagnosticCode.NESTED_SECTION, marker: "[MOTION]" },
    "unknown-annotation": { code: DiagnosticCode.UNKNOWN_ANNOTATION, marker: "[NARRATION]" },
  };

  test("contains exactly the four documented cases", () => {
    assert.deepEqual(
      cases.map((c) => c.id),
      Object.keys(expectations),
    );
  });

  for (const fixtureCase of cases) {
    test(`case ${fixtureCase.number} (${fixtureCase.id}) reports its documented failure first`, () => {
      const expected = expectations[fixtureCase.id];
      const { diagnostics } = parseProductionScript(fixtureCase.text);
      assert.ok(diagnostics.length > 0, "expected at least one diagnostic");
      const [first] = diagnostics;
      assert.equal(first.code, expected.code);
      assert.equal(first.severity, "error");
      assert.equal(first.line, lineOf(fixtureCase.text, expected.marker));
    });
  }
});
