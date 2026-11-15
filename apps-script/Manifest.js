/**
 * Run naming and the generation manifest (manifest.json in each run folder).
 *
 * The manifest records provenance: which source document, extracted text, and
 * parser produced which outputs. It never contains document content.
 */
var Manifest = (function () {
  "use strict";

  const SCHEMA_VERSION = 1;
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
   *     issues, error (string or null).
   * @returns {Object} The manifest, ready for JSON.stringify.
   */
  function buildManifest(input) {
    const folder = input.folder;
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
