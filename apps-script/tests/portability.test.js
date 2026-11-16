// Every Apps Script file must be a plain script: no modules, no Node globals,
// and no load-order dependencies.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { loadAppsScript, plain, readRepoFile, scriptFileNames } from "./helpers.js";

const expectedGlobals = [
  "Config",
  "DocumentReader",
  "Generator",
  "GeneratedData",
  "GoogleServices",
  "Manifest",
  "ProductionEstimator",
  "ProductionScript",
  "Render",
  "Summary",
  "Validation",
  // Main.js: manual entry points and private helpers (trailing underscore).
  "generateProductionDocuments",
  "validateMasterDocument",
];

test("files use no module syntax or Node globals", () => {
  for (const name of scriptFileNames()) {
    const source = readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
    for (const pattern of [/^\s*import\s/m, /^\s*export\s/m, /\brequire\s*\(/, /\bprocess\./, /\bglobalThis\b/]) {
      assert.doesNotMatch(source, pattern, `${name} matches ${pattern}`);
    }
  }
});

test("the adapter avoids optional chaining and nullish coalescing", () => {
  for (const name of scriptFileNames()) {
    const source = readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\?\.|\?\?/, name);
  }
});

test("files define the expected globals and no others", () => {
  const context = loadAppsScript();
  const publicNames = Object.keys(context)
    .filter((name) => !name.endsWith("_"))
    .sort();
  assert.deepEqual(publicNames, expectedGlobals.slice().sort());
});

test("load order doesn't matter", () => {
  const master = readRepoFile("course/master-script.md");
  const forward = loadAppsScript();
  const reverse = loadAppsScript({ order: "reverse" });
  assert.equal(
    JSON.stringify(plain(forward.ProductionScript.parseProductionScript(master))),
    JSON.stringify(plain(reverse.ProductionScript.parseProductionScript(master))),
  );
  assert.equal(typeof reverse.validateMasterDocument, "function");
});

test("appsscript.json uses V8 and declares only the Docs and Drive scopes", () => {
  const manifest = JSON.parse(readRepoFile("apps-script/appsscript.json"));
  assert.equal(manifest.runtimeVersion, "V8");
  assert.deepEqual(manifest.oauthScopes.slice().sort(), [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
  ]);
});
