/**
 * Parses extracted text with the portable parser and decides whether a run can
 * generate documents. Also projects the parsed structure for comparison with
 * the expected course outline, and formats a report for the execution log.
 *
 * Depends on ProductionScript (ProductionScript.js) at call time.
 */
var Validation = (function () {
  "use strict";

  const SECTION_TYPES = ["ONSET", "MOTION", "SCREENCAST"];
  const EXCERPT_LENGTH = 60;

  /**
   * @param {Object} extraction Result of DocumentReader.readBody.
   * @param {{requireExpectedStructure: boolean, expectedStructure: Object}} options
   * @returns {Object} parse, issues, structure, counts, errorCount, warningCount,
   *     lineCount, structureRequired, and canGenerate.
   */
  function prepareRun(extraction, options) {
    const requireExpectedStructure = Boolean(options && options.requireExpectedStructure);
    const parse = ProductionScript.parseProductionScript(extraction.text);
    const textLines = extraction.text.split("\n");
    const issues = [];

    extraction.diagnostics.forEach(function (d) {
      issues.push(issue("extraction", d.code, d.severity, null, d.element, null, null, d.message));
    });

    parse.diagnostics.forEach(function (d) {
      const location = d.line === null ? null : extraction.lines[d.line - 1];
      const excerpt = d.line === null ? null : excerptOf(textLines[d.line - 1]);
      issues.push(
        issue(
          "parser",
          d.code,
          d.severity,
          d.line,
          location ? location.element : null,
          location ? location.partInElement : null,
          excerpt,
          d.message,
        ),
      );
    });

    // Compare structure only when the parse succeeded; a partial document
    // would add misleading differences on top of the real errors.
    let structure = { checked: false, matches: null, differences: [] };
    const parserFailed = parse.diagnostics.some(isError);
    if (requireExpectedStructure && !parserFailed) {
      if (!options.expectedStructure) {
        throw new Error("prepareRun: expectedStructure is required when requireExpectedStructure is true.");
      }
      const differences = compareStructure(options.expectedStructure, projectStructure(parse.document));
      structure = { checked: true, matches: differences.length === 0, differences: differences };
      differences.forEach(function (difference) {
        issues.push(
          issue(
            "structure",
            "STRUCTURE_MISMATCH",
            "error",
            null,
            null,
            null,
            null,
            `Doesn't match the expected course outline: ${difference}`,
          ),
        );
      });
    }

    const errorCount = issues.filter(isError).length;
    return {
      parse: parse,
      issues: issues,
      structure: structure,
      structureRequired: requireExpectedStructure,
      counts: countStructure(parse.document),
      lineCount: extraction.lines.length,
      errorCount: errorCount,
      warningCount: issues.length - errorCount,
      canGenerate: errorCount === 0,
    };
  }

  function issue(source, code, severity, line, element, partInElement, excerpt, message) {
    return {
      source: source,
      code: code,
      severity: severity,
      line: line,
      element: element,
      partInElement: partInElement,
      excerpt: excerpt,
      message: message,
    };
  }

  function isError(d) {
    return d.severity === "error";
  }

  function excerptOf(text) {
    const trimmed = String(text).trim();
    return trimmed.length > EXCERPT_LENGTH ? `${trimmed.slice(0, EXCERPT_LENGTH)}...` : trimmed;
  }

  // ---------------------------------------------------------------------------
  // Structure
  // ---------------------------------------------------------------------------

  /** Same shape as course/fixtures/expected-structure.json. */
  function projectStructure(document) {
    return {
      stages: document.stages.map(function (stage) {
        return {
          number: stage.number,
          title: stage.title,
          videos: stage.videos.map(function (video) {
            return {
              number: video.number,
              title: video.title,
              sections: video.sections.map(function (section) {
                return section.type;
              }),
            };
          }),
        };
      }),
    };
  }

  /** @returns {string[]} One message per difference, in document order. */
  function compareStructure(expected, actual) {
    const differences = [];
    compareValue(expected, actual, "", differences);
    return differences;
  }

  function compareValue(expected, actual, path, differences) {
    if (Array.isArray(expected) && Array.isArray(actual)) {
      if (expected.every(isPrimitive) && actual.every(isPrimitive)) {
        if (!sameList(expected, actual)) {
          differences.push(`${path}: expected [${expected.join(", ")}], found [${actual.join(", ")}]`);
        }
        return;
      }
      if (expected.length !== actual.length) {
        differences.push(`${path}: expected ${expected.length} items, found ${actual.length}`);
      }
      const shared = Math.min(expected.length, actual.length);
      for (let index = 0; index < shared; index++) {
        compareValue(expected[index], actual[index], `${path}[${index}]`, differences);
      }
      return;
    }
    if (isObject(expected) && isObject(actual)) {
      const keys = Object.keys(expected);
      Object.keys(actual).forEach(function (key) {
        if (keys.indexOf(key) === -1) {
          keys.push(key);
        }
      });
      keys.forEach(function (key) {
        compareValue(expected[key], actual[key], path ? `${path}.${key}` : key, differences);
      });
      return;
    }
    if (expected !== actual) {
      differences.push(`${path}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
    }
  }

  function isPrimitive(value) {
    return value === null || typeof value !== "object";
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function sameList(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let index = 0; index < a.length; index++) {
      if (a[index] !== b[index]) {
        return false;
      }
    }
    return true;
  }

  function countStructure(document) {
    const sections = { ONSET: 0, MOTION: 0, SCREENCAST: 0, total: 0 };
    let videos = 0;
    document.stages.forEach(function (stage) {
      videos += stage.videos.length;
      stage.videos.forEach(function (video) {
        video.sections.forEach(function (section) {
          sections[section.type] += 1;
          sections.total += 1;
        });
      });
    });
    return { stages: document.stages.length, videos: videos, sections: sections };
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------

  /**
   * @param {{title: string, url: string}} source
   * @param {Object} run Result of prepareRun.
   * @returns {string[]} Lines for the execution log.
   */
  function formatReport(source, run) {
    const c = run.counts;
    const report = [
      `Master document: "${source.title}" ${source.url}`,
      `Read ${run.lineCount} lines.`,
      `Stages: ${c.stages}, videos: ${c.videos}, sections: ${c.sections.total} (${SECTION_TYPES.map(function (type) {
        return `${type} ${c.sections[type]}`;
      }).join(", ")})`,
      structureLine(run),
    ];

    run.issues.forEach(function (i) {
      report.push(formatIssue(i));
    });

    if (run.canGenerate) {
      report.push(
        `READY: no errors${run.warningCount > 0 ? `, ${run.warningCount} warning(s)` : ""}. generateProductionDocuments() can run.`,
      );
    } else {
      report.push(
        `BLOCKED: ${run.errorCount} error(s). Fix them in the master document. No files will be created until they're fixed.`,
      );
    }
    return report;
  }

  function structureLine(run) {
    if (run.structure.checked) {
      return run.structure.matches
        ? "Structure check: matches the expected structure (course/fixtures/expected-structure.json)."
        : "Structure check: does NOT match the expected structure. The differences are listed below.";
    }
    if (!run.structureRequired) {
      return "Structure check: skipped (REQUIRE_EXPECTED_STRUCTURE is false).";
    }
    return "Structure check: skipped because of the parser errors below.";
  }

  // "ERROR CODE at line 3 (document paragraph 3): "[ONSET]" — message"
  function formatIssue(i) {
    const label = `${i.severity.toUpperCase()} ${i.code}`;
    if (i.line !== null) {
      const part = i.partInElement > 1 ? `, line ${i.partInElement} within it` : "";
      return `${label} at line ${i.line} (document paragraph ${i.element}${part}): "${i.excerpt}" — ${i.message}`;
    }
    if (i.element !== null) {
      return `${label} at document element ${i.element}: ${i.message}`;
    }
    return `${label}: ${i.message}`;
  }

  return {
    prepareRun: prepareRun,
    projectStructure: projectStructure,
    compareStructure: compareStructure,
    countStructure: countStructure,
    formatReport: formatReport,
  };
})();
