/**
 * Run naming and the generation manifest (manifest.json in each run folder).
 *
 * The manifest records provenance: which source document, extracted text, and
 * parser produced which outputs. It never contains document content.
 */
var Manifest = (function () {
  "use strict";

  // 2: added estimator, estimate, and the PRODUCTION_SUMMARY output (Phase 4).
  const SCHEMA_VERSION = 2;
  const FOLDER_PREFIX = "Digital Cellar Production";

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  /** "Digital Cellar Production — 2026-11-13 231605 UTC — a1b2c3d4" */
  function formatFolderName(date, runId) {
    const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    const time = `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
    return `${FOLDER_PREFIX} — ${day} ${time} UTC — ${runId}`;
  }

  /** Converts a digest byte array (Apps Script returns signed bytes) to hex. */
  function bytesToHex(bytes) {
    return Array.prototype.map
      .call(bytes, function (byte) {
        return ((byte + 256) % 256).toString(16).padStart(2, "0");
      })
      .join("");
  }

  /**
   * @param {Object} input status, runId, generatedAt (Date), source, sourceSha256,
   *     lineCount, parser, folder (or null), documents, counts, structure,
   *     issues, estimator ({version, coreSha256}), estimate (the result of
   *     ProductionEstimator.estimateProduction), error (string or null).
   * @returns {Object} The manifest, ready for JSON.stringify.
   */
  function buildManifest(input) {
    const folder = input.folder;
    const estimate = input.estimate;
    return {
      schemaVersion: SCHEMA_VERSION,
      status: input.status,
      runId: input.runId,
      generatedAt: input.generatedAt.toISOString(),
      source: {
        documentId: input.source.documentId,
        documentUrl: input.source.url,
        documentTitle: input.source.title,
        lastUpdated: input.source.lastUpdated,
        extractedTextSha256: input.sourceSha256,
        extractedLineCount: input.lineCount,
      },
      parser: { version: input.parser.version, coreSha256: input.parser.coreSha256 },
      estimator: {
        schemaVersion: estimate.schemaVersion,
        version: input.estimator.version,
        coreSha256: input.estimator.coreSha256,
        config: estimate.config,
      },
      output: {
        folderId: folder ? folder.id : null,
        folderUrl: folder ? folder.url : null,
        folderName: folder ? folder.name : null,
        documents: input.documents.map(function (d) {
          return { role: d.role, id: d.id, title: d.title, url: d.url, status: d.status };
        }),
      },
      counts: input.counts,
      structureCheck: { checked: input.structure.checked, matches: input.structure.matches },
      // Only warnings: a run with errors never gets this far.
      warnings: input.issues
        .filter(function (i) {
          return i.severity === "warning";
        })
        .map(function (i) {
          return { source: i.source, code: i.code, line: i.line, message: i.message };
        }),
      // Numbers only. Assumption text and warning messages are in the
      // Production Summary document.
      estimate: {
        totals: estimate.totals,
        videos: estimate.videos.map(function (v) {
          return {
            stageNumber: v.stageNumber,
            videoNumber: v.videoNumber,
            title: v.title,
            spokenWordCount: v.spokenWordCount,
            technicalTokenCount: v.technicalTokenCount,
            narrationDurationSeconds: v.narrationDurationSeconds,
            screencastAllowanceSeconds: v.screencastAllowanceSeconds,
            estimatedDurationSeconds: v.estimatedDurationSeconds,
          };
        }),
        warnings: estimate.warnings.map(function (w) {
          return {
            code: w.code,
            stageNumber: w.stageNumber,
            videoNumber: w.videoNumber,
            title: w.title,
            estimatedDurationSeconds: w.estimatedDurationSeconds,
            thresholdSeconds: w.thresholdSeconds,
            includesScreencastAllowance: w.includesScreencastAllowance,
          };
        }),
      },
      error: input.error,
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    formatFolderName: formatFolderName,
    bytesToHex: bytesToHex,
    buildManifest: buildManifest,
  };
})();
