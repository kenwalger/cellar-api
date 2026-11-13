// Node-only test helpers: file loading and fixture splitting.
// Kept out of the portable core on purpose.

import { readFileSync } from "node:fs";

const repoRoot = new URL("../../", import.meta.url);

export function readRepoFile(relativePath) {
  return readFileSync(new URL(relativePath, repoRoot), "utf8");
}

export function lines(...textLines) {
  return textLines.join("\n");
}

// Splits course/fixtures/malformed-script.md on its "=== Case N: id ===" delimiter
// lines. The delimiter belongs to the fixture file, not to the script grammar.
export function splitMalformedCases(text) {
  const delimiter = /^=== Case (\d+): ([a-z-]+) ===$/;
  const cases = [];
  let current = null;
  for (const line of text.split("\n")) {
    const match = delimiter.exec(line.trim());
    if (match) {
      current = { number: Number(match[1]), id: match[2], lines: [] };
      cases.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return cases.map(({ number, id, lines: caseLines }) => ({
    number,
    id,
    text: caseLines.join("\n"),
  }));
}

// 1-based line number of the first line whose trimmed text equals `needle`.
export function lineOf(text, needle) {
  const index = text.split("\n").findIndex((line) => line.trim() === needle);
  if (index === -1) {
    throw new Error(`Line not found: ${needle}`);
  }
  return index + 1;
}
