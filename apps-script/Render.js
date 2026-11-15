/**
 * Builds the content of the ONSET, MOTION, and SCREENCAST documents from the
 * parser's IR. The result is a plain model ({title, paragraphs}) that
 * GoogleServices writes into a Google Doc. Nothing is summarized or reworded:
 * every text line of the role's sections appears once, in source order.
 *
 * Paragraph model: { style, kind, text }
 * - style: TITLE | SUBTITLE | HEADING1 | HEADING2 | HEADING3 | NORMAL
 * - kind: heading | provenance | note | label | narration | instruction | cue | blank
 *   narration = spoken (ONSET text, VOICEOVER); instruction = not spoken
 *   (ACTION, VISUAL, HIGHLIGHT); label = the annotation name before a block.
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
    section.content.forEach(function (item) {
      if (item.kind === "block") {
        add("NORMAL", "label", item.type);
        const textKind = item.type === "VOICEOVER" ? "narration" : "instruction";
        item.content.forEach(function (entry) {
          renderEntry(entry, textKind, add);
        });
      } else {
        // ONSET content: narration text and cues.
        renderEntry(item, "narration", add);
      }
    });
  }

  function renderEntry(entry, textKind, add) {
    if (entry.kind === "cue") {
      add("NORMAL", "cue", `[${entry.type}]`);
    } else if (entry.text.trim() === "") {
      add("NORMAL", "blank", entry.text);
    } else {
      add("NORMAL", textKind, entry.text);
    }
  }

  return {
    ROLES: ROLES,
    courseTitle: courseTitle,
    buildRoleDocument: buildRoleDocument,
  };
})();
