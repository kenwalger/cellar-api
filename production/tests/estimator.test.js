// estimateProduction: content classification, configuration, durations,
// warnings, and input handling. Test documents come from the real parser.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseProductionScript } from "../../parser/src/index.js";
import {
  DEFAULT_OPTIONS,
  SCHEMA_VERSION,
  WarningCode,
  checkOptions,
  estimateProduction,
  formatDuration,
} from "../src/index.js";
import { deepFreeze, lines, parseValid, words } from "./helpers.js";

// Speaking 60 words per minute makes seconds equal to word counts.
const ONE_WORD_PER_SECOND = { wordsPerMinute: 60 };

function onset(...content) {
  return ["[ONSET]", ...content, "[/ONSET]"];
}

function motion(...content) {
  return ["[MOTION]", ...content, "[/MOTION]"];
}

function screencast(...content) {
  return ["[SCREENCAST]", ...content, "[/SCREENCAST]"];
}

// One stage, one video, with the given section lines.
function singleVideo(...sectionLines) {
  return parseValid(lines("Stage 1: Stage", "Video 1: Video", ...sectionLines.flat()));
}

function onlyVideo(estimate) {
  assert.equal(estimate.videos.length, 1);
  return estimate.videos[0];
}

describe("spoken content classification", () => {
  test("ONSET narration is counted and PAUSE cues are not", () => {
    const video = onlyVideo(estimateProduction(singleVideo(onset("One two three.", "[PAUSE]", "Four five."))));
    assert.equal(video.spokenWordCount, 5);
  });

  test("VOICEOVER in MOTION is counted; VISUAL and HIGHLIGHT are not", () => {
    const document = singleVideo(
      motion("[VISUAL]", "A visual direction of seven words here.", "[VOICEOVER]", "Spoken words.", "[HIGHLIGHT]", "Highlight these three."),
    );
    assert.equal(onlyVideo(estimateProduction(document)).spokenWordCount, 2);
  });

  test("VOICEOVER in SCREENCAST is counted; ACTION and HIGHLIGHT are not", () => {
    const document = singleVideo(
      screencast(
        "[ACTION]",
        "Open http://127.0.0.1:8000/docs in a browser.",
        "[VOICEOVER]",
        "This is the documentation.",
        "[PAUSE]",
        "It keeps going after a pause.",
        "[HIGHLIGHT]",
        '{"detail": "Batch not found"}',
      ),
    );
    assert.equal(onlyVideo(estimateProduction(document)).spokenWordCount, 10);
  });

  test("headings, front matter, and tags are not counted", () => {
    const document = parseValid(
      lines("Front matter with five words", "", "Stage 1: Many title words here", "Video 1: More title words", ...onset("Hello.")),
    );
    assert.equal(estimateProduction(document).totals.spokenWordCount, 1);
  });

  test("blank lines inside narration add no words", () => {
    const document = singleVideo(onset("One.", "", "   ", "Two."), motion("[VOICEOVER]", "Three.", "", "Four."));
    assert.equal(onlyVideo(estimateProduction(document)).spokenWordCount, 4);
  });

  test("multiple sections of the same type are all counted", () => {
    const document = singleVideo(onset("One two."), motion("[VOICEOVER]", "Three."), onset("Four five six."));
    const video = onlyVideo(estimateProduction(document));
    assert.equal(video.spokenWordCount, 6);
    assert.deepEqual(video.sectionCounts, { ONSET: 2, MOTION: 1, SCREENCAST: 0 });
    assert.deepEqual(video.sectionSequence, ["ONSET", "MOTION", "ONSET"]);
  });

  test("content order doesn't change counts", () => {
    const a = singleVideo(onset("One two."), screencast("[ACTION]", "Act.", "[VOICEOVER]", "Three four five."));
    const b = singleVideo(screencast("[VOICEOVER]", "Three four five.", "[ACTION]", "Act."), onset("One two."));
    const [videoA, videoB] = [onlyVideo(estimateProduction(a)), onlyVideo(estimateProduction(b))];
    assert.equal(videoA.spokenWordCount, 5);
    assert.equal(videoB.spokenWordCount, 5);
    assert.deepEqual(videoA.sectionCounts, videoB.sectionCounts);
  });

  test("technical tokens in narration are counted and reported", () => {
    const video = onlyVideo(estimateProduction(singleVideo(onset("Request /api/v1/batches with status=planned."))));
    assert.equal(video.spokenWordCount, 4);
    assert.equal(video.technicalTokenCount, 2);
  });

  test("a video with no sections has zero words and zero duration", () => {
    const document = parseValid(lines("Stage 1: S", "Video 1: Empty", "Video 2: Full", ...onset("Hi.")));
    const estimate = estimateProduction(document);
    assert.equal(estimate.videos[0].spokenWordCount, 0);
    assert.equal(estimate.videos[0].estimatedDurationSeconds, 0);
    assert.deepEqual(estimate.videos[0].sectionSequence, []);
  });
});

