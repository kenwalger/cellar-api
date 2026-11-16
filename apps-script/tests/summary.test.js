// The Production Summary document model and log lines (Summary).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { loadAppsScript, plain, readRepoFile } from "./helpers.js";

const { ProductionEstimator, ProductionScript, Summary } = loadAppsScript();
const master = readRepoFile("course/master-script.md");
const document = ProductionScript.parseProductionScript(master).document;

const meta = {
  courseTitle: "Understanding APIs: A Winery's Digital Cellar",
  sourceTitle: "Master Script",
  sourceUrl: "https://docs.test/source-id",
  generatedAt: "2026-11-13T23:16:05.000Z",
  runId: "a1b2c3d4",
  folderName: "Digital Cellar Production — 2026-11-13 231605 UTC — a1b2c3d4",
  parser: { version: "0.1.0", coreSha256: "cd".repeat(32) },
  estimator: { version: "0.1.0", coreSha256: "ef".repeat(32) },
};

function build(options) {
  const estimate = ProductionEstimator.estimateProduction(document, options);
  return { estimate: plain(estimate), model: plain(Summary.buildSummaryDocument(estimate, meta)) };
}

function texts(model) {
  return model.paragraphs.map((p) => p.text);
}

// Paragraph texts between a HEADING1 and the next HEADING1.
function section(model, heading) {
  const start = model.paragraphs.findIndex((p) => p.style === "HEADING1" && p.text === heading);
  assert.notEqual(start, -1, `missing section ${heading}`);
  const rest = model.paragraphs.slice(start + 1);
  const end = rest.findIndex((p) => p.style === "HEADING1");
  return end === -1 ? rest : rest.slice(0, end);
}

describe("Production Summary at the default configuration", () => {
  const { estimate, model } = build();
  const all = texts(model);

  test("is titled as the fourth role document", () => {
    assert.equal(model.role, "PRODUCTION_SUMMARY");
    assert.equal(model.role, Summary.ROLE);
    assert.equal(model.title, `Production Summary — ${meta.courseTitle} — a1b2c3d4`);
    assert.deepEqual(model.paragraphs[0], { style: "TITLE", kind: "heading", text: meta.courseTitle });
    assert.equal(model.paragraphs[1].style, "SUBTITLE");
    assert.match(model.paragraphs[1].text, /^Production Summary/);
  });

  test("has the expected sections in order", () => {
    assert.deepEqual(
      model.paragraphs.filter((p) => p.style === "HEADING1").map((p) => p.text),
      ["Estimator configuration", "Course overview", "Video breakdown", "Warnings", "Estimation methodology", "Provenance"],
    );
  });

  test("the opening states provenance and that figures are estimates", () => {
    const opening = all.slice(0, model.paragraphs.findIndex((p) => p.style === "HEADING1")).join("\n");
    assert.match(opening, /2026-11-13T23:16:05\.000Z/);
    assert.match(opening, /"Master Script"/);
    assert.match(opening, /https:\/\/docs\.test\/source-id/);
    assert.match(opening, /a1b2c3d4/);
    assert.match(opening, /estimate/i);
  });

  test("shows the configuration that was used", () => {
    const text = section(model, "Estimator configuration").map((p) => p.text).join("\n");
    assert.match(text, /Words per minute: 140/);
    assert.match(text, /Long-video threshold: 3 minutes/);
    assert.match(text, /Screencast allowance: 0 seconds per SCREENCAST section \(narration-only estimate\)/);
    assert.match(text, /Estimator version: 0\.1\.0/);
  });

  test("the course overview uses the estimator's totals", () => {
    const text = section(model, "Course overview").map((p) => p.text);
    const t = estimate.totals;
    assert.deepEqual(text, [
      "Stages: 2",
      "Videos: 6",
      "Production sections: 13 (ONSET 6, MOTION 3, SCREENCAST 4)",
      `Spoken words: ${t.spokenWordCount}`,
      `Estimated narration: ${ProductionEstimator.formatDuration(t.narrationDurationSeconds)}`,
      "Screencast allowance: 0 min 0 s",
      `Estimated total: ${ProductionEstimator.formatDuration(t.estimatedDurationSeconds)}`,
      "Videos over the threshold: 1",
    ]);
    assert.equal(text[3], "Spoken words: 1980");
    assert.equal(text[6], "Estimated total: 14 min 9 s");
  });

  test("the video breakdown lists every stage and video in order", () => {
    const breakdown = section(model, "Video breakdown");
    assert.deepEqual(
      breakdown.filter((p) => p.style === "HEADING2").map((p) => p.text),
      ["Stage 1: Understanding the Interface", "Stage 2: Working with an API"],
    );
    assert.deepEqual(
      breakdown.filter((p) => p.style === "HEADING3").map((p) => p.text),
      [
        "Video 1: What Is an API?",
        "Video 2: Requests and Responses",
        "Video 3: Understanding JSON",
        "Video 1: Making API Requests",
        "Video 2: Handling Errors",
        "Video 3: Wrapping Up",
      ],
    );
  });

  test("each video shows its sequence, counts, words, durations, and status", () => {
    const breakdown = section(model, "Video breakdown");
    const start = breakdown.findIndex((p) => p.text === "Video 2: Handling Errors");
    const lines = breakdown.slice(start + 1, start + 8).map((p) => p.text);
    assert.deepEqual(lines, [
      "Sections: ONSET → MOTION → SCREENCAST → ONSET",
      "Section counts: ONSET 2, MOTION 1, SCREENCAST 1",
      "Spoken words: 666",
      "Narration: 4 min 45 s",
      "Screencast allowance: 0 min 0 s",
      "Estimated total: 4 min 45 s",
      "Status: OVER the 3 min 0 s threshold (LONG_VIDEO_ESTIMATE)",
    ]);
    assert.equal(breakdown[start + 7].kind, "warning");

    const first = breakdown.findIndex((p) => p.text === "Video 1: What Is an API?");
    assert.equal(breakdown[first + 7].text, "Status: within the 3 min 0 s threshold");
  });

  test("notes technical tokens that may take longer to read aloud", () => {
    const breakdown = section(model, "Video breakdown").map((p) => p.text);
    assert.ok(breakdown.includes("Spoken words: 246 (2 are URLs, paths, or code, which may take longer to say)"));
    assert.ok(breakdown.includes("Spoken words: 273"));
  });

  test("the warnings section lists each flagged video", () => {
    const warnings = section(model, "Warnings");
    assert.deepEqual(
      warnings.filter((p) => p.kind === "warning").map((p) => p.text),
      estimate.warnings.map((w) => `LONG_VIDEO_ESTIMATE: ${w.message}`),
    );
    assert.equal(warnings.filter((p) => p.kind === "warning").length, 1);
  });

  test("the methodology explains every assumption and the rounding rule", () => {
    const text = section(model, "Estimation methodology").map((p) => p.text);
    for (const assumption of estimate.assumptions) {
      assert.ok(text.includes(assumption.text), assumption.code);
    }
    assert.ok(text.some((t) => /rounded to the nearest second/.test(t)));
  });

  test("provenance points to the run and its manifest", () => {
    const text = section(model, "Provenance").map((p) => p.text).join("\n");
    assert.match(text, /Run ID: a1b2c3d4/);
    assert.match(text, new RegExp(meta.folderName));
    assert.match(text, /manifest\.json/);
    assert.match(text, /Parser version: 0\.1\.0/);
    assert.match(text, /Estimator version: 0\.1\.0/);
    assert.match(text, /efefef/);
  });

  test("contains no script content", () => {
    assert.ok(!all.some((t) => /Picture a small winery/.test(t)));
  });

  test("every paragraph uses a known style and kind", () => {
    for (const p of model.paragraphs) {
      assert.ok(["TITLE", "SUBTITLE", "HEADING1", "HEADING2", "HEADING3", "NORMAL"].includes(p.style), p.style);
      assert.ok(["heading", "provenance", "note", "fact", "warning"].includes(p.kind), p.kind);
      assert.equal(typeof p.text, "string");
    }
  });
});

