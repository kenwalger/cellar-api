/**
 * Portable production estimator for the Digital Cellar master production script.
 *
 * It reads the parser's intermediate representation (IR), counts spoken words,
 * and estimates narration duration per video. The method, word-count policy,
 * and output are documented in production/README.md.
 *
 * Portability rules for this file (the same as parser/src/production-script.cjs):
 * - It is a classic script, not a module. It defines exactly one global,
 *   ProductionEstimator, so it can be added to Google Apps Script unchanged.
 * - No import/export, require, Node.js APIs, or browser APIs. No clocks or
 *   randomness: the same input always gives the same output.
 * - Node.js loads it through the CommonJS guard at the bottom (see src/index.js).
 */
var ProductionEstimator = (function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const SECTION_TYPES = ["ONSET", "MOTION", "SCREENCAST"];

  // What the grammar (course/README.md) says is spoken in each kind of block.
  const BLOCK_IS_SPOKEN = { VOICEOVER: true, ACTION: false, VISUAL: false, HIGHLIGHT: false };

  const DEFAULT_OPTIONS = Object.freeze({
    wordsPerMinute: 140,
    longVideoThresholdMinutes: 3,
    screencastAllowanceSecondsPerSection: 0,
  });

  const WarningCode = Object.freeze({
    LONG_VIDEO_ESTIMATE: "LONG_VIDEO_ESTIMATE",
  });

  // A token is a word if it has at least one letter or digit, in any script.
  const WORD_PATTERN = /[\p{L}\p{N}]/u;
  // Characters that suggest a URL, path, identifier, or code, whose spoken
  // form is usually longer than one word ("slash api slash v1 ...").
  const TECHNICAL_PATTERN = /[/\\=_{}[\]<>@#]/;

  // ---------------------------------------------------------------------------
  // Word counting
  // ---------------------------------------------------------------------------

  /**
   * Splits text on whitespace and keeps the tokens that count as words.
   *
   * @param {string} text One line of spoken text.
   * @returns {string[]} The counted tokens, in order, exactly as written.
   * @throws {TypeError} If text is not a string.
   */
  function spokenTokens(text) {
    if (typeof text !== "string") {
      throw new TypeError("spokenTokens expects a string.");
    }
    return text.split(/\s+/).filter((token) => WORD_PATTERN.test(token));
  }

  /** @returns {number} The number of words in text, under the word-count policy. */
  function countWords(text) {
    return spokenTokens(text).length;
  }

  /** @returns {boolean} True if a counted token looks like a URL, path, or code. */
  function isTechnicalToken(token) {
    return TECHNICAL_PATTERN.test(token);
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  const OPTION_RULES = {
    wordsPerMinute: { allowZero: false, description: "a finite number greater than 0" },
    longVideoThresholdMinutes: { allowZero: false, description: "a finite number greater than 0" },
    screencastAllowanceSecondsPerSection: { allowZero: true, description: "a finite number of 0 or more" },
  };

  /**
   * Checks estimator options. Omitted fields use their defaults; unknown
   * fields are rejected, so a misspelled option can't be silently ignored.
   *
   * @param {Object|undefined} options
   * @returns {string[]} One message per problem. Empty if the options are valid.
   */
  function checkOptions(options) {
    if (options === undefined) {
      return [];
    }
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
      return ["Options must be an object, such as { wordsPerMinute: 140 }."];
    }
    const errors = [];
    Object.keys(options).forEach((name) => {
      const rule = OPTION_RULES[name];
      if (!rule) {
        errors.push(`Unknown option "${name}". Known options: ${Object.keys(OPTION_RULES).join(", ")}.`);
        return;
      }
      const value = options[name];
      const valid =
        typeof value === "number" && Number.isFinite(value) && (rule.allowZero ? value >= 0 : value > 0);
      if (!valid) {
        errors.push(`${name} must be ${rule.description}, not ${describeValue(value)}.`);
      }
    });
    return errors;
  }

  function describeValue(value) {
    return typeof value === "string" ? `the string "${value}"` : String(value);
  }

  function resolveOptions(options) {
    const errors = checkOptions(options);
    if (errors.length > 0) {
      throw new RangeError(`Invalid estimator configuration: ${errors.join(" ")}`);
    }
    const given = options || {};
    const config = {};
    Object.keys(DEFAULT_OPTIONS).forEach((name) => {
      config[name] = given[name] === undefined ? DEFAULT_OPTIONS[name] : given[name];
    });
    return config;
  }

  // ---------------------------------------------------------------------------
  // Estimation
  // ---------------------------------------------------------------------------

  /**
   * Estimates narration time for every video in a parsed document.
   *
   * Only pass a document whose parse had no error diagnostics. The estimator
   * doesn't reparse or validate the script. It refuses (throws) when the IR
   * has an unclosed section or content whose spoken status it can't tell.
   *
   * @param {Object} document The parser's document IR. It is not modified.
   * @param {Object} [options] wordsPerMinute, longVideoThresholdMinutes,
   *     screencastAllowanceSecondsPerSection. See DEFAULT_OPTIONS.
   * @returns {Object} schemaVersion, config, stages, videos, totals, warnings, assumptions.
   * @throws {TypeError} If document isn't a parser document.
   * @throws {RangeError} If the options are invalid.
   * @throws {Error} If the document can't be estimated reliably.
   */
  function estimateProduction(document, options) {
    if (document === null || typeof document !== "object" || !Array.isArray(document.stages)) {
      throw new TypeError("estimateProduction expects the parser's document, with a stages array.");
    }
    const config = resolveOptions(options);
    const thresholdSeconds = config.longVideoThresholdMinutes * 60;

    const videos = [];
    const stages = document.stages.map((stage) => {
      const stageVideos = stage.videos.map((video) => estimateVideo(stage, video, config, thresholdSeconds));
      stageVideos.forEach((video) => videos.push(video));
      const summary = sumVideos(stageVideos);
      return {
        stageNumber: stage.number,
        title: stage.title,
        videoCount: stageVideos.length,
        sectionCounts: summary.sectionCounts,
        spokenWordCount: summary.spokenWordCount,
        technicalTokenCount: summary.technicalTokenCount,
        narrationDurationSeconds: summary.narrationDurationSeconds,
        screencastAllowanceSeconds: summary.screencastAllowanceSeconds,
        estimatedDurationSeconds: summary.estimatedDurationSeconds,
        warningCount: summary.warningCount,
      };
    });

    const all = sumVideos(videos);
    const warnings = [];
    videos.forEach((video) => video.warnings.forEach((warning) => warnings.push(warning)));

    return {
      schemaVersion: SCHEMA_VERSION,
      config: config,
      stages: stages,
      videos: videos,
      totals: {
        stageCount: stages.length,
        videoCount: videos.length,
        sectionCounts: all.sectionCounts,
        spokenWordCount: all.spokenWordCount,
        technicalTokenCount: all.technicalTokenCount,
        narrationDurationSeconds: all.narrationDurationSeconds,
        screencastAllowanceSeconds: all.screencastAllowanceSeconds,
        estimatedDurationSeconds: all.estimatedDurationSeconds,
        videosOverThreshold: all.warningCount,
      },
      warnings: warnings,
      assumptions: assumptionsFor(config),
    };
  }

  function estimateVideo(stage, video, config, thresholdSeconds) {
    const sectionCounts = emptySectionCounts();
    let spokenWordCount = 0;
    let technicalTokenCount = 0;

    video.sections.forEach((section) => {
      checkSection(stage, video, section);
      sectionCounts[section.type] += 1;
      spokenLines(stage, video, section).forEach((text) => {
        const tokens = spokenTokens(text);
        spokenWordCount += tokens.length;
        technicalTokenCount += tokens.filter(isTechnicalToken).length;
      });
    });

    // Multiply before dividing, so exact values (such as 420 words at 140 WPM)
    // come out exact and the threshold comparison isn't thrown off.
    const narrationDurationSeconds = (spokenWordCount * 60) / config.wordsPerMinute;
    const screencastAllowanceSeconds = sectionCounts.SCREENCAST * config.screencastAllowanceSecondsPerSection;
    const estimatedDurationSeconds = narrationDurationSeconds + screencastAllowanceSeconds;

    const warnings = [];
    if (estimatedDurationSeconds > thresholdSeconds) {
      warnings.push(
        longVideoWarning(stage, video, estimatedDurationSeconds, thresholdSeconds, screencastAllowanceSeconds > 0),
      );
    }

    return {
      stageNumber: stage.number,
      videoNumber: video.number,
      title: video.title,
      sectionSequence: video.sections.map((section) => section.type),
      sectionCounts: sectionCounts,
      spokenWordCount: spokenWordCount,
      technicalTokenCount: technicalTokenCount,
      narrationDurationSeconds: narrationDurationSeconds,
      screencastAllowanceSeconds: screencastAllowanceSeconds,
      estimatedDurationSeconds: estimatedDurationSeconds,
      warnings: warnings,
    };
  }

  function longVideoWarning(stage, video, estimatedDurationSeconds, thresholdSeconds, includesScreencastAllowance) {
    const basis = includesScreencastAllowance ? "includes a screencast allowance" : "narration only";
    return {
      code: WarningCode.LONG_VIDEO_ESTIMATE,
      stageNumber: stage.number,
      videoNumber: video.number,
      title: video.title,
      estimatedDurationSeconds: estimatedDurationSeconds,
      thresholdSeconds: thresholdSeconds,
      includesScreencastAllowance: includesScreencastAllowance,
      message: `Stage ${stage.number}, Video ${video.number} "${video.title}": estimated ${formatDuration(estimatedDurationSeconds)} is over the ${formatDuration(thresholdSeconds)} threshold (${basis}).`,
    };
  }

  // Returns the text of every spoken line in a section, as the grammar defines
  // it: all ONSET text, and the text of VOICEOVER blocks. Cues have no words.
  function spokenLines(stage, video, section) {
    const texts = [];
    section.content.forEach((item) => {
      if (section.type === "ONSET") {
        collectEntry(stage, video, section, item, texts);
        return;
      }
      if (item.kind !== "block" || !Object.prototype.hasOwnProperty.call(BLOCK_IS_SPOKEN, item.type)) {
        throw unknownContent(stage, video, section, item);
      }
      const spoken = BLOCK_IS_SPOKEN[item.type];
      item.content.forEach((entry) => {
        collectEntry(stage, video, section, entry, spoken ? texts : null);
      });
    });
    return texts;
  }

  // Adds a text entry to texts (null means not spoken); cues add nothing.
  function collectEntry(stage, video, section, entry, texts) {
    if (entry.kind === "text" && typeof entry.text === "string") {
      if (texts !== null) {
        texts.push(entry.text);
      }
      return;
    }
    if (entry.kind === "cue") {
      return;
    }
    throw unknownContent(stage, video, section, entry);
  }

  function checkSection(stage, video, section) {
    const where = `Stage ${stage.number}, Video ${video.number}`;
    if (SECTION_TYPES.indexOf(section.type) === -1) {
      throw new Error(`Can't estimate ${where}: unknown section type "${section.type}".`);
    }
    if (section.endLine === null) {
      throw new Error(
        `Can't estimate ${where}: the ${section.type} section on line ${section.sourceLine} was not closed. Estimate only documents with no parser errors.`,
      );
    }
  }

  function unknownContent(stage, video, section, item) {
    const label = item.kind === "block" ? `block type "${item.type}"` : `content kind "${item.kind}"`;
    return new Error(
      `Can't estimate Stage ${stage.number}, Video ${video.number}: the ${section.type} section on line ${section.sourceLine} has ${label}, and it isn't known whether it's spoken.`,
    );
  }

  function emptySectionCounts() {
    return { ONSET: 0, MOTION: 0, SCREENCAST: 0 };
  }

  // Adds video values in document order, so totals are exact sums of the
  // values shown for each video.
  function sumVideos(videos) {
    const total = {
      sectionCounts: emptySectionCounts(),
      spokenWordCount: 0,
      technicalTokenCount: 0,
      narrationDurationSeconds: 0,
      screencastAllowanceSeconds: 0,
      estimatedDurationSeconds: 0,
      warningCount: 0,
    };
    videos.forEach((video) => {
      SECTION_TYPES.forEach((type) => {
        total.sectionCounts[type] += video.sectionCounts[type];
      });
      total.spokenWordCount += video.spokenWordCount;
      total.technicalTokenCount += video.technicalTokenCount;
      total.narrationDurationSeconds += video.narrationDurationSeconds;
      total.screencastAllowanceSeconds += video.screencastAllowanceSeconds;
      total.estimatedDurationSeconds += video.estimatedDurationSeconds;
      total.warningCount += video.warnings.length;
    });
    return total;
  }

  function assumptionsFor(config) {
    const allowance =
      config.screencastAllowanceSecondsPerSection === 0
        ? "No screencast allowance is added (0 seconds per SCREENCAST section), so this is a narration-only estimate. That isn't a claim that screen actions take no time; no evidence-based figure has been set."
        : `Each SCREENCAST section adds a fixed, configured allowance of ${config.screencastAllowanceSecondsPerSection} seconds for on-screen actions. It is an assumption, not a measurement.`;
    return [
      {
        code: "NARRATION_ONLY",
        text: "Only spoken words are counted: ONSET narration and VOICEOVER blocks. ACTION, VISUAL, and HIGHLIGHT directions, PAUSE cues, headings, and tags are not.",
      },
      {
        code: "SPEAKING_RATE",
        text: `Narration is assumed to be spoken at ${config.wordsPerMinute} words per minute. Narration seconds = spoken words / words per minute x 60.`,
      },
      { code: "SCREENCAST_ALLOWANCE", text: allowance },
      {
        code: "THRESHOLD_RULE",
        text: `A video is flagged when its estimated duration is greater than ${config.longVideoThresholdMinutes} minutes. A video exactly at the threshold is not flagged.`,
      },
      {
        code: "WORD_COUNT_POLICY",
        text: "A word is a whitespace-separated token with at least one letter or digit. Contractions, hyphenated terms, numbers, and URLs or code in narration each count as one word, as written.",
      },
      {
        code: "UNMODELED_FACTORS",
        text: "The estimate isn't a prediction of finished video length. It leaves out presenter pacing, retakes, pauses (which have no assigned duration), screen transitions, unscripted demonstrations, editing, animation timing, and production labor.",
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Display
  // ---------------------------------------------------------------------------

  /**
   * Formats seconds for people, rounded to the nearest whole second (halves
   * round up): 285.43 → "4 min 45 s". Calculations never use rounded values.
   */
  function formatDuration(seconds) {
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
      throw new TypeError("formatDuration expects a finite number of seconds, 0 or more.");
    }
    const whole = Math.round(seconds);
    return `${Math.floor(whole / 60)} min ${whole % 60} s`;
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    DEFAULT_OPTIONS: DEFAULT_OPTIONS,
    WarningCode: WarningCode,
    spokenTokens: spokenTokens,
    countWords: countWords,
    isTechnicalToken: isTechnicalToken,
    checkOptions: checkOptions,
    estimateProduction: estimateProduction,
    formatDuration: formatDuration,
  };
})();

// Node.js (CommonJS) export. Google Apps Script has no `module`, so it skips this.
if (typeof module === "object" && module.exports) {
  module.exports = ProductionEstimator;
}
