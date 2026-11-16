/**
 * Reads the project configuration from Script Properties.
 *
 * Properties (Project Settings > Script properties):
 * - MASTER_DOCUMENT_ID (required): the master Google Doc's ID or full URL.
 * - OUTPUT_FOLDER_ID (optional): Drive folder ID or URL for run folders. Default: My Drive.
 * - REQUIRE_EXPECTED_STRUCTURE (optional): "true" (default) or "false". When true,
 *   the document must match the course outline in GeneratedData.expectedStructure.
 * - WORDS_PER_MINUTE (optional, default 140), LONG_VIDEO_THRESHOLD_MINUTES
 *   (optional, default 3), and SCREENCAST_ALLOWANCE_SECONDS_PER_SECTION
 *   (optional, default 0): Production Summary estimator settings, as plain
 *   decimal numbers such as 150 or 2.5.
 *
 * None of these values is secret.
 */
var Config = (function () {
  "use strict";

  const ID_PATTERN = /^[A-Za-z0-9_-]{20,}$/;
  const DOCUMENT_URL_PATTERN = /\/document\/d\/([A-Za-z0-9_-]+)/;
  const FOLDER_URL_PATTERN = /\/folders\/([A-Za-z0-9_-]+)/;
  // Plain decimals only: no exponents, hex, units, or "Infinity".
  const DECIMAL_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
  // Script Property name → estimator option name.
  const ESTIMATE_PROPERTIES = {
    WORDS_PER_MINUTE: "wordsPerMinute",
    LONG_VIDEO_THRESHOLD_MINUTES: "longVideoThresholdMinutes",
    SCREENCAST_ALLOWANCE_SECONDS_PER_SECTION: "screencastAllowanceSecondsPerSection",
  };

  function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === "";
  }

  // Accepts a bare ID or a URL that contains one.
  function extractId(value, urlPattern) {
    const trimmed = String(value).trim();
    const match = urlPattern.exec(trimmed);
    return match ? match[1] : trimmed;
  }

  /**
   * @param {Object<string, string>} properties Script Properties as a plain object.
   * @returns {{config: ?Object, errors: string[]}} config is null if there are errors.
   */
  function readConfig(properties) {
    const errors = [];

    let masterDocumentId = null;
    if (isBlank(properties.MASTER_DOCUMENT_ID)) {
      errors.push(
        "MASTER_DOCUMENT_ID is not set. Add it under Project Settings > Script properties, with the master Google Doc's ID or URL as its value.",
      );
    } else {
      masterDocumentId = extractId(properties.MASTER_DOCUMENT_ID, DOCUMENT_URL_PATTERN);
      if (!ID_PATTERN.test(masterDocumentId)) {
        errors.push(`MASTER_DOCUMENT_ID doesn't look like a Google Doc ID or URL: "${properties.MASTER_DOCUMENT_ID}".`);
      }
    }

    let outputFolderId = null;
    if (!isBlank(properties.OUTPUT_FOLDER_ID)) {
      outputFolderId = extractId(properties.OUTPUT_FOLDER_ID, FOLDER_URL_PATTERN);
      if (!ID_PATTERN.test(outputFolderId)) {
        errors.push(`OUTPUT_FOLDER_ID doesn't look like a Drive folder ID or URL: "${properties.OUTPUT_FOLDER_ID}".`);
      }
    }

    let requireExpectedStructure = true;
    if (!isBlank(properties.REQUIRE_EXPECTED_STRUCTURE)) {
      const value = String(properties.REQUIRE_EXPECTED_STRUCTURE).trim().toLowerCase();
      if (value === "true" || value === "false") {
        requireExpectedStructure = value === "true";
      } else {
        errors.push(
          `REQUIRE_EXPECTED_STRUCTURE must be "true" or "false", not "${properties.REQUIRE_EXPECTED_STRUCTURE}".`,
        );
      }
    }

    const estimate = readEstimateOptions(properties, errors);

    if (errors.length > 0) {
      return { config: null, errors: errors };
    }
    return {
      config: {
        masterDocumentId: masterDocumentId,
        outputFolderId: outputFolderId,
        requireExpectedStructure: requireExpectedStructure,
        estimate: estimate,
      },
      errors: [],
    };
  }

  // Starts from the estimator's defaults and applies any properties that are
  // set. Range checks come from the estimator itself, so the rules match.
  function readEstimateOptions(properties, errors) {
    const estimate = {};
    Object.keys(ProductionEstimator.DEFAULT_OPTIONS).forEach(function (option) {
      estimate[option] = ProductionEstimator.DEFAULT_OPTIONS[option];
    });
    Object.keys(ESTIMATE_PROPERTIES).forEach(function (property) {
      if (isBlank(properties[property])) {
        return;
      }
      const option = ESTIMATE_PROPERTIES[property];
      const text = String(properties[property]).trim();
      if (!DECIMAL_PATTERN.test(text)) {
        errors.push(`${property} must be a plain decimal number, such as 150 or 2.5, not "${text}".`);
        return;
      }
      const single = {};
      single[option] = Number(text);
      const problems = ProductionEstimator.checkOptions(single);
      if (problems.length > 0) {
        errors.push(`${property}: ${problems.join(" ")}`);
        return;
      }
      estimate[option] = single[option];
    });
    return estimate;
  }

  return { readConfig: readConfig };
})();
