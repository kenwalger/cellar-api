// Validation: parsing extracted text, structural acceptance, and the generate/block decision.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  bodyFromText,
  element,
  fakeBody,
  lines,
  loadAppsScript,
  paragraph,
  plain,
  readRepoFile,
} from "./helpers.js";

const { DocumentReader, Validation, GeneratedData } = loadAppsScript();
const master = readRepoFile("course/master-script.md");
const expectedStructure = JSON.parse(readRepoFile("course/fixtures/expected-structure.json"));

function runFor(text, options = {}) {
  const extraction = DocumentReader.readBody(bodyFromText(text));
  return plain(
    Validation.prepareRun(extraction, {
      requireExpectedStructure: options.requireExpectedStructure ?? false,
      expectedStructure: options.expectedStructure ?? expectedStructure,
    }),
  );
}

const minimal = lines("Stage 1: A", "Video 1: B", "[ONSET]", "Hi.", "[/ONSET]");

describe("structural acceptance", () => {
  test("the extracted master script matches the independent fixture", () => {
    const run = runFor(master, { requireExpectedStructure: true });
    assert.deepEqual(run.issues, []);
    assert.deepEqual(run.structure, { checked: true, matches: true, differences: [] });
    assert.equal(run.canGenerate, true);
  });

  test("GeneratedData.expectedStructure equals the fixture file", () => {
    assert.deepEqual(plain(GeneratedData.expectedStructure), expectedStructure);
  });

  test("projectStructure keeps numbers, titles, and section order", () => {
    const run = runFor(master);
    const projected = plain(Validation.projectStructure(run.parse.document));
    assert.deepEqual(projected, expectedStructure);
  });

  test("compareStructure names each difference by path", () => {
    const actual = structuredClone(expectedStructure);
    actual.stages[1].videos[1].sections.pop();
    actual.stages[0].videos[2].title = "JSON Basics";
    actual.stages[1].videos.pop();
    const differences = plain(Validation.compareStructure(expectedStructure, actual));
    assert.deepEqual(differences, [
      'stages[0].videos[2].title: expected "Understanding JSON", found "JSON Basics"',
      "stages[1].videos: expected 3 items, found 2",
      "stages[1].videos[1].sections: expected [ONSET, MOTION, SCREENCAST, ONSET], found [ONSET, MOTION, SCREENCAST]",
    ]);
  });

  test("a structure mismatch blocks generation when the check is required", () => {
    const run = runFor(minimal, { requireExpectedStructure: true });
    assert.equal(run.canGenerate, false);
    assert.equal(run.structure.matches, false);
    assert.ok(run.issues.every((i) => i.code === "STRUCTURE_MISMATCH" && i.severity === "error"));
  });

  test("the structure check is skipped when not required", () => {
    const run = runFor(minimal, { requireExpectedStructure: false });
    assert.deepEqual(run.structure, { checked: false, matches: null, differences: [] });
    assert.equal(run.canGenerate, true);
  });
});

describe("generate or block", () => {
  test("parser errors block generation and carry line and element", () => {
    const run = runFor(lines("Stage 1: A", "Video 1: B", "[ONSET]", "Hi."));
    assert.equal(run.canGenerate, false);
    assert.equal(run.errorCount, 1);
    assert.deepEqual(
      run.issues.map((i) => [i.source, i.code, i.severity, i.line, i.element]),
      [["parser", "UNCLOSED_SECTION", "error", 3, 3]],
    );
  });

  test("warnings alone allow generation", () => {
    const run = runFor(
      lines("Stage 1: A", "Video 1: B", "[SCREENCAST]", "[ACTION]", "[VOICEOVER]", "Hi.", "[/SCREENCAST]"),
    );
    assert.equal(run.canGenerate, true);
    assert.equal(run.errorCount, 0);
    assert.deepEqual(
      run.issues.map((i) => [i.code, i.severity]),
      [["EMPTY_BLOCK", "warning"]],
    );
  });

  test("extraction errors block generation", () => {
    const extraction = DocumentReader.readBody(
      fakeBody([paragraph("Stage 1: A"), element("TABLE"), paragraph("Video 1: B"), paragraph("[ONSET]"), paragraph("x"), paragraph("[/ONSET]")]),
    );
    const run = plain(
      Validation.prepareRun(extraction, { requireExpectedStructure: false, expectedStructure }),
    );
    assert.equal(run.canGenerate, false);
    assert.deepEqual(
      run.issues.map((i) => [i.source, i.code, i.element]),
      [["extraction", "UNSUPPORTED_ELEMENT", 2]],
    );
  });

  test("parser line numbers map back to the right document element", () => {
    const extraction = DocumentReader.readBody(
      fakeBody([
        paragraph("Stage 1: A\rVideo 1: B"),
        paragraph("[ONSET]"),
        paragraph("Hi.\r[BOGUS]"),
        paragraph("[/ONSET]"),
      ]),
    );
    const run = plain(Validation.prepareRun(extraction, { requireExpectedStructure: false }));
    assert.deepEqual(
      run.issues.map((i) => [i.code, i.line, i.element, i.partInElement]),
      [["UNKNOWN_ANNOTATION", 5, 3, 2]],
    );
  });

  test("counts stages, videos, and sections by type", () => {
    assert.deepEqual(runFor(master).counts, {
      stages: 2,
      videos: 6,
      sections: { ONSET: 6, MOTION: 3, SCREENCAST: 4, total: 13 },
    });
  });
});

describe("report", () => {
  test("lists counts, the structure result, and each issue with its location", () => {
    const run = Validation.prepareRun(
      DocumentReader.readBody(bodyFromText(lines("Stage 1: A", "Video 1: B", "[ONSET]", "Hi."))),
      { requireExpectedStructure: false },
    );
    const report = plain(
      Validation.formatReport({ title: "Master", url: "https://docs.test/m" }, run),
    ).join("\n");
    assert.match(report, /Master/);
    assert.match(report, /Stages: 1, videos: 1, sections: 1 \(ONSET 1, MOTION 0, SCREENCAST 0\)/);
    assert.match(report, /ERROR UNCLOSED_SECTION at line 3 \(document paragraph 3\): "\[ONSET\]"/);
    assert.match(report, /BLOCKED/);
  });

  test("a clean master reports that generation can proceed", () => {
    const run = Validation.prepareRun(DocumentReader.readBody(bodyFromText(master)), {
      requireExpectedStructure: true,
      expectedStructure,
    });
    const report = plain(Validation.formatReport({ title: "Master", url: "u" }, run)).join("\n");
    assert.match(report, /matches the expected structure/);
    assert.match(report, /READY/);
  });
});