describe("configuration", () => {
  test("defaults are 140 WPM, a 3-minute threshold, and no screencast allowance", () => {
    assert.deepEqual(DEFAULT_OPTIONS, {
      wordsPerMinute: 140,
      longVideoThresholdMinutes: 3,
      screencastAllowanceSecondsPerSection: 0,
    });
    const estimate = estimateProduction(singleVideo(onset("Hi.")));
    assert.deepEqual(estimate.config, DEFAULT_OPTIONS);
    assert.equal(estimate.schemaVersion, SCHEMA_VERSION);
  });

  test("omitted options use their defaults", () => {
    const estimate = estimateProduction(singleVideo(onset("Hi.")), { wordsPerMinute: 120 });
    assert.deepEqual(estimate.config, { ...DEFAULT_OPTIONS, wordsPerMinute: 120 });
  });

  test("a custom speaking rate changes narration duration", () => {
    const document = singleVideo(onset(words(150)));
    assert.equal(onlyVideo(estimateProduction(document, { wordsPerMinute: 150 })).narrationDurationSeconds, 60);
    assert.equal(onlyVideo(estimateProduction(document, { wordsPerMinute: 100 })).narrationDurationSeconds, 90);
  });

  test("narration duration is words / WPM x 60 at full precision", () => {
    const video = onlyVideo(estimateProduction(singleVideo(onset(words(666)))));
    assert.equal(video.narrationDurationSeconds, (666 * 60) / 140);
    assert.ok(Math.abs(video.narrationDurationSeconds - 285.428571) < 1e-6);
  });

  test("the screencast allowance is per SCREENCAST section and only for SCREENCAST", () => {
    const document = singleVideo(
      onset(words(10)),
      screencast("[ACTION]", "Act.", "[VOICEOVER]", words(5)),
      motion("[VOICEOVER]", words(5)),
      screencast("[ACTION]", "Act again."),
    );
    const video = onlyVideo(
      estimateProduction(document, { ...ONE_WORD_PER_SECOND, screencastAllowanceSecondsPerSection: 12.5 }),
    );
    assert.equal(video.narrationDurationSeconds, 20);
    assert.equal(video.screencastAllowanceSeconds, 25);
    assert.equal(video.estimatedDurationSeconds, 45);
  });

  test("a zero allowance adds nothing", () => {
    const video = onlyVideo(estimateProduction(singleVideo(screencast("[ACTION]", "Act."))));
    assert.equal(video.screencastAllowanceSeconds, 0);
    assert.equal(video.estimatedDurationSeconds, 0);
  });

  const invalidCases = [
    ["zero words per minute", { wordsPerMinute: 0 }, /wordsPerMinute/],
    ["negative words per minute", { wordsPerMinute: -140 }, /wordsPerMinute/],
    ["NaN words per minute", { wordsPerMinute: Number.NaN }, /wordsPerMinute/],
    ["infinite words per minute", { wordsPerMinute: Number.POSITIVE_INFINITY }, /wordsPerMinute/],
    ["string words per minute", { wordsPerMinute: "140" }, /wordsPerMinute/],
    ["zero threshold", { longVideoThresholdMinutes: 0 }, /longVideoThresholdMinutes/],
    ["negative threshold", { longVideoThresholdMinutes: -1 }, /longVideoThresholdMinutes/],
    ["infinite threshold", { longVideoThresholdMinutes: Number.POSITIVE_INFINITY }, /longVideoThresholdMinutes/],
    ["negative allowance", { screencastAllowanceSecondsPerSection: -5 }, /screencastAllowanceSecondsPerSection/],
    ["NaN allowance", { screencastAllowanceSecondsPerSection: Number.NaN }, /screencastAllowanceSecondsPerSection/],
    ["null allowance", { screencastAllowanceSecondsPerSection: null }, /screencastAllowanceSecondsPerSection/],
    ["unknown field", { wordsPerMinuet: 140 }, /Unknown option "wordsPerMinuet"/],
    ["non-object options", 140, /object/],
    ["null options", null, /object/],
    ["array options", [], /object/],
  ];

  for (const [name, options, pattern] of invalidCases) {
    test(`rejects ${name}`, () => {
      const errors = checkOptions(options);
      assert.equal(errors.length, 1, JSON.stringify(errors));
      assert.match(errors[0], pattern);
      assert.throws(
        () => estimateProduction(singleVideo(onset("Hi.")), options),
        (error) => error instanceof RangeError && /Invalid estimator configuration/.test(error.message) && pattern.test(error.message),
      );
    });
  }

  test("reports every invalid field at once", () => {
    assert.equal(
      checkOptions({ wordsPerMinute: 0, longVideoThresholdMinutes: -1, screencastAllowanceSecondsPerSection: -1, extra: 1 })
        .length,
      4,
    );
  });

  test("valid options and undefined have no errors", () => {
    assert.deepEqual(checkOptions(undefined), []);
    assert.deepEqual(checkOptions({}), []);
    assert.deepEqual(
      checkOptions({ wordsPerMinute: 0.5, longVideoThresholdMinutes: 0.25, screencastAllowanceSecondsPerSection: 0 }),
      [],
    );
  });
});

