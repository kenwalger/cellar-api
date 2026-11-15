// Role-specific document models (Render).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { lines, loadAppsScript, plain, readRepoFile } from "./helpers.js";

const { ProductionScript, Render } = loadAppsScript();
const master = readRepoFile("course/master-script.md");
const masterDocument = ProductionScript.parseProductionScript(master).document;
const meta = {
  courseTitle: "Understanding APIs: A Winery's Digital Cellar",
  sourceTitle: "Master Script",
  generatedAt: "2026-11-13T23:16:05.000Z",
  runId: "a1b2c3d4",
};

function render(role, document = masterDocument) {
  return plain(Render.buildRoleDocument(document, role, meta));
}

function headings(model, style) {
  return model.paragraphs.filter((p) => p.style === style).map((p) => p.text);
}

function allText(model) {
  return model.paragraphs.map((p) => p.text).join("\n");
}

describe("document frame", () => {
  test("starts with the course title, role, and provenance", () => {
    const model = render("ONSET");
    assert.equal(model.title, "ONSET — Understanding APIs: A Winery's Digital Cellar — a1b2c3d4");
    assert.deepEqual(
      model.paragraphs.slice(0, 2).map((p) => [p.style, p.text]),
      [
        ["TITLE", meta.courseTitle],
        ["SUBTITLE", "ONSET: presenter narration for the teleprompter"],
      ],
    );
    assert.equal(model.paragraphs[2].kind, "provenance");
    assert.match(model.paragraphs[2].text, /Master Script/);
    assert.match(model.paragraphs[2].text, /a1b2c3d4/);
  });

  test("courseTitle uses the first front-matter line, then falls back", () => {
    assert.equal(Render.courseTitle(masterDocument, "Fallback"), meta.courseTitle);
    const noFrontMatter = ProductionScript.parseProductionScript(
      lines("Stage 1: A", "Video 1: B", "[ONSET]", "x", "[/ONSET]"),
    ).document;
    assert.equal(Render.courseTitle(noFrontMatter, "Fallback"), "Fallback");
  });
});

describe("section selection", () => {
  test("ONSET includes only videos with ONSET sections, in source order", () => {
    const model = render("ONSET");
    assert.deepEqual(headings(model, "HEADING1"), [
      "Stage 1: Understanding the Interface",
      "Stage 2: Working with an API",
    ]);
    assert.deepEqual(headings(model, "HEADING2"), [
      "Video 1: What Is an API?",
      "Video 2: Requests and Responses",
      "Video 1: Making API Requests",
      "Video 2: Handling Errors",
      "Video 3: Wrapping Up",
    ]);
  });

  test("MOTION includes only videos with MOTION sections", () => {
    assert.deepEqual(headings(render("MOTION"), "HEADING2"), [
      "Video 1: What Is an API?",
      "Video 3: Understanding JSON",
      "Video 2: Handling Errors",
    ]);
  });

  test("SCREENCAST includes only videos with SCREENCAST sections", () => {
    assert.deepEqual(headings(render("SCREENCAST"), "HEADING2"), [
      "Video 2: Requests and Responses",
      "Video 3: Understanding JSON",
      "Video 1: Making API Requests",
      "Video 2: Handling Errors",
    ]);
  });

  test("repeated sections of a role keep their order and boundaries", () => {
    const model = render("ONSET");
    const start = model.paragraphs.findIndex((p) => p.text === "Video 2: Handling Errors");
    const after = model.paragraphs.slice(start);
    assert.deepEqual(
      after.filter((p) => p.style === "HEADING3").map((p) => p.text),
      ["Part 1 of 2", "Part 2 of 2"],
    );
    const part2 = after.findIndex((p) => p.text === "Part 2 of 2");
    assert.match(after[part2 + 1].text, /^So we have three outcomes\./);
    // A single section gets no part heading.
    assert.equal(headings(render("MOTION"), "HEADING3").length, 0);
  });

  test("unrelated production content is excluded", () => {
    const onset = allText(render("ONSET"));
    assert.doesNotMatch(onset, /Show a visitor at a tasting room counter/);
    assert.doesNotMatch(onset, /curl -i/);
    assert.ok(!render("ONSET").paragraphs.some((p) => p.kind === "label"));

    const motion = allText(render("MOTION"));
    assert.doesNotMatch(motion, /Picture a small winery/);
    assert.doesNotMatch(motion, /Open http:\/\/127\.0\.0\.1:8000\/docs/);

    const screencast = allText(render("SCREENCAST"));
    assert.doesNotMatch(screencast, /Picture a small winery/);
    assert.doesNotMatch(screencast, /Show a visitor at a tasting room counter/);
  });
});

