// Prints the parse result for a script file as JSON, for inspection while learning.
// Usage: npm run print-ir -- ../course/master-script.md
// Exits with status 1 if the script has any error diagnostics.

import { readFileSync } from "node:fs";

import { parseProductionScript } from "./index.js";

const [filePath] = process.argv.slice(2);
if (!filePath) {
  console.error("Usage: npm run print-ir -- <path-to-script>");
  process.exit(2);
}

const result = parseProductionScript(readFileSync(filePath, "utf8"));
console.log(JSON.stringify(result, null, 2));

if (result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
  process.exit(1);
}