describe("long-video warnings", () => {
  const threshold = { ...ONE_WORD_PER_SECOND, longVideoThresholdMinutes: 1 };

  function twoVideos(firstWords, secondWords) {
    return parseValid(
      lines("Stage 1: S", "Video 1: First", ...onset(words(firstWords)), "Video 2: Second", ...onset(words(secondWords))),
    );
  }

  test("a video exactly at the threshold is not flagged", () => {
    const estimate = estimateProduction(twoVideos(60, 10), threshold);
    assert.equal(estimate.videos[0].estimatedDurationSeconds, 60);
    assert.deepEqual(estimate.warnings, []);
    assert.deepEqual(estimate.videos[0].warnings, []);
    assert.equal(estimate.totals.videosOverThreshold, 0);
  });

  test("a video strictly over the threshold is flagged with full details", () => {
    const estimate = estimateProduction(twoVideos(61, 10), threshold);
    assert.equal(estimate.warnings.length, 1);
    const warning = estimate.warnings[0];
    assert.equal(warning.code, WarningCode.LONG_VIDEO_ESTIMATE);
    assert.equal(warning.code, "LONG_VIDEO_ESTIMATE");
    assert.equal(warning.stageNumber, 1);
    assert.equal(warning.videoNumber, 1);
    assert.equal(warning.title, "First");
    assert.equal(warning.estimatedDurationSeconds, 61);
    assert.equal(warning.thresholdSeconds, 60);
    assert.equal(warning.includesScreencastAllowance, false);
    assert.equal(typeof warning.message, "string");
    assert.deepEqual(estimate.videos[0].warnings, [warning]);
    assert.deepEqual(estimate.videos[1].warnings, []);
  });

  test("multiple videos can be flagged, in document order", () => {
    const estimate = estimateProduction(twoVideos(90, 61), threshold);
    assert.deepEqual(
      estimate.warnings.map((w) => w.videoNumber),
      [1, 2],
    );
    assert.equal(estimate.totals.videosOverThreshold, 2);
    assert.equal(estimate.stages[0].warningCount, 2);
  });

  test("no warnings when every video is under the threshold", () => {
    assert.deepEqual(estimateProduction(twoVideos(10, 10), threshold).warnings, []);
  });

  test("a nonzero screencast allowance can push a video over the threshold", () => {
    const document = singleVideo(onset(words(50)), screencast("[ACTION]", "Act.", "[VOICEOVER]", words(5)));
    assert.deepEqual(estimateProduction(document, threshold).warnings, []);
    const withAllowance = estimateProduction(document, { ...threshold, screencastAllowanceSecondsPerSection: 10 });
    assert.equal(withAllowance.warnings.length, 1);
    assert.equal(withAllowance.warnings[0].estimatedDurationSeconds, 65);
    assert.equal(withAllowance.warnings[0].includesScreencastAllowance, true);
  });

  test("includesScreencastAllowance is false when a video has no SCREENCAST section", () => {
    const estimate = estimateProduction(singleVideo(onset(words(61))), {
      ...threshold,
      screencastAllowanceSecondsPerSection: 30,
    });
    assert.equal(estimate.warnings[0].includesScreencastAllowance, false);
  });
});

