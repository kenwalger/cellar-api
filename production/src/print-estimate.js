// Prints the production estimate for a script file as JSON.
//
//   node src/print-estimate.js <script-file> [options-json]
//   npm run print-estimate -- ../course/master-script.md '{"wordsPerMinute": 160}'
//
// Exits with status 1 if the script has parser errors, because the estimator
// only accepts documents that parse cleanly.

import { readFileSync } from "node:fs";

import { parseProductionScript } from "../../parser/src/index.js";
import { estimateProduction } from "./index.js";

const [file, optionsJson] = process.argv.slice(2);
if (!file) {
  console.error("Usage: node src/print-estimate.js <script-file> [options-json]");
  process.exit(2);
}

const { document, diagnostics } = parseProductionScript(readFileSync(file, "utf8"));
const errors = diagnostics.filter((d) => d.severity === "error");
if (errors.length > 0) {
  console.error(JSON.stringify(errors, null, 2));
  console.error("The script has parser errors, so it can't be estimated.");
  process.exit(1);
}

const options = optionsJson === undefined ? undefined : JSON.parse(optionsJson);
console.log(JSON.stringify(estimateProduction(document, options), null, 2));
