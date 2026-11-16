// Checks that the core can run without Node's module system or globals.
// This approximates, but does not prove, Google Apps Script compatibility.

import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";

import { parseProductionScript } from "../../parser/src/index.js";
import { estimateProduction } from "../src/index.js";
import { readRepoFile } from "./helpers.js";

const coreSource = readRepoFile("production/src/production-estimator.cjs");

test("core source uses no module syntax, host globals, or newer syntax", () => {
  const forbidden = [
    /^\s*import\s/m,
    /^\s*export\s/m,
    /\brequire\s*\(/,
    /\bprocess\./,
    /\bBuffer\b/,
    /\bwindow\./,
    /\bglobalThis\b/,
    /\?\.|\?\?/,
    /\bDate\b/,
    /Math\.random/,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(coreSource, pattern);
  }
});

test("core runs in a bare script context and defines one global", () => {
  const context = vm.createContext({});
  vm.runInContext(coreSource, context);
  assert.deepEqual(Object.keys(context), ["ProductionEstimator"]);

  const { document } = parseProductionScript(readRepoFile("course/master-script.md"));
  const isolated = context.ProductionEstimator.estimateProduction(document);
  // Objects from another realm have different prototypes, so compare as JSON.
  assert.equal(JSON.stringify(isolated), JSON.stringify(estimateProduction(document)));
});