describe("summaries and totals", () => {
  const document = parseValid(
    lines(
      "Stage 1: Alpha",
      "Video 1: A1",
      ...onset(words(7)),
      ...screencast("[ACTION]", "Act.", "[VOICEOVER]", words(3)),
      "Video 2: A2",
      ...motion("[VOICEOVER]", words(11)),
      "Stage 2: Beta",
      "Video 1: B1",
      ...screencast("[VOICEOVER]", words(13)),
      ...onset(words(2)),
    ),
  );
  const options = { wordsPerMinute: 140, screencastAllowanceSecondsPerSection: 7 };
  const estimate = estimateProduction(document, options);

  test("video summaries carry identity, facts, and estimates", () => {
    assert.deepEqual(
      estimate.videos.map((v) => [v.stageNumber, v.videoNumber, v.title, v.spokenWordCount, v.screencastAllowanceSeconds]),
      [
        [1, 1, "A1", 10, 7],
        [1, 2, "A2", 11, 0],
        [2, 1, "B1", 15, 7],
      ],
    );
    for (const video of estimate.videos) {
      assert.equal(video.estimatedDurationSeconds, video.narrationDurationSeconds + video.screencastAllowanceSeconds);
    }
  });

  test("stage summaries add up their videos exactly", () => {
    assert.deepEqual(
      estimate.stages.map((s) => [s.stageNumber, s.title, s.videoCount]),
      [
        [1, "Alpha", 2],
        [2, "Beta", 1],
      ],
    );
    for (const stage of estimate.stages) {
      const videos = estimate.videos.filter((v) => v.stageNumber === stage.stageNumber);
      for (const field of ["spokenWordCount", "narrationDurationSeconds", "screencastAllowanceSeconds", "estimatedDurationSeconds"]) {
        assert.equal(stage[field], videos.reduce((sum, v) => sum + v[field], 0), field);
      }
      for (const type of ["ONSET", "MOTION", "SCREENCAST"]) {
        assert.equal(stage.sectionCounts[type], videos.reduce((sum, v) => sum + v.sectionCounts[type], 0));
      }
    }
  });

  test("course totals add up every video exactly, in document order", () => {
    const t = estimate.totals;
    assert.equal(t.stageCount, 2);
    assert.equal(t.videoCount, 3);
    assert.deepEqual(t.sectionCounts, { ONSET: 2, MOTION: 1, SCREENCAST: 2 });
    for (const field of [
      "spokenWordCount",
      "technicalTokenCount",
      "narrationDurationSeconds",
      "screencastAllowanceSeconds",
      "estimatedDurationSeconds",
    ]) {
      assert.equal(t[field], estimate.videos.reduce((sum, v) => sum + v[field], 0), field);
    }
    assert.equal(t.spokenWordCount, 36);
    assert.equal(t.screencastAllowanceSeconds, 14);
  });

  test("assumptions are listed with stable codes", () => {
    const codes = estimate.assumptions.map((a) => a.code);
    assert.deepEqual(codes, [
      "NARRATION_ONLY",
      "SPEAKING_RATE",
      "SCREENCAST_ALLOWANCE",
      "THRESHOLD_RULE",
      "WORD_COUNT_POLICY",
      "UNMODELED_FACTORS",
    ]);
    for (const assumption of estimate.assumptions) {
      assert.equal(typeof assumption.text, "string");
      assert.ok(assumption.text.length > 20);
    }
  });
});

