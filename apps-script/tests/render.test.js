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
      model.paragraphs.slice(index, index + 3).map((p) => p.kind),
      ["narration", "cue", "narration"],
    );
    assert.equal(model.paragraphs[index + 1].text, "[PAUSE]");
  });

  test("ONSET narration and pauses render in order", () => {
    const model = render("ONSET");
    const index = model.paragraphs.findIndex((p) => p.text.startsWith("You might ask which wines"));
    assert.deepEqual(
      model.paragraphs.slice(index, index + 3).map((p) => [p.kind, p.text.slice(0, 12)]),
      [
        ["narration", "You might as"],
        ["cue", "[PAUSE]"],
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
      // Blank lines are checked separately (see "PAUSE spacing").
      const actual = render(role)
        .paragraphs.filter((p) => ["narration", "instruction", "example"].includes(p.kind))
        .map((p) => p.text);
      assert.deepEqual(
        actual,
        expected.filter((text) => text.trim() !== ""),
        role,
      );
    }
  });

  test("MOTION output for the master script keeps every line, blank lines included, with no examples", () => {
    // The master's MOTION sections have no PAUSE cues, and examples are a
    // SCREENCAST convention, so Phase 4b changes nothing here.
    const expected = [];
    for (const stage of masterDocument.stages) {
      for (const video of stage.videos) {
        for (const section of video.sections.filter((s) => s.type === "MOTION")) {
          for (const block of section.content) {
            expected.push(["label", block.type]);
            for (const entry of block.content) {
              let kind = block.type === "VOICEOVER" ? "narration" : "instruction";
              if (entry.text.trim() === "") kind = "blank";
              expected.push([kind, entry.text]);
            }
          }
        }
      }
    }
    const actual = render("MOTION")
      .paragraphs.filter((p) => ["label", "narration", "instruction", "blank", "example", "cue"].includes(p.kind))
      .map((p) => [p.kind, p.text]);
    assert.deepEqual(actual, expected);
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

describe("PAUSE spacing", () => {
  function onsetKinds(...content) {
    const document = ProductionScript.parseProductionScript(
      lines("Stage 1: A", "Video 1: B", "[ONSET]", ...content, "[/ONSET]"),
    ).document;
    return render("ONSET", document)
      .paragraphs.slice(5)
      .map((p) => [p.kind, p.text]);
  }

  test("blank lines next to a cue are dropped; paragraph breaks elsewhere stay", () => {
    assert.deepEqual(onsetKinds("One.", "", "Two.", "", "", "[PAUSE]", "", "", "Three."), [
      ["narration", "One."],
      ["blank", ""],
      ["narration", "Two."],
      ["cue", "[PAUSE]"],
      ["narration", "Three."],
    ]);
  });

  test("consecutive cues and cues without blank lines keep their place", () => {
    assert.deepEqual(onsetKinds("One.", "[PAUSE]", "", "[PAUSE]", "Two."), [
      ["narration", "One."],
      ["cue", "[PAUSE]"],
      ["cue", "[PAUSE]"],
      ["narration", "Two."],
    ]);
  });

  test("every PAUSE in the master script is kept, between the same lines as in the source", () => {
    const masterLines = master.split("\n").filter((line) => line.trim() !== "");
    let total = 0;
    for (const role of ["ONSET", "SCREENCAST"]) {
      const paragraphs = render(role).paragraphs.filter((p) => p.kind !== "blank");
      paragraphs.forEach((p, index) => {
        if (p.kind !== "cue") return;
        total += 1;
        assert.equal(p.text, "[PAUSE]");
        const before = masterLines.indexOf(paragraphs[index - 1].text);
        assert.equal(masterLines[before + 1], "[PAUSE]", role);
        assert.equal(masterLines[before + 2], paragraphs[index + 1].text, role);
      });
    }
    // Four PAUSE cues in ONSET sections and two in SCREENCAST VOICEOVER blocks.
    assert.equal(total, master.split("\n").filter((line) => line.trim() === "[PAUSE]").length);
  });
});

describe("SCREENCAST technical examples", () => {
  const screencast = render("SCREENCAST");
  const byText = (text) => screencast.paragraphs.filter((p) => p.text === text);

  const examples = [
    '{"batch_id": "2026-014", "name": "North Block Pinot Noir", "varietal": "Pinot Noir", "vintage": 2026, "status": "fermenting", "temperature_c": 21.4, "days_since_start": 8}',
    '{"batch_id": "2026-025", "name": "Late Harvest Riesling", "varietal": "Riesling", "vintage": 2026, "status": "fermenting", "temperature_c": null, "days_since_start": 3}',
    '{"detail": "Batch not found"}',
    'curl -i "http://127.0.0.1:8000/api/v1/batches?status=spilled"',
    '{"detail":[{"type":"enum","loc":["query","status"],"msg":"Input should be \'planned\', \'fermenting\', \'aging\' or \'bottled\'","input":"spilled","ctx":{"expected":"\'planned\', \'fermenting\', \'aging\' or \'bottled\'"}}]}',
    'curl -i "http://127.0.0.1:8000/api/v1/batches?status=Fermenting"',
  ];

  test("each example in the master script is an example paragraph with its exact source text", () => {
    const sourceLines = master.split("\n");
    for (const text of examples) {
      assert.ok(sourceLines.includes(text), `not in source: ${text}`);
      assert.deepEqual(
        byText(text).map((p) => [p.style, p.kind]),
        [["NORMAL", "example"]],
        text,
      );
    }
    assert.deepEqual(
      screencast.paragraphs.filter((p) => p.kind === "example").map((p) => p.text),
      examples,
    );
  });

  test("lead-in lines and other directions stay directions", () => {
    for (const text of [
      "Open a terminal. Run:",
      "Run:",
      "The response body:",
      "The response code 200 and the response body:",
      "The Request URL: http://127.0.0.1:8000/api/v1/batches/2026-014",
      '"temperature_c": null',
      "Enter 2026-014 in the batch_id field. Select Execute.",
    ]) {
      assert.ok(byText(text).length > 0, text);
      assert.ok(
        byText(text).every((p) => p.kind === "instruction"),
        text,
      );
    }
  });

  test("VOICEOVER narration is unchanged and never an example", () => {
    const narration = screencast.paragraphs.find((p) => p.text.startsWith("For the next request we'll use a terminal"));
    assert.equal(narration.kind, "narration");
    const document = ProductionScript.parseProductionScript(
      lines("Stage 1: A", "Video 1: B", "[SCREENCAST]", "[VOICEOVER]", "Say this:", "", "curl is a tool.", "[/SCREENCAST]"),
    ).document;
    assert.deepEqual(
      render("SCREENCAST", document)
        .paragraphs.slice(-4)
        .map((p) => [p.kind, p.text]),
      [
        ["label", "VOICEOVER"],
        ["narration", "Say this:"],
        ["blank", ""],
        ["narration", "curl is a tool."],
      ],
    );
  });

  function screencastBlock(...blockLines) {
    const document = ProductionScript.parseProductionScript(
      lines("Stage 1: A", "Video 1: B", "[SCREENCAST]", "[ACTION]", ...blockLines, "[/SCREENCAST]"),
    ).document;
    return render("SCREENCAST", document)
      .paragraphs.slice(6)
      .map((p) => [p.kind, p.text]);
  }

  test("an example runs until the next blank line, keeping indentation and line breaks", () => {
    assert.deepEqual(screencastBlock("Run:", "", "curl \\", '    -i "http://x/y"', "", "Then wait."), [
      ["instruction", "Run:"],
      ["blank", ""],
      ["example", "curl \\"],
      ["example", '    -i "http://x/y"'],
      ["blank", ""],
      ["instruction", "Then wait."],
    ]);
  });

  test("an example can follow its lead-in directly, and a PAUSE ends it", () => {
    assert.deepEqual(screencastBlock("Run:", "ls", "[PAUSE]", "Look."), [
      ["instruction", "Run:"],
      ["example", "ls"],
      ["cue", "[PAUSE]"],
      ["instruction", "Look."],
    ]);
  });

  test("code-like text without a lead-in is not an example", () => {
    assert.deepEqual(screencastBlock('{"a": 1}', "curl http://x"), [
      ["instruction", '{"a": 1}'],
      ["instruction", "curl http://x"],
    ]);
  });

  test("the convention applies only to SCREENCAST ACTION and HIGHLIGHT blocks", () => {
    const document = ProductionScript.parseProductionScript(
      lines("Stage 1: A", "Video 1: B", "[MOTION]", "[HIGHLIGHT]", "The body:", "", '{"a": 1}', "[/MOTION]"),
    ).document;
    assert.ok(!render("MOTION", document).paragraphs.some((p) => p.kind === "example"));
    assert.ok(!render("ONSET").paragraphs.some((p) => p.kind === "example"));
    assert.ok(!render("MOTION").paragraphs.some((p) => p.kind === "example"));
  });
});
