/**
 * The only file that calls DocumentApp, DriveApp, and Utilities. It implements
 * the `services` interface that Generator uses, plus document reading.
 *
 * Not covered by the Node tests. It's verified by the live checkpoint in
 * apps-script/README.md.
 */
var GoogleServices = (function () {
  "use strict";

  // Text styling per paragraph kind (see Render.js). Headings use the
  // document's built-in heading styles and get no extra styling.
  const KIND_STYLES = {
    narration: { bold: false, italic: false, color: "#000000" },
    instruction: { bold: false, italic: true, color: "#555555" },
    label: { bold: true, italic: false, color: "#1F4E79" },
    // Cues get the same small space before and after, instead of blank lines.
    cue: { bold: true, italic: false, color: "#9C2A00", spaceBefore: 6, spaceAfter: 6 },
    // SCREENCAST technical examples: monospaced, upright, and indented.
    example: { bold: false, italic: false, color: "#202124", font: "Courier New", indent: 18 },
    provenance: { bold: false, italic: true, color: "#666666" },
    note: { bold: false, italic: true, color: "#666666" },
    // Production Summary (see Summary.js). "fact" paragraphs use the default style.
    warning: { bold: true, italic: false, color: "#9C2A00" },
  };

  /** Opens the master document. Read-only: makes no Drive or Docs writes. */
  function readMasterDocument(documentId) {
    const doc = DocumentApp.openById(documentId);
    const tabCount = typeof doc.getTabs === "function" ? doc.getTabs().length : 1;
    return {
      documentId: documentId,
      title: doc.getName(),
      url: doc.getUrl(),
      body: doc.getBody(),
      tabCount: tabCount,
    };
  }

  function lastUpdated(documentId) {
    return DriveApp.getFileById(documentId).getLastUpdated().toISOString();
  }

  /** Throws now, before any writes, if the output folder can't be opened. */
  function checkOutputFolder(folderId) {
    if (folderId) {
      DriveApp.getFolderById(folderId).getName();
    }
  }

  function now() {
    return new Date();
  }

  function newRunId() {
    return Utilities.getUuid().replace(/-/g, "").slice(0, 8);
  }

  function sha256Hex(text) {
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
    return Manifest.bytesToHex(digest);
  }

  function createFolder(name, parentId) {
    const parent = parentId ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder();
    const folder = parent.createFolder(name);
    return { id: folder.getId(), url: folder.getUrl(), name: name };
  }

  function createDocument(folderId, title) {
    const doc = DocumentApp.create(title);
    const id = doc.getId();
    const url = doc.getUrl();
    try {
      DriveApp.getFileById(id).moveTo(DriveApp.getFolderById(folderId));
    } catch (error) {
      // Report the document so it can be found; it's in My Drive, not the run folder.
      throw new Error(`Created ${url} but couldn't move it into the run folder: ${error.message}`);
    }
    return { id: id, title: title, url: url };
  }

  function writeDocument(documentId, paragraphs) {
    const doc = DocumentApp.openById(documentId);
    const body = doc.getBody();
    paragraphs.forEach(function (spec) {
      if (spec.kind === "table") {
        appendTable(body, spec.table);
      } else {
        applyStyle(body.appendParagraph(spec.text), spec);
      }
    });
    // A new document starts with one empty paragraph. Remove it now that
    // there are others (the last paragraph of a body can't be removed).
    if (body.getNumChildren() > 1) {
      const first = body.getChild(0);
      if (first.getType() === DocumentApp.ElementType.PARAGRAPH && first.asParagraph().getText() === "") {
        first.removeFromParent();
      }
    }
    doc.saveAndClose();
  }

  function applyStyle(paragraph, spec) {
    paragraph.setHeading(DocumentApp.ParagraphHeading[spec.style]);
    const look = KIND_STYLES[spec.kind];
    if (!look || spec.text === "") {
      return;
    }
    paragraph.editAsText().setBold(look.bold).setItalic(look.italic).setForegroundColor(look.color);
    if (look.font) {
      paragraph.editAsText().setFontFamily(look.font);
    }
    if (look.indent) {
      paragraph.setIndentStart(look.indent).setIndentFirstLine(look.indent);
    }
    if (look.spaceBefore !== undefined) {
      paragraph.setSpacingBefore(look.spaceBefore).setSpacingAfter(look.spaceAfter);
    }
    if (spec.kind === "label") {
      paragraph.setSpacingBefore(12);
    }
  }

  // A native table: a bold header row, and right-aligned number columns.
  // Cells wrap, so long titles are shown in full.
  function appendTable(body, table) {
    const element = body.appendTable([table.header].concat(table.rows));
    for (let r = 0; r < element.getNumRows(); r++) {
      const row = element.getRow(r);
      for (let c = 0; c < row.getNumCells(); c++) {
        const paragraph = row.getCell(c).getChild(0).asParagraph();
        if (r === 0) {
          paragraph.editAsText().setBold(true);
        }
        if (table.numericColumns.indexOf(c) !== -1) {
          paragraph.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
        }
      }
    }
  }

  function createJsonFile(folderId, name, content) {
    const file = DriveApp.getFolderById(folderId).createFile(name, content, "application/json");
    return { id: file.getId(), url: file.getUrl() };
  }

  function renameFolder(folderId, name) {
    DriveApp.getFolderById(folderId).setName(name);
  }

  return {
    readMasterDocument: readMasterDocument,
    lastUpdated: lastUpdated,
    checkOutputFolder: checkOutputFolder,
    now: now,
    newRunId: newRunId,
    sha256Hex: sha256Hex,
    createFolder: createFolder,
    createDocument: createDocument,
    writeDocument: writeDocument,
    createJsonFile: createJsonFile,
    renameFolder: renameFolder,
  };
})();