describe("Production Summary with other configurations", () => {
  test("states explicitly when there are no warnings", () => {
    const { model } = build({ longVideoThresholdMinutes: 10 });
    const warnings = section(model, "Warnings");
    assert.equal(warnings.filter((p) => p.kind === "warning").length, 0);
    assert.deepEqual(
      warnings.map((p) => p.text),
      ["No video's estimated duration is over the 10 min 0 s threshold under the current assumptions."],
    );
  });

  test("shows a nonzero screencast allowance and which warnings include it", () => {
    const { model } = build({ screencastAllowanceSecondsPerSection: 60 });
    const text = texts(model);
    assert.ok(text.includes("Screencast allowance: 60 seconds per SCREENCAST section"));
    assert.ok(text.includes("Screencast allowance: 4 min 0 s"));
    const warnings = section(model, "Warnings").filter((p) => p.kind === "warning");
    assert.equal(warnings.length, 2);
    assert.ok(warnings.every((p) => /includes a screencast allowance/.test(p.text)));
  });

  test("a faster speaking rate shortens every duration without changing word counts", () => {
    const slow = build();
    // 666 words at 230 WPM is about 174 s, under the 180 s threshold.
    const fast = build({ wordsPerMinute: 230 });
    assert.deepEqual(
      fast.estimate.videos.map((v) => v.spokenWordCount),
      slow.estimate.videos.map((v) => v.spokenWordCount),
    );
    fast.estimate.videos.forEach((video, index) => {
      assert.ok(video.estimatedDurationSeconds < slow.estimate.videos[index].estimatedDurationSeconds);
    });
    assert.ok(texts(fast.model).includes("Words per minute: 230"));
    assert.deepEqual(fast.estimate.warnings, []);
  });
});

describe("formatLogLines", () => {
  test("logs the active configuration, each video, the total, and warnings", () => {
    const estimate = ProductionEstimator.estimateProduction(document);
    const log = plain(Summary.formatLogLines(estimate));
    assert.equal(
      log[0],
      "Estimator configuration: 140 words per minute, long-video threshold 3 minutes, screencast allowance 0 seconds per SCREENCAST section.",
    );
    assert.ok(log.includes("Stage 2, Video 2 \"Handling Errors\": 666 spoken words, estimated 4 min 45 s"));
    assert.ok(log.includes("Course estimate: 1980 spoken words, 14 min 9 s across 6 videos."));
    assert.ok(log.includes(`WARNING LONG_VIDEO_ESTIMATE: ${estimate.warnings[0].message}`));
  });
});
