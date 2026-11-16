/**
 * Builds the content of the ONSET, MOTION, and SCREENCAST documents from the
 * parser's IR. The result is a plain model ({title, paragraphs}) that
 * GoogleServices writes into a Google Doc. Nothing is summarized or reworded:
 * every text line of the role's sections appears once, in source order.
 *
 * Paragraph model: { style, kind, text }
 * - style: TITLE | SUBTITLE | HEADING1 | HEADING2 | HEADING3 | NORMAL
 * - kind: heading | provenance | note | label | narration | instruction | example | cue | blank
 *   narration = spoken (ONSET text, VOICEOVER); instruction = not spoken
 *   (ACTION, VISUAL, HIGHLIGHT); example = a technical example in a SCREENCAST
 *   ACTION or HIGHLIGHT block (see renderEntries); label = the annotation name
 *   before a block.
 */
var Render = (function () {
  "use strict";

  const ROLES = ["ONSET", "MOTION", "SCREENCAST"];
  const ROLE_DESCRIPTIONS = {
    ONSET: "presenter narration for the teleprompter",
    MOTION: "motion graphics instructions and voiceover",
    SCREENCAST: "screen recording instructions and narration",
  };

  /** First non-blank front-matter line, or the fallback (the source doc's name). */
  function courseTitle(document, fallback) {
    for (let index = 0; index < document.frontMatter.length; index++) {
      const text = document.frontMatter[index].text.trim();
      if (text !== "") {
        return text;
      }
    }
    return fallback;
  }

  /**
   * @param {Object} document Parser IR (must have no error diagnostics).
   * @param {string} role ONSET, MOTION, or SCREENCAST.
   * @param {{courseTitle: string, sourceTitle: string, generatedAt: string, runId: string}} meta
   * @returns {{role: string, title: string, paragraphs: Object[]}}
   */
  function buildRoleDocument(document, role, meta) {
    if (ROLES.indexOf(role) === -1) {
      throw new Error(`Unknown role: ${role}`);
    }
    const paragraphs = [];
    const add = function (style, kind, text) {
      paragraphs.push({ style: style, kind: kind, text: text });
    };

    add("TITLE", "heading", meta.courseTitle);
    add("SUBTITLE", "heading", `${role}: ${ROLE_DESCRIPTIONS[role]}`);
    add(
      "NORMAL",
      "provenance",
      `Generated ${meta.generatedAt} from the master document "${meta.sourceTitle}" (run ${meta.runId}). Make changes in the master document and generate again. Edits made here are not carried back.`,
    );

    let sectionCount = 0;
    document.stages.forEach(function (stage) {
      // Videos with nothing for this role are left out of this role's document.
      const videos = stage.videos.filter(function (video) {
        return sectionsOfRole(video, role).length > 0;
      });
      if (videos.length === 0) {
        return;
      }
      add("HEADING1", "heading", `Stage ${stage.number}: ${stage.title}`);
      videos.forEach(function (video) {
        add("HEADING2", "heading", `Video ${video.number}: ${video.title}`);
        const sections = sectionsOfRole(video, role);
        sections.forEach(function (section, index) {
          if (sections.length > 1) {
            add("HEADING3", "heading", `Part ${index + 1} of ${sections.length}`);
          }
          renderSection(section, add);
          sectionCount += 1;
        });
      });
    });

    if (sectionCount === 0) {
      add("NORMAL", "note", `The master document has no ${role} sections, so this document has no content.`);
    }

    return {
      role: role,
      title: `${role} — ${meta.courseTitle} — ${meta.runId}`,
      paragraphs: paragraphs,
    };
  }

  function sectionsOfRole(video, role) {
    return video.sections.filter(function (section) {
      return section.type === role;
    });
  }

  function renderSection(section, add) {
    if (section.type === "ONSET") {
      // ONSET content: narration text and cues.
      renderEntries(withoutBlanksAroundCues(section.content), "narration", false, add);
      return;
    }
    section.content.forEach(function (block) {
      add("NORMAL", "label", block.type);
      const textKind = block.type === "VOICEOVER" ? "narration" : "instruction";
      const examples = section.type === "SCREENCAST" && EXAMPLE_BLOCKS.indexOf(block.type) !== -1;
      renderEntries(withoutBlanksAroundCues(block.content), textKind, examples, add);
    });
  }

  // Blocks whose directions can introduce a technical example (see below).
  const EXAMPLE_BLOCKS = ["ACTION", "HIGHLIGHT"];

  /**
   * Renders text and cues. When `examples` is true, the renderer convention for
   * technical examples applies: a line ending with a colon (a lead-in such as
   * "Run:" or "The response body:") makes the next run of non-blank lines,
   * after any blank lines, an "example" paragraph. The run ends at a blank
   * line or a cue. Only the layout decides this; the text is never inspected
   * for braces, URLs, or commands, and it's never changed.
   */
  function renderEntries(entries, textKind, examples, add) {
    let afterLeadIn = false;
    let inExample = false;
    entries.forEach(function (entry) {
      if (entry.kind === "cue") {
        afterLeadIn = false;
        inExample = false;
        add("NORMAL", "cue", `[${entry.type}]`);
      } else if (entry.text.trim() === "") {
        inExample = false;
        add("NORMAL", "blank", entry.text);
      } else if (examples && (afterLeadIn || inExample)) {
        afterLeadIn = false;
        inExample = true;
        add("NORMAL", "example", entry.text);
      } else {
        afterLeadIn = examples && /:\s*$/.test(entry.text);
        add("NORMAL", textKind, entry.text);
      }
    });
  }

  /**
   * The grammar puts each tag on its own line, separated by blank lines. Next
   * to a cue those blank lines only separate the tag, so they're left out of
   * the rendered document, where the cue paragraph has its own spacing. The IR
   * is not changed, and blank lines between paragraphs are kept.
   */
  function withoutBlanksAroundCues(entries) {
    return entries.filter(function (entry, index) {
      if (entry.kind !== "text" || entry.text.trim() !== "") {
        return true;
      }
      return !(nearestNonBlank(entries, index, -1) === "cue" || nearestNonBlank(entries, index, 1) === "cue");
    });
  }

  function nearestNonBlank(entries, index, step) {
    for (let i = index + step; i >= 0 && i < entries.length; i += step) {
      if (entries[i].kind === "cue") {
        return "cue";
      }
      if (entries[i].text.trim() !== "") {
        return "text";
      }
    }
    return null;
  }

  return {
    ROLES: ROLES,
    courseTitle: courseTitle,
    buildRoleDocument: buildRoleDocument,
  };
})();