describe("content rendering", () => {
  test("annotation blocks and cues keep their order", () => {
    const model = render("MOTION");
    const end = model.paragraphs.findIndex((p) => p.text === "Video 3: Understanding JSON");
    const labels = model.paragraphs
      .slice(0, end)
      .filter((p) => p.kind === "label")
      .map((p) => p.text);
    assert.deepEqual(labels, [
      "VISUAL",
      "VOICEOVER",
      "VISUAL",
      "VOICEOVER",
      "VISUAL",
      "VOICEOVER",
      "HIGHLIGHT",
      "VOICEOVER",
    ]);
  });

  test("narration and instructions are distinguished by kind", () => {
    const model = render("SCREENCAST");
    const byText = (prefix) => model.paragraphs.find((p) => p.text.startsWith(prefix));
    assert.equal(byText("With the API running locally").kind, "instruction"); // ACTION
    assert.equal(byText("This page is the interactive documentation").kind, "narration"); // VOICEOVER
    assert.equal(byText("The Request URL: http://127.0.0.1:8000/api/v1/batches/2026-014").kind, "instruction"); // HIGHLIGHT
  });

  test("a PAUSE inside a block is a cue between the surrounding narration", () => {
    const model = render("SCREENCAST");
    const index = model.paragraphs.findIndex((p) => p.text.startsWith("Null is a JSON value"));
    assert.deepEqual(
      model.paragraphs.slice(index, index + 5).map((p) => p.kind),
      ["narration", "blank", "cue", "blank", "narration"],
    );
    assert.equal(model.paragraphs[index + 2].text, "[PAUSE]");
  });

  test("ONSET narration and pauses render in order", () => {
    const model = render("ONSET");
    const index = model.paragraphs.findIndex((p) => p.text.startsWith("You might ask which wines"));
    assert.deepEqual(
      model.paragraphs.slice(index, index + 5).map((p) => [p.kind, p.text.slice(0, 12)]),
      [
        ["narration", "You might as"],
        ["blank", ""],
        ["cue", "[PAUSE]"],
        ["blank", ""],
        ["narration", "That counter"],
      ],
    );
  });

  test("URLs and JSON are kept verbatim", () => {
    const screencast = render("SCREENCAST");
    const json =
      '{"detail":[{"type":"enum","loc":["query","status"],"msg":"Input should be \'planned\', \'fermenting\', \'aging\' or \'bottled\'","input":"spilled","ctx":{"expected":"\'planned\', \'fermenting\', \'aging\' or \'bottled\'"}}]}';
    assert.ok(screencast.paragraphs.some((p) => p.text === json));
    assert.ok(
      screencast.paragraphs.some((p) => p.text === 'curl -i "http://127.0.0.1:8000/api/v1/batches?status=spilled"'),
    );
  });

  test("every source text line of the role appears exactly once, in order", () => {
    for (const role of ["ONSET", "MOTION", "SCREENCAST"]) {
      const expected = [];
      for (const stage of masterDocument.stages) {
        for (const video of stage.videos) {
          for (const section of video.sections.filter((s) => s.type === role)) {
            for (const item of section.content) {
              const inner = item.kind === "block" ? item.content : [item];
              for (const entry of inner) {
                if (entry.kind === "text") expected.push(entry.text);
              }
            }
          }
        }
      }
      const actual = render(role)
        .paragraphs.filter((p) => p.kind === "narration" || p.kind === "instruction" || p.kind === "blank")
        .map((p) => p.text);
      assert.deepEqual(actual, expected, role);
    }
  });

  test("a role with no sections produces a note instead of content", () => {
    const document = ProductionScript.parseProductionScript(
      lines("Stage 1: A", "Video 1: B", "[ONSET]", "x", "[/ONSET]"),
    ).document;
    const model = render("MOTION", document);
    assert.deepEqual(headings(model, "HEADING1"), []);
    assert.equal(model.paragraphs.at(-1).kind, "note");
    assert.match(model.paragraphs.at(-1).text, /no MOTION sections/);
  });
});
