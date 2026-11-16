/**
 * Builds the Production Summary document from the estimator's result, plus
 * the estimate lines written to the execution log. Like Render, the result is
 * a plain model ({role, title, paragraphs}) that GoogleServices writes.
 *
 * Every number comes from ProductionEstimator.estimateProduction. Nothing here
 * counts words or calculates durations, and no script content is included.
 *
 * Paragraph model: { style, kind, text }
 * - style: TITLE | SUBTITLE | HEADING1 | HEADING2 | HEADING3 | NORMAL
 * - kind: heading | provenance | note | fact | warning | table
 *   A "table" entry has text "" and a `table` of {header, rows, numericColumns},
 *   all strings, which GoogleServices writes as a native Docs table.
 */
var Summary = (function () {
  "use strict";

  const ROLE = "PRODUCTION_SUMMARY";
  const SECTION_TYPES = ["ONSET", "MOTION", "SCREENCAST"];

  /**
   * @param {Object} estimate Result of ProductionEstimator.estimateProduction.
   * @param {Object} meta courseTitle, sourceTitle, sourceUrl, generatedAt, runId,
   *     folderName, parser {version, coreSha256}, estimator {version, coreSha256}.
   * @returns {{role: string, title: string, paragraphs: Object[]}}
   */
  function buildSummaryDocument(estimate, meta) {
    const duration = ProductionEstimator.formatDuration;
    const config = estimate.config;
    const threshold = duration(config.longVideoThresholdMinutes * 60);
    const paragraphs = [];
    const add = function (style, kind, text) {
      paragraphs.push({ style: style, kind: kind, text: text });
    };
    const fact = function (text) {
      add("NORMAL", "fact", text);
    };

    add("TITLE", "heading", meta.courseTitle);
    add("SUBTITLE", "heading", "Production Summary: estimated narration time and content statistics");
    add(
      "NORMAL",
      "provenance",
      `Generated ${meta.generatedAt} from the master document "${meta.sourceTitle}" (run ${meta.runId}). Make changes in the master document and generate again. Edits made here are not carried back.`,
    );
    fact(`Source document: ${meta.sourceUrl}`);
    add(
      "NORMAL",
      "note",
      "Word counts and section counts are observed in the script. Durations are estimates calculated from the assumptions below, not predictions of finished video length.",
    );

    add("HEADING1", "heading", "Estimator configuration");
    fact(`Words per minute: ${config.wordsPerMinute}`);
    fact(`Long-video threshold: ${config.longVideoThresholdMinutes} minutes`);
    fact(
      config.screencastAllowanceSecondsPerSection === 0
        ? "Screencast allowance: 0 seconds per SCREENCAST section (narration-only estimate)"
        : `Screencast allowance: ${config.screencastAllowanceSecondsPerSection} seconds per SCREENCAST section`,
    );
    fact(`Estimator version: ${meta.estimator.version} (output schema ${estimate.schemaVersion})`);

    const totals = estimate.totals;
    add("HEADING1", "heading", "Course overview");
    fact(`Stages: ${totals.stageCount}`);
    fact(`Videos: ${totals.videoCount}`);
    fact(`Production sections: ${sectionTotal(totals.sectionCounts)} (${formatSectionCounts(totals.sectionCounts)})`);
    fact(`Spoken words: ${totals.spokenWordCount}`);
    fact(`Estimated narration: ${duration(totals.narrationDurationSeconds)}`);
    fact(`Screencast allowance: ${duration(totals.screencastAllowanceSeconds)}`);
    fact(`Estimated total: ${duration(totals.estimatedDurationSeconds)}`);
    fact(`Videos over the threshold: ${totals.videosOverThreshold}`);

    add("HEADING1", "heading", "Video overview");
    paragraphs.push({ style: "NORMAL", kind: "table", text: "", table: overviewTable(estimate, duration) });

    add("HEADING1", "heading", "Video breakdown");
    estimate.stages.forEach(function (stage) {
      add("HEADING2", "heading", `Stage ${stage.stageNumber}: ${stage.title}`);
      fact(
        `${stage.videoCount} videos, ${stage.spokenWordCount} spoken words, estimated ${duration(stage.estimatedDurationSeconds)}, ${stage.warningCount} over the threshold`,
      );
      estimate.videos
        .filter(function (video) {
          return video.stageNumber === stage.stageNumber;
        })
        .forEach(function (video) {
          addVideo(video, threshold, add, fact);
        });
    });

    add("HEADING1", "heading", "Warnings");
    if (estimate.warnings.length === 0) {
      add("NORMAL", "note", `No video's estimated duration is over the ${threshold} threshold under the current assumptions.`);
    }
    estimate.warnings.forEach(function (warning) {
      add("NORMAL", "warning", `${warning.code}: ${warning.message}`);
    });

    add("HEADING1", "heading", "Estimation methodology");
    estimate.assumptions.forEach(function (assumption) {
      fact(assumption.text);
    });
    fact(
      "Durations are rounded to the nearest second for display. Totals and the threshold check use unrounded values, so a flagged video can display as exactly the threshold, and displayed values may not add up exactly.",
    );

    add("HEADING1", "heading", "Provenance");
    fact(`Run ID: ${meta.runId}`);
    fact(`Generated: ${meta.generatedAt}`);
    fact(`Run folder: ${meta.folderName}`);
    fact(
      "manifest.json in the run folder records the source document and the hash of its text, the parser and estimator versions and hashes, this configuration, the totals, and the warnings.",
    );
    fact(`Parser version: ${meta.parser.version} (core SHA-256 ${meta.parser.coreSha256})`);
    fact(`Estimator version: ${meta.estimator.version} (core SHA-256 ${meta.estimator.coreSha256})`);

    return {
      role: ROLE,
      title: `Production Summary — ${meta.courseTitle} — ${meta.runId}`,
      paragraphs: paragraphs,
    };
  }

  function addVideo(video, threshold, add, fact) {
    const duration = ProductionEstimator.formatDuration;
    add("HEADING3", "heading", `Video ${video.videoNumber}: ${video.title}`);
    fact(`Sections: ${video.sectionSequence.length > 0 ? video.sectionSequence.join(" → ") : "none"}`);
    fact(`Section counts: ${formatSectionCounts(video.sectionCounts)}`);
    fact(`Spoken words: ${video.spokenWordCount}${technicalNote(video.technicalTokenCount)}`);
    fact(`Narration: ${duration(video.narrationDurationSeconds)}`);
    fact(`Screencast allowance: ${duration(video.screencastAllowanceSeconds)}`);
    fact(`Estimated total: ${duration(video.estimatedDurationSeconds)}`);
    if (video.warnings.length > 0) {
      add("NORMAL", "warning", `Status: OVER the ${threshold} threshold (${video.warnings[0].code})`);
    } else {
      fact(`Status: within the ${threshold} threshold`);
    }
  }

  function technicalNote(count) {
    if (count === 0) {
      return "";
    }
    const noun = count === 1 ? "token" : "tokens";
    return ` (includes ${count} URL, path, or code ${noun} that may take longer to narrate)`;
  }

  // One row per video, in document order. GoogleServices writes it as a native
  // Docs table, whose cells wrap, so long titles are never cut off.
  function overviewTable(estimate, duration) {
    return {
      header: ["Video", "Spoken words", "Estimated duration", "Status"],
      numericColumns: [1, 2],
      rows: estimate.videos.map(function (video) {
        return [
          `S${video.stageNumber} V${video.videoNumber} — ${video.title}`,
          String(video.spokenWordCount),
          duration(video.estimatedDurationSeconds),
          video.warnings.length > 0 ? "Over" : "Within",
        ];
      }),
    };
  }

  function sectionTotal(counts) {
    return SECTION_TYPES.reduce(function (sum, type) {
      return sum + counts[type];
    }, 0);
  }

  function formatSectionCounts(counts) {
    return SECTION_TYPES.map(function (type) {
      return `${type} ${counts[type]}`;
    }).join(", ");
  }

  /**
   * @param {Object} estimate Result of ProductionEstimator.estimateProduction.
   * @returns {string[]} Lines for the execution log.
   */
  function formatLogLines(estimate) {
    const duration = ProductionEstimator.formatDuration;
    const c = estimate.config;
    const lines = [
      `Estimator configuration: ${c.wordsPerMinute} words per minute, long-video threshold ${c.longVideoThresholdMinutes} minutes, screencast allowance ${c.screencastAllowanceSecondsPerSection} seconds per SCREENCAST section.`,
    ];
    estimate.videos.forEach(function (v) {
      lines.push(
        `Stage ${v.stageNumber}, Video ${v.videoNumber} "${v.title}": ${v.spokenWordCount} spoken words, estimated ${duration(v.estimatedDurationSeconds)}`,
      );
    });
    const t = estimate.totals;
    lines.push(
      `Course estimate: ${t.spokenWordCount} spoken words, ${duration(t.estimatedDurationSeconds)} across ${t.videoCount} videos.`,
    );
    estimate.warnings.forEach(function (w) {
      lines.push(`WARNING ${w.code}: ${w.message}`);
    });
    return lines;
  }

  return {
    ROLE: ROLE,
    buildSummaryDocument: buildSummaryDocument,
    formatLogLines: formatLogLines,
  };
})();