describe("input handling", () => {
  test("the input document is not mutated", () => {
    const document = deepFreeze(singleVideo(onset("One two."), screencast("[ACTION]", "Act.", "[VOICEOVER]", "Three.")));
    const before = JSON.stringify(document);
    estimateProduction(document, { screencastAllowanceSecondsPerSection: 5 });
    assert.equal(JSON.stringify(document), before);
  });

  test("the options object is not mutated or retained", () => {
    const options = deepFreeze({ wordsPerMinute: 120 });
    const estimate = estimateProduction(singleVideo(onset("Hi.")), options);
    assert.notEqual(estimate.config, options);
  });

  test("the same input always produces the same output", () => {
    const make = () => singleVideo(onset(words(321)), screencast("[VOICEOVER]", "/api/v1/batches"));
    const options = { screencastAllowanceSecondsPerSection: 20 };
    assert.equal(JSON.stringify(estimateProduction(make(), options)), JSON.stringify(estimateProduction(make(), options)));
  });

  test("throws TypeError for something that isn't a parser document", () => {
    for (const bad of [undefined, null, "text", {}, { stages: "x" }]) {
      assert.throws(() => estimateProduction(bad), TypeError);
    }
  });

  test("refuses a document with an unclosed section instead of estimating it", () => {
    const { document } = parseProductionScript(lines("Stage 1: S", "Video 1: V", "[ONSET]", "Hi."));
    assert.throws(() => estimateProduction(document), /unclosed|not closed/i);
  });

  test("refuses content whose spoken status it can't determine", () => {
    const document = singleVideo(motion("[VOICEOVER]", "Hi."));
    document.stages[0].videos[0].sections[0].content[0].type = "NARRATION";
    assert.throws(() => estimateProduction(document), /NARRATION/);

    const unknownSection = singleVideo(onset("Hi."));
    unknownSection.stages[0].videos[0].sections[0].type = "PODCAST";
    assert.throws(() => estimateProduction(unknownSection), /PODCAST/);

    const unknownItem = singleVideo(onset("Hi."));
    unknownItem.stages[0].videos[0].sections[0].content[0].kind = "comment";
    assert.throws(() => estimateProduction(unknownItem), /comment/);
  });
});

describe("formatDuration", () => {
  test("rounds to the nearest whole second for display only", () => {
    assert.equal(formatDuration(285.4285714), "4 min 45 s");
    assert.equal(formatDuration(180), "3 min 0 s");
    assert.equal(formatDuration(59.5), "1 min 0 s");
    assert.equal(formatDuration(59.49), "0 min 59 s");
    assert.equal(formatDuration(0), "0 min 0 s");
  });

  test("rejects values that aren't durations", () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, "180"]) {
      assert.throws(() => formatDuration(bad), TypeError);
    }
  });
});
