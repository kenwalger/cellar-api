/**
 * Orchestrates one generation run: a new folder, three role documents, and a
 * manifest. All Drive and Docs access goes through `services` (GoogleServices
 * in Apps Script, a fake in tests), so this logic is testable offline.
 *
 * Every run is independent. It creates a new folder and never reuses,
 * overwrites, or deletes anything from earlier runs.
 */
var Generator = (function () {
  "use strict";

  const MANIFEST_FILE_NAME = "manifest.json";

  /**
   * @param {Object} services now, newRunId, sha256Hex, createFolder,
   *     createDocument, writeDocument, createJsonFile, renameFolder.
   * @param {Object} input source, extraction, run (from Validation.prepareRun),
   *     outputFolderId, parser.
   * @returns {Object} { status: "complete" | "blocked", runId, folder, documents, manifest, manifestFile }
   * @throws {Error} If a Drive or Docs call fails after the run starts. The
   *     error's `result` holds the partial outcome (status "failed").
   */
  function generate(services, input) {
    const run = input.run;
    if (!run.canGenerate) {
      return { status: "blocked", runId: null, folder: null, documents: [], manifest: null, manifestFile: null };
    }

    const runId = services.newRunId();
    const generatedAt = services.now();
    const document = run.parse.document;
    const meta = {
      courseTitle: Render.courseTitle(document, input.source.title),
      sourceTitle: input.source.title,
      generatedAt: generatedAt.toISOString(),
      runId: runId,
    };

    // Build everything that doesn't touch Drive first, so a bug here can't
    // leave a half-created run behind.
    const models = Render.ROLES.map(function (role) {
      return Render.buildRoleDocument(document, role, meta);
    });
    const sourceSha256 = services.sha256Hex(input.extraction.text);
    const state = { folder: null, documents: [] };

    function manifestFor(status, error) {
      return Manifest.buildManifest({
        status: status,
        runId: runId,
        generatedAt: generatedAt,
        source: input.source,
        sourceSha256: sourceSha256,
        lineCount: run.lineCount,
        parser: input.parser,
        folder: state.folder,
        documents: state.documents,
        counts: run.counts,
        structure: run.structure,
        issues: run.issues,
        error: error === null ? null : messageOf(error),
      });
    }

    try {
      state.folder = services.createFolder(Manifest.formatFolderName(generatedAt, runId), input.outputFolderId);
      models.forEach(function (model) {
        const created = services.createDocument(state.folder.id, model.title);
        // Record the document before writing to it, so a failed write still
        // shows up in the failure manifest.
        const entry = { role: model.role, id: created.id, title: created.title, url: created.url, status: "incomplete" };
        state.documents.push(entry);
        services.writeDocument(created.id, model.paragraphs);
        entry.status = "complete";
      });
      const manifest = manifestFor("complete", null);
      const manifestFile = services.createJsonFile(state.folder.id, MANIFEST_FILE_NAME, toJson(manifest));
      return {
        status: "complete",
        runId: runId,
        folder: state.folder,
        documents: state.documents,
        manifest: manifest,
        manifestFile: manifestFile,
      };
    } catch (error) {
      throw failure(services, state, manifestFor("failed", error), error);
    }
  }

  // Records a failed run without deleting anything: writes a "failed" manifest
  // into the run folder (if one was created) and marks the folder name.
  function failure(services, state, manifest, error) {
    const result = {
      status: "failed",
      runId: manifest.runId,
      folder: state.folder,
      documents: state.documents,
      manifest: manifest,
      manifestFile: null,
      manifestWriteError: null,
      folderRenameError: null,
    };
    if (state.folder !== null) {
      try {
        result.manifestFile = services.createJsonFile(state.folder.id, MANIFEST_FILE_NAME, toJson(manifest));
      } catch (writeError) {
        result.manifestWriteError = messageOf(writeError);
      }
      try {
        services.renameFolder(state.folder.id, `${state.folder.name} — FAILED`);
      } catch (renameError) {
        result.folderRenameError = messageOf(renameError);
      }
    }
    const wrapped = new Error(`Generation failed: ${messageOf(error)}`);
    wrapped.result = result;
    return wrapped;
  }

  function messageOf(error) {
    return error && error.message ? error.message : String(error);
  }

  function toJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
  }

  return { MANIFEST_FILE_NAME: MANIFEST_FILE_NAME, generate: generate };
})();
