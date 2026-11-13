// Checks that the core can run without Node's module system or globals.
// This approximates, but does not prove, Google Apps Script compatibility.

import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";

import { parseProductionScript } from "../src/index.js";
import { readRepoFile } from "./helpers.js";

const coreSource = readRepoFile("parser/src/production-script.cjs");

test("core source uses no module syntax or host-specific globals", () => {
  const forbidden = [
    /^\s*import\s/m,
    /^\s*export\s/m,
    /\brequire\s*\(/,
    /\bprocess\./,
    /\bBuffer\b/,
    /\bwindow\./,
    /\bglobalThis\b/,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(coreSource, pattern);
  }
});

test("core runs in a bare script context and defines one global", () => {
  const context = vm.createContext({});
  vm.runInContext(coreSource, context);
  assert.deepEqual(Object.keys(context), ["ProductionScript"]);

  const master = readRepoFile("course/master-script.md");
  const isolated = context.ProductionScript.parseProductionScript(master);
  // Objects from another realm have different prototypes, so compare as JSON.
  assert.equal(JSON.stringify(isolated), JSON.stringify(parseProductionScript(master)));
  assert.equal(isolated.diagnostics.length, 0);
});
