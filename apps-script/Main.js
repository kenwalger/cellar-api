/**
 * Manual entry points. Run them from the Apps Script editor (select the
 * function, then Run). Results appear in the execution log.
 *
 * There are no triggers: nothing runs automatically. Helper functions end in
 * an underscore, which hides them from the editor's Run menu.
 */

/**
 * Reads and validates the master document, then logs counts, the structure
 * check, and every diagnostic. Makes no Drive or Docs writes.
 *
 * @returns {boolean} True if generation could proceed.
 */
function validateMasterDocument() {
  const config = loadConfig_();
  const prepared = readAndValidate_(config);
  logLines_(Validation.formatReport(prepared.source, prepared.run));
  return prepared.run.canGenerate;
}

/**
 * Validates the master document and, only if there are no errors, creates a
 * new run folder with the ONSET, MOTION, and SCREENCAST documents and a
 * manifest. Earlier runs are never changed.
 */
function generateProductionDocuments() {
  const config = loadConfig_();
  const prepared = readAndValidate_(config);
  logLines_(Validation.formatReport(prepared.source, prepared.run));
  if (!prepared.run.canGenerate) {
    throw new Error("Generation blocked by the errors listed above. No files were created.");
  }

  // Check everything we can before the first write.
  GoogleServices.checkOutputFolder(config.outputFolderId);
  const source = {
    documentId: prepared.source.documentId,
    url: prepared.source.url,
    title: prepared.source.title,
    lastUpdated: GoogleServices.lastUpdated(prepared.source.documentId),
  };

  let result;
  try {
    result = Generator.generate(GoogleServices, {
      source: source,
      extraction: prepared.extraction,
      run: prepared.run,
      outputFolderId: config.outputFolderId,
      parser: { version: GeneratedData.parserVersion, coreSha256: GeneratedData.parserCoreSha256 },
    });
  } catch (error) {
    if (error.result) {
      logFailure_(error.result);
    }
    throw error;
  }

  logLines_([
    `COMPLETE: run ${result.runId}`,
    `Output folder: ${result.folder.url}`,
  ]);
  logLines_(
    result.documents.map(function (d) {
      return `${d.role}: ${d.url}`;
    }),
  );
  logLines_([`Manifest: ${result.manifestFile.url}`]);
}

function loadConfig_() {
  const result = Config.readConfig(PropertiesService.getScriptProperties().getProperties());
  if (result.errors.length > 0) {
    throw new Error(`Configuration problem:\n- ${result.errors.join("\n- ")}`);
  }
  return result.config;
}

function readAndValidate_(config) {
  const source = GoogleServices.readMasterDocument(config.masterDocumentId);
  const extraction = DocumentReader.readBody(source.body, { tabCount: source.tabCount });
  const run = Validation.prepareRun(extraction, {
    requireExpectedStructure: config.requireExpectedStructure,
    expectedStructure: GeneratedData.expectedStructure,
  });
  return { source: source, extraction: extraction, run: run };
}

function logFailure_(result) {
  const lines = [`FAILED: run ${result.runId}. Nothing was deleted.`];
  if (result.folder) {
    lines.push(`Partial output folder (renamed with "FAILED"): ${result.folder.url}`);
  }
  result.documents.forEach(function (d) {
    lines.push(`${d.role} (${d.status}): ${d.url}`);
  });
  if (result.manifestFile) {
    lines.push(`Failure manifest: ${result.manifestFile.url}`);
  }
  if (result.manifestWriteError) {
    lines.push(`The failure manifest couldn't be written: ${result.manifestWriteError}`);
  }
  if (result.folderRenameError) {
    lines.push(`The folder couldn't be renamed: ${result.folderRenameError}`);
  }
  logLines_(lines);
}

function logLines_(lines) {
  lines.forEach(function (line) {
    Logger.log(line);
  });
}
