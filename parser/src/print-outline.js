// Prints a short outline of a script file: stages, videos, sections in order
// with their source lines and annotation counts, then the diagnostics.
// Usage: npm run print-outline -- ../course/master-script.md
// Exits with status 1 if the script has any error diagnostics.

import { readFileSync } from "node:fs";

import { parseProductionScript } from "./index.js";
import { formatOutline } from "./outline.js";

const [filePath] = process.argv.slice(2);
if (!filePath) {
  console.error("Usage: npm run print-outline -- <path-to-script>");
  process.exit(2);
}

const result = parseProductionScript(readFileSync(filePath, "utf8"));
console.log(formatOutline(result));

if (result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
  process.exit(1);
}
