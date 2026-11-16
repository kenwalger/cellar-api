// Acceptance tests against the master script. The parser produces the IR;
// course/fixtures/expected-structure.json is the independent structure oracle.

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseProductionScript } from "../../parser/src/index.js";
import { WarningCode, estimateProduction } from "../src/index.js";
import { deepFreeze, readRepoFile } from "./helpers.js";

const master = readRepoFile("course/master-script.md");
const expected = JSON.parse(readRepoFile("course/fixtures/expected-structure.json"));
const parsed = parseProductionScript(master);
const estimate = estimateProduction(parsed.document);

// Spoken word counts recorded while the script was authored (Phase 2). They
// weren't produced by this estimator, so they act as an outside check of the
// word-count policy. See production/README.md#acceptance-figures.
const PHASE_2_REFERENCE_COUNTS = {
  "1.1": 273,
  "1.2": 287,
  "1.3": 246,
  "2.1": 280,
  "2.2": 666,
  "2.3": 228,
};

// Phase 4b revised the status-code passage in Stage 2, Video 2. Counted by
// hand under the documented policy, the 400s sentence stays at 15 words and
// the 500s sentence goes from 18 words to 16, so that video loses 2 words.
// Only that entry changes; the others still use the Phase 2 counts.
const REFERENCE_COUNTS = { ...PHASE_2_REFERENCE_COUNTS, "2.2": PHASE_2_REFERENCE_COUNTS["2.2"] - 2 };

test("the master script parses without errors", () => {
  assert.deepEqual(
    parsed.diagnostics.filter((d) => d.severity === "error"),
    [],
  );
});

test("two stages and six videos, matching the expected structure", () => {
  assert.equal(estimate.totals.stageCount, expected.stages.length);
  assert.equal(estimate.totals.stageCount, 2);
  assert.equal(estimate.totals.videoCount, 6);
  assert.deepEqual(
    estimate.stages.map((s) => [s.stageNumber, s.title, s.videoCount]),
    expected.stages.map((s) => [s.number, s.title, s.videos.length]),
  );
  const expectedVideos = expected.stages.flatMap((s) =>
    s.videos.map((v) => [s.number, v.number, v.title, v.sections]),
  );
  assert.deepEqual(
    estimate.videos.map((v) => [v.stageNumber, v.videoNumber, v.title, v.sectionSequence]),
    expectedVideos,
  );
});

test("section counts match the expected structure", () => {
  const counts = { ONSET: 0, MOTION: 0, SCREENCAST: 0 };
  expected.stages.forEach((s) => s.videos.forEach((v) => v.sections.forEach((type) => (counts[type] += 1))));
  assert.deepEqual(estimate.totals.sectionCounts, counts);
  assert.deepEqual(counts, { ONSET: 6, MOTION: 3, SCREENCAST: 4 });
  estimate.videos.forEach((video, index) => {
    const sequence = expectedVideosFlat()[index].sections;
    for (const type of ["ONSET", "MOTION", "SCREENCAST"]) {
      assert.equal(video.sectionCounts[type], sequence.filter((t) => t === type).length);
    }
  });
});

function expectedVideosFlat() {
  return expected.stages.flatMap((s) => s.videos);
}

test("spoken word counts match the reference counts (Phase 2, adjusted for the Phase 4b edit)", () => {
  const actual = Object.fromEntries(estimate.videos.map((v) => [`${v.stageNumber}.${v.videoNumber}`, v.spokenWordCount]));
  assert.deepEqual(actual, REFERENCE_COUNTS);
  assert.equal(estimate.totals.spokenWordCount, 1978);
});

test("stage and course totals reconcile with the video values", () => {
  const sum = (items, field) => items.reduce((total, item) => total + item[field], 0);
  for (const stage of estimate.stages) {
    const videos = estimate.videos.filter((v) => v.stageNumber === stage.stageNumber);
    for (const field of ["spokenWordCount", "narrationDurationSeconds", "screencastAllowanceSeconds", "estimatedDurationSeconds"]) {
      assert.equal(stage[field], sum(videos, field), `stage ${stage.stageNumber} ${field}`);
    }
  }
  for (const field of ["spokenWordCount", "narrationDurationSeconds", "screencastAllowanceSeconds", "estimatedDurationSeconds"]) {
    assert.equal(estimate.totals[field], sum(estimate.videos, field), field);
  }
});

test("long-video warnings follow the computed durations", () => {
  const thresholdSeconds = estimate.config.longVideoThresholdMinutes * 60;
  const over = estimate.videos.filter((v) => v.estimatedDurationSeconds > thresholdSeconds);
  assert.deepEqual(
    estimate.warnings.map((w) => [w.stageNumber, w.videoNumber]),
    over.map((v) => [v.stageNumber, v.videoNumber]),
  );
  assert.ok(estimate.warnings.every((w) => w.code === WarningCode.LONG_VIDEO_ESTIMATE));
});

test("at the defaults, only Stage 2, Video 2 exceeds three minutes (Phase 2 expectation)", () => {
  assert.deepEqual(
    estimate.warnings.map((w) => [w.stageNumber, w.videoNumber, w.title]),
    [[2, 2, "Handling Errors"]],
  );
  assert.equal(estimate.warnings[0].includesScreencastAllowance, false);
  assert.ok(Math.abs(estimate.warnings[0].estimatedDurationSeconds - 284.57) < 0.01);
});

test("a nonzero screencast allowance can flag more videos", () => {
  // Stage 1, Video 2: 287 words (123 s) + 60 s = 183 s, over three minutes.
  // Stage 2, Video 1: 280 words (120 s) + 60 s = exactly 180 s, so not flagged.
  const withAllowance = estimateProduction(parsed.document, { screencastAllowanceSecondsPerSection: 60 });
  assert.deepEqual(
    withAllowance.warnings.map((w) => [w.stageNumber, w.videoNumber, w.includesScreencastAllowance]),
    [
      [1, 2, true],
      [2, 2, true],
    ],
  );
  assert.equal(withAllowance.videos[3].estimatedDurationSeconds, 180);
  assert.equal(withAllowance.totals.screencastAllowanceSeconds, 4 * 60);
});

test("estimating is deterministic and leaves the parsed document unchanged", () => {
  const frozen = deepFreeze(parseProductionScript(master).document);
  const snapshot = JSON.stringify(frozen);
  const first = JSON.stringify(estimateProduction(frozen));
  assert.equal(JSON.stringify(estimateProduction(frozen)), first);
  assert.equal(JSON.stringify(frozen), snapshot);
  assert.equal(first, JSON.stringify(estimate));
});
