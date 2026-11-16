// Formats a parse result as a short plain-text outline, for learners and
// reviewers. Node-only and read-only: it summarizes the IR and diagnostics the
// parser returned and never reinterprets the script text.

const SECTION_TYPES = ["ONSET", "MOTION", "SCREENCAST"];
const ANNOTATION_TYPES = ["ACTION", "VISUAL", "VOICEOVER", "HIGHLIGHT", "PAUSE"];

function zeroCounts(types) {
  return Object.fromEntries(types.map((type) => [type, 0]));
}

// Counts block annotations and PAUSE cues in one section's content.
function annotationCounts(section) {
  const counts = zeroCounts(ANNOTATION_TYPES);
  for (const item of section.content) {
    if (item.kind === "block") {
      counts[item.type] += 1;
      counts.PAUSE += item.content.filter((inner) => inner.kind === "cue").length;
    } else if (item.kind === "cue") {
      counts.PAUSE += 1;
    }
  }
  return counts;
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function describeCounts(counts) {
  const parts = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${type} ${count}`);
  return parts.length > 0 ? parts.join(", ") : "no annotations";
}

function describeSection(section) {
  const end = section.endLine === null ? "unclosed" : String(section.endLine);
  const lines = `lines ${section.sourceLine}-${end}`;
  const counts = annotationCounts(section);
  let detail = describeCounts(counts);
  if (section.type === "ONSET") {
    const paragraphs = section.content.filter((item) => item.kind === "text" && item.text.trim() !== "").length;
    detail = `${paragraphs} narration ${paragraphs === 1 ? "paragraph" : "paragraphs"}` +(counts.PAUSE > 0 ? `, PAUSE ${counts.PAUSE}` : "");
  }
  return `    ${section.type.padEnd(10)} ${lines.padEnd(17)} ${detail}`;
}

/**
 * @param {{document: Object, diagnostics: Object[]}} result What parseProductionScript returned.
 * @returns {string} The outline, ending with a diagnostics list.
 */
export function formatOutline({ document, diagnostics }) {
  const out = [];
  const sectionCounts = zeroCounts(SECTION_TYPES);
  const totalAnnotations = zeroCounts(ANNOTATION_TYPES);
  let videoCount = 0;

  for (const stage of document.stages) {
    out.push(`Stage ${stage.number}: ${stage.title} (line ${stage.sourceLine})`);
    for (const video of stage.videos) {
      videoCount += 1;
      out.push(`  Video ${video.number}: ${video.title} (line ${video.sourceLine})`);
      for (const section of video.sections) {
        sectionCounts[section.type] += 1;
        for (const [type, count] of Object.entries(annotationCounts(section))) {
          totalAnnotations[type] += count;
        }
        out.push(describeSection(section));
      }
    }
  }

  const sectionTotal = Object.values(sectionCounts).reduce((sum, count) => sum + count, 0);
  out.push("");
  out.push(
    `Totals: ${plural(document.stages.length, "stage")}, ${plural(videoCount, "video")}, ${plural(sectionTotal, "section")} ` +
      `(${SECTION_TYPES.map((type) => `${type} ${sectionCounts[type]}`).join(", ")})`,
  );
  out.push(`Annotations: ${ANNOTATION_TYPES.map((type) => `${type} ${totalAnnotations[type]}`).join(", ")}`);

  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.length - errors;
  if (diagnostics.length === 0) {
    out.push("Diagnostics: none");
  } else {
    out.push(`Diagnostics: ${plural(errors, "error")}, ${plural(warnings, "warning")}`);
    for (const d of diagnostics) {
      const line = d.line === null ? "no line" : `line ${d.line}`;
      out.push(`  ${d.severity.padEnd(7)} ${d.code} at ${line}: ${d.message}`);
    }
  }
  return out.join("\n");
}
