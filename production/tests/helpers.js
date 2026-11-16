// Node-only test helpers. Kept out of the portable core on purpose.

import { readFileSync } from "node:fs";

import { parseProductionScript } from "../../parser/src/index.js";

const repoRoot = new URL("../../", import.meta.url);

export function readRepoFile(relativePath) {
  return readFileSync(new URL(relativePath, repoRoot), "utf8");
}

export function lines(...textLines) {
  return textLines.join("\n");
}

// Parses script text and returns the IR. The estimator only accepts documents
// the parser accepts, so a test script with error diagnostics is a test bug.
export function parseValid(text) {
  const { document, diagnostics } = parseProductionScript(text);
  const errors = diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) {
    throw new Error(`Test script has parser errors: ${errors.map((d) => `${d.code}@${d.line}`).join(", ")}`);
  }
  return document;
}

export function words(count, word = "word") {
  return Array.from({ length: count }, () => word).join(" ");
}

// Deep-freezes a value so any mutation throws in strict mode.
export function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
