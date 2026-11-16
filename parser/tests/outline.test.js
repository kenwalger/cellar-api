// The learner-facing outline (src/outline.js, npm run print-outline).

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseProductionScript } from "../src/index.js";
import { formatOutline } from "../src/outline.js";
import { lines, readRepoFile, splitMalformedCases } from "./helpers.js";

const master = readRepoFile("course/master-script.md");
const expectedStructure = JSON.parse(readRepoFile("course/fixtures/expected-structure.json"));

function outlineOf(text) {
  return formatOutline(parseProductionScript(text)).split("\n");
}

test("lists every video's sections in the order of the expected-structure fixture", () => {
  const outline = outlineOf(master);
  const listed = [];
  for (const row of outline) {
    const video = /^ {2}Video (\d+): (.+) \(line \d+\)$/.exec(row);
    const section = /^ {4}(ONSET|MOTION|SCREENCAST) /.exec(row);
    if (video) {
      listed.push({ title: video[2], sections: [] });
    } else if (section) {
      listed.at(-1).sections.push(section[1]);
    }
  }
  const expected = expectedStructure.stages.flatMap((stage) =>
    stage.videos.map((video) => ({ title: video.title, sections: video.sections })),
  );
  assert.deepEqual(listed, expected);
});

test("reports master-script totals and no diagnostics", () => {
  const outline = outlineOf(master);
  assert.ok(outline.includes("Totals: 2 stages, 6 videos, 13 sections (ONSET 6, MOTION 3, SCREENCAST 4)"));
  assert.equal(outline.at(-1), "Diagnostics: none");
});

test("shows source lines, annotation counts, and PAUSE cues inside blocks", () => {
  const outline = outlineOf(
    lines(
      "Stage 1: S",
      "Video 1: V",
      "[ONSET]",
      "One.",
      "[PAUSE]",
      "Two.",
      "[/ONSET]",
      "[SCREENCAST]",
      "[ACTION]",
      "Click.",
      "[VOICEOVER]",
      "Say.",
      "[PAUSE]",
      "More.",
      "[/SCREENCAST]",
    ),
  );
  assert.deepEqual(outline.slice(0, 4), [
    "Stage 1: S (line 1)",
    "  Video 1: V (line 2)",
    "    ONSET      lines 3-7         2 narration paragraphs, PAUSE 1",
    "    SCREENCAST lines 8-15        ACTION 1, VOICEOVER 1, PAUSE 1",
  ]);
  assert.ok(outline.includes("Annotations: ACTION 1, VISUAL 0, VOICEOVER 1, HIGHLIGHT 0, PAUSE 2"));
});

test("marks an unclosed section and lists the error with its code and line", () => {
  const [missing] = splitMalformedCases(readRepoFile("course/fixtures/malformed-script.md"));
  const outline = outlineOf(missing.text);
  assert.ok(outline.some((row) => /^ {4}ONSET {6}lines \d+-unclosed /.test(row)));
  assert.ok(outline.includes("Diagnostics: 1 error, 0 warnings"));
  assert.match(outline.at(-1), /^ {2}error {3}UNCLOSED_SECTION at line \d+: /);
});

test("says when a diagnostic has no line", () => {
  const outline = outlineOf("No stages here.");
  assert.match(outline.at(-1), /^ {2}error {3}NO_STAGES at no line: /);
});
