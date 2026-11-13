/**
 * Portable parser and validator for the Digital Cellar master production script.
 *
 * The grammar is documented in course/README.md. The intermediate representation
 * (IR), diagnostics, and error recovery are documented in parser/README.md.
 *
 * Portability rules for this file:
 * - It is a classic script, not a module. It defines exactly one global,
 *   ProductionScript, so it can be added to Google Apps Script unchanged.
 * - No import/export, require, Node.js APIs, or browser APIs.
 * - Node.js loads it through the CommonJS guard at the bottom (see src/index.js).
 */
var ProductionScript = (function () {
  "use strict";

  const SECTION_TYPES = ["ONSET", "MOTION", "SCREENCAST"];
  const BLOCK_TYPES = ["ACTION", "VISUAL", "VOICEOVER", "HIGHLIGHT"];
  const CUE_TYPES = ["PAUSE"];
  const ALLOWED_ANNOTATIONS = {
    ONSET: ["PAUSE"],
    MOTION: ["VISUAL", "VOICEOVER", "HIGHLIGHT", "PAUSE"],
    SCREENCAST: ["ACTION", "VOICEOVER", "HIGHLIGHT", "PAUSE"],
  };

  // A whole trimmed line that is an upper-case word in brackets, optionally closing.
  const TAG_PATTERN = /^\[(\/?)([A-Z]+)\]$/;
  const STAGE_PATTERN = /^Stage (\d+): (\S.*)$/;
  const VIDEO_PATTERN = /^Video (\d+): (\S.*)$/;
  // Lines that look like an attempted heading but don't match the grammar,
  // such as "Stage two: Title", "Video 2 - Title", or "Video 3:".
  const HEADING_LIKE_PATTERN = /^(Stage|Video)(\s+\d|\b[^:]{0,20}:)/;

  const DiagnosticCode = Object.freeze({
    // Structural errors found while reading lines.
    UNCLOSED_SECTION: "UNCLOSED_SECTION",
    UNEXPECTED_CLOSING_TAG: "UNEXPECTED_CLOSING_TAG",
    NESTED_SECTION: "NESTED_SECTION",
    UNKNOWN_ANNOTATION: "UNKNOWN_ANNOTATION",
    ANNOTATION_NOT_ALLOWED: "ANNOTATION_NOT_ALLOWED",
    ANNOTATION_OUTSIDE_SECTION: "ANNOTATION_OUTSIDE_SECTION",
    CONTENT_BEFORE_ANNOTATION: "CONTENT_BEFORE_ANNOTATION",
    SECTION_OUTSIDE_VIDEO: "SECTION_OUTSIDE_VIDEO",
    VIDEO_OUTSIDE_STAGE: "VIDEO_OUTSIDE_STAGE",
    INVALID_HEADING: "INVALID_HEADING",
    CONTENT_OUTSIDE_SECTION: "CONTENT_OUTSIDE_SECTION",
    // Document checks, run only when there are no structural errors.
    NO_STAGES: "NO_STAGES",
    STAGE_NUMBER_SEQUENCE: "STAGE_NUMBER_SEQUENCE",
    VIDEO_NUMBER_SEQUENCE: "VIDEO_NUMBER_SEQUENCE",
    EMPTY_VIDEO: "EMPTY_VIDEO",
    EMPTY_SECTION: "EMPTY_SECTION",
    EMPTY_BLOCK: "EMPTY_BLOCK",
  });

  const ERROR = "error";
  const WARNING = "warning";

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Parses master production script text into an IR plus diagnostics.
   *
   * Malformed input never throws. It yields a partial document and diagnostics.
   *
   * @param {string} sourceText The full script text.
   * @returns {{document: Object, diagnostics: Object[]}}
   * @throws {TypeError} If sourceText is not a string.
   */
  function parseProductionScript(sourceText) {
    if (typeof sourceText !== "string") {
      throw new TypeError("parseProductionScript expects the script text as a string.");
    }

    const state = createState();
    const sourceLines = splitLines(sourceText);
    for (let index = 0; index < sourceLines.length; index++) {
      readLine(state, sourceLines[index], index + 1);
    }
    finishInput(state);

    if (!state.diagnostics.some((d) => d.severity === ERROR)) {
      checkDocument(state);
    }

    return {
      document: state.document,
      diagnostics: sortByLine(state.diagnostics),
    };
  }

  // ---------------------------------------------------------------------------
  // Line reading
  // ---------------------------------------------------------------------------

  function createState() {
    return {
      document: { frontMatter: [], stages: [] },
      diagnostics: [],
      stage: null,
      video: null,
      section: null, // the open section, or null
      block: null, // the open block in a MOTION/SCREENCAST section, or null
      ignoreLooseContent: false, // suppresses repeat CONTENT_BEFORE_ANNOTATION reports
      reportedStrayContent: false, // suppresses repeat CONTENT_OUTSIDE_SECTION reports
    };
  }

  // Strips a leading byte-order mark and normalizes CRLF and CR to LF.
  function splitLines(text) {
    return text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  }

  function readLine(state, rawLine, lineNumber) {
    const trimmed = rawLine.trim();
    const tag = TAG_PATTERN.exec(trimmed);

    if (state.section === null) {
      readLineOutsideSection(state, rawLine, trimmed, tag, lineNumber);
      return;
    }
    if (tag) {
      readTagInSection(state, tag[1] === "/", tag[2], lineNumber);
      return;
    }
    if (STAGE_PATTERN.test(trimmed) || VIDEO_PATTERN.test(trimmed)) {
      // A heading can't appear inside a section, so the section was never closed.
      reportUnclosedSection(state, `before the heading on line ${lineNumber}`);
      closeSection(state, null);
      readLineOutsideSection(state, rawLine, trimmed, null, lineNumber);
      return;
    }
    addSectionText(state, rawLine, lineNumber);
  }

  function readLineOutsideSection(state, rawLine, trimmed, tag, lineNumber) {
    if (trimmed === "") {
      if (state.stage === null) {
        state.document.frontMatter.push(textItem(rawLine, lineNumber));
      }
      return;
    }
    if (tag) {
      state.reportedStrayContent = false;
      readTagOutsideSection(state, tag[1] === "/", tag[2], lineNumber);
      return;
    }

    const stageMatch = STAGE_PATTERN.exec(trimmed);
    if (stageMatch) {
      state.reportedStrayContent = false;
      startStage(state, Number(stageMatch[1]), stageMatch[2], lineNumber);
      return;
    }
    const videoMatch = VIDEO_PATTERN.exec(trimmed);
    if (videoMatch) {
      state.reportedStrayContent = false;
      startVideo(state, Number(videoMatch[1]), videoMatch[2], lineNumber);
      return;
    }
    if (HEADING_LIKE_PATTERN.test(trimmed)) {
      report(
        state,
        DiagnosticCode.INVALID_HEADING,
        ERROR,
        lineNumber,
        `Line ${lineNumber} looks like a heading but doesn't match "Stage N: Title" or "Video N: Title".`,
      );
      return;
    }
    if (state.stage === null) {
      state.document.frontMatter.push(textItem(rawLine, lineNumber));
      return;
    }
    if (!state.reportedStrayContent) {
      state.reportedStrayContent = true;
      report(
        state,
        DiagnosticCode.CONTENT_OUTSIDE_SECTION,
        ERROR,
        lineNumber,
        `Text on line ${lineNumber} is outside any production section. Move it into an [ONSET], [MOTION], or [SCREENCAST] section.`,
      );
    }
  }

  function readTagOutsideSection(state, isClosing, name, lineNumber) {
    if (SECTION_TYPES.includes(name)) {
      if (isClosing) {
        report(
          state,
          DiagnosticCode.UNEXPECTED_CLOSING_TAG,
          ERROR,
          lineNumber,
          `[/${name}] on line ${lineNumber} has no matching [${name}] opening tag.`,
        );
        return;
      }
      openSection(state, name, lineNumber);
      return;
    }
    if (isClosing) {
      reportAnnotationClosingTag(state, name, lineNumber);
      return;
    }
    if (!isAnnotation(name)) {
      reportUnknownAnnotation(state, name, lineNumber);
      return;
    }
    report(
      state,
      DiagnosticCode.ANNOTATION_OUTSIDE_SECTION,
      ERROR,
      lineNumber,
      `[${name}] on line ${lineNumber} is outside any production section. Annotations must be inside [ONSET], [MOTION], or [SCREENCAST].`,
    );
  }

  function readTagInSection(state, isClosing, name, lineNumber) {
    const section = state.section;

    if (SECTION_TYPES.includes(name)) {
      if (!isClosing) {
        report(
          state,
          DiagnosticCode.NESTED_SECTION,
          ERROR,
          lineNumber,
          `[${name}] on line ${lineNumber} opens a section inside the ${section.type} section opened on line ${section.sourceLine}. Close it with [/${section.type}] first.`,
        );
        return;
      }
      if (name !== section.type) {
        report(
          state,
          DiagnosticCode.UNEXPECTED_CLOSING_TAG,
          ERROR,
          lineNumber,
          `[/${name}] on line ${lineNumber} doesn't match the ${section.type} section opened on line ${section.sourceLine}.`,
        );
        return;
      }
      closeSection(state, lineNumber);
      return;
    }

    if (isClosing) {
      reportAnnotationClosingTag(state, name, lineNumber);
      return;
    }
    if (!isAnnotation(name)) {
      reportUnknownAnnotation(state, name, lineNumber);
      discardOpenBlock(state);
      return;
    }
    if (!ALLOWED_ANNOTATIONS[section.type].includes(name)) {
      report(
        state,
        DiagnosticCode.ANNOTATION_NOT_ALLOWED,
        ERROR,
        lineNumber,
        `[${name}] on line ${lineNumber} isn't allowed in a ${section.type} section. Allowed: ${formatTags(ALLOWED_ANNOTATIONS[section.type])}.`,
      );
      discardOpenBlock(state);
      return;
    }
    if (CUE_TYPES.includes(name)) {
      addCue(state, name, lineNumber);
      return;
    }
    startBlock(state, name, lineNumber);
  }

  // ---------------------------------------------------------------------------
  // Building the document
  // ---------------------------------------------------------------------------

  function startStage(state, number, title, lineNumber) {
    const stage = { number: number, title: title, sourceLine: lineNumber, videos: [] };
    state.document.stages.push(stage);
    state.stage = stage;
    state.video = null;
  }

  function startVideo(state, number, title, lineNumber) {
    if (state.stage === null) {
      report(
        state,
        DiagnosticCode.VIDEO_OUTSIDE_STAGE,
        ERROR,
        lineNumber,
        `"Video ${number}: ${title}" on line ${lineNumber} comes before any "Stage N: Title" heading.`,
      );
      return;
    }
    const video = { number: number, title: title, sourceLine: lineNumber, sections: [] };
    state.stage.videos.push(video);
    state.video = video;
  }

  function openSection(state, type, lineNumber) {
    const section = { type: type, sourceLine: lineNumber, endLine: null, content: [] };
    if (state.video === null) {
      // The section is still read, so its closing tag doesn't cause more errors,
      // but it isn't added to the document.
      report(
        state,
        DiagnosticCode.SECTION_OUTSIDE_VIDEO,
        ERROR,
        lineNumber,
        `The ${type} section on line ${lineNumber} isn't inside a video. Add a "Video N: Title" heading before it.`,
      );
    } else {
      state.video.sections.push(section);
    }
    state.section = section;
    state.block = null;
    state.ignoreLooseContent = false;
  }

  function closeSection(state, endLine) {
    const section = state.section;
    finishBlock(state);
    if (section.type === "ONSET") {
      trimBlankEdges(section.content);
    }
    section.endLine = endLine;
    state.section = null;
    state.reportedStrayContent = false;
  }

  function startBlock(state, type, lineNumber) {
    finishBlock(state);
    const block = { kind: "block", type: type, sourceLine: lineNumber, content: [] };
    state.section.content.push(block);
    state.block = block;
    state.ignoreLooseContent = false;
  }

  function finishBlock(state) {
    if (state.block !== null) {
      trimBlankEdges(state.block.content);
      state.block = null;
    }
  }

  // After an unknown or disallowed annotation, the following content can't be
  // assigned a type. In MOTION and SCREENCAST it is dropped until the next valid
  // block annotation, rather than being added to the previous block.
  function discardOpenBlock(state) {
    if (state.section.type === "ONSET") {
      return;
    }
    finishBlock(state);
    state.ignoreLooseContent = true;
  }

  function addSectionText(state, rawLine, lineNumber) {
    const item = textItem(rawLine, lineNumber);
    if (state.section.type === "ONSET") {
      state.section.content.push(item);
    } else if (state.block !== null) {
      state.block.content.push(item);
    } else if (rawLine.trim() !== "") {
      reportLooseContent(state, lineNumber);
    }
  }

  function addCue(state, type, lineNumber) {
    const cue = { kind: "cue", type: type, sourceLine: lineNumber };
    if (state.section.type === "ONSET") {
      state.section.content.push(cue);
    } else if (state.block !== null) {
      state.block.content.push(cue);
    } else {
      reportLooseContent(state, lineNumber);
    }
  }

  function finishInput(state) {
    if (state.section !== null) {
      reportUnclosedSection(state, "before the end of the document");
      closeSection(state, null);
    }
    trimBlankEdges(state.document.frontMatter);
  }

  function textItem(rawLine, lineNumber) {
    return { kind: "text", sourceLine: lineNumber, text: rawLine };
  }

  function isBlankText(item) {
    return item.kind === "text" && item.text.trim() === "";
  }

  // Removes blank lines at the start and end. Interior blank lines are kept.
  function trimBlankEdges(items) {
    while (items.length > 0 && isBlankText(items[0])) {
      items.shift();
    }
    while (items.length > 0 && isBlankText(items[items.length - 1])) {
      items.pop();
    }
  }

  function isAnnotation(name) {
    return BLOCK_TYPES.includes(name) || CUE_TYPES.includes(name);
  }

  function formatTags(names) {
    return names.map((name) => `[${name}]`).join(", ");
  }

  // ---------------------------------------------------------------------------
  // Document checks
  // ---------------------------------------------------------------------------

  function checkDocument(state) {
    const stages = state.document.stages;
    if (stages.length === 0) {
      report(
        state,
        DiagnosticCode.NO_STAGES,
        ERROR,
        null,
        'The document has no "Stage N: Title" headings.',
      );
      return;
    }

    stages.forEach((stage, stageIndex) => {
      if (stage.number !== stageIndex + 1) {
        report(
          state,
          DiagnosticCode.STAGE_NUMBER_SEQUENCE,
          ERROR,
          stage.sourceLine,
          `Stage ${stage.number} on line ${stage.sourceLine} should be Stage ${stageIndex + 1}. Stages are numbered 1, 2, 3, ... in order.`,
        );
      }
      stage.videos.forEach((video, videoIndex) => {
        if (video.number !== videoIndex + 1) {
          report(
            state,
            DiagnosticCode.VIDEO_NUMBER_SEQUENCE,
            ERROR,
            video.sourceLine,
            `Video ${video.number} on line ${video.sourceLine} should be Video ${videoIndex + 1}. Videos are numbered 1, 2, 3, ... within each stage.`,
          );
        }
        checkVideoContent(state, video);
      });
    });
  }

  function checkVideoContent(state, video) {
    if (video.sections.length === 0) {
      report(
        state,
        DiagnosticCode.EMPTY_VIDEO,
        WARNING,
        video.sourceLine,
        `Video ${video.number} on line ${video.sourceLine} has no production sections.`,
      );
      return;
    }
    for (const section of video.sections) {
      if (section.content.length === 0) {
        report(
          state,
          DiagnosticCode.EMPTY_SECTION,
          WARNING,
          section.sourceLine,
          `The ${section.type} section on line ${section.sourceLine} is empty.`,
        );
        continue;
      }
      for (const item of section.content) {
        if (item.kind === "block" && !item.content.some((i) => i.kind === "text")) {
          report(
            state,
            DiagnosticCode.EMPTY_BLOCK,
            WARNING,
            item.sourceLine,
            `[${item.type}] on line ${item.sourceLine} has no content.`,
          );
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Diagnostics
  // ---------------------------------------------------------------------------

  function report(state, code, severity, line, message) {
    state.diagnostics.push({ code: code, severity: severity, line: line, message: message });
  }

  function reportUnclosedSection(state, where) {
    const section = state.section;
    report(
      state,
      DiagnosticCode.UNCLOSED_SECTION,
      ERROR,
      section.sourceLine,
      `The ${section.type} section opened on line ${section.sourceLine} was not closed ${where}. Add [/${section.type}] where the section ends.`,
    );
  }

  function reportUnknownAnnotation(state, name, lineNumber) {
    report(
      state,
      DiagnosticCode.UNKNOWN_ANNOTATION,
      ERROR,
      lineNumber,
      `[${name}] on line ${lineNumber} is not a known tag. Annotations are ${formatTags(BLOCK_TYPES.concat(CUE_TYPES))}.`,
    );
  }

  function reportAnnotationClosingTag(state, name, lineNumber) {
    report(
      state,
      DiagnosticCode.UNEXPECTED_CLOSING_TAG,
      ERROR,
      lineNumber,
      `[/${name}] on line ${lineNumber} is not valid. Only [ONSET], [MOTION], and [SCREENCAST] have closing tags.`,
    );
  }

  function reportLooseContent(state, lineNumber) {
    if (state.ignoreLooseContent) {
      return;
    }
    state.ignoreLooseContent = true;
    const type = state.section.type;
    report(
      state,
      DiagnosticCode.CONTENT_BEFORE_ANNOTATION,
      ERROR,
      lineNumber,
      `Line ${lineNumber} in the ${type} section isn't inside an annotation block. Start the block with ${formatTags(ALLOWED_ANNOTATIONS[type].filter((name) => BLOCK_TYPES.includes(name)))}.`,
    );
  }

  // Orders by line (document-level diagnostics, with a null line, go last),
  // then by the order they were found.
  function sortByLine(diagnostics) {
    const lineKey = (d) => (d.line === null ? Infinity : d.line);
    return diagnostics
      .map((diagnostic, index) => ({ diagnostic: diagnostic, index: index }))
      .sort((a, b) => lineKey(a.diagnostic) - lineKey(b.diagnostic) || a.index - b.index)
      .map((entry) => entry.diagnostic);
  }

  return {
    parseProductionScript: parseProductionScript,
    DiagnosticCode: DiagnosticCode,
  };
})();

// Node.js (CommonJS) export. Google Apps Script has no `module`, so it skips this.
if (typeof module === "object" && module.exports) {
  module.exports = ProductionScript;
}
