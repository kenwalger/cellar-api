// Parser-copy fidelity: apps-script/ProductionScript.js and GeneratedData.js
// must match what scripts/sync-apps-script.mjs generates from their sources.

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildGeneratedFiles, findDrift } from "../../scripts/sync-apps-script.mjs";
import { loadAppsScript, plain, readRepoFile, sha256Hex } from "./helpers.js";

test("the Apps Script parser copy is byte-for-byte identical to the parser core", () => {
  assert.equal(
    readRepoFile("apps-script/ProductionScript.js"),
    readRepoFile("parser/src/production-script.cjs"),
  );
});

test("the repository has no drift", () => {
  assert.deepEqual(findDrift(buildGeneratedFiles(readRepoFile), readRepoFile), []);
});

test("drift is detected when a generated file is edited or missing", () => {
  const expected = buildGeneratedFiles(readRepoFile);
  const edited = (path) => {
    if (path === "apps-script/ProductionScript.js") {
      return readRepoFile(path).replace("const ERROR", "const ERR");
    }
    if (path === "apps-script/GeneratedData.js") {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    }
    return readRepoFile(path);
  };
  assert.deepEqual(
    findDrift(expected, edited).map((d) => [d.path, d.reason]),
    [
      ["apps-script/GeneratedData.js", "missing"],
      ["apps-script/ProductionScript.js", "differs"],
    ],
  );
});

test("GeneratedData records the parser version and core hash", () => {
  const { GeneratedData } = loadAppsScript();
  const packageJson = JSON.parse(readRepoFile("parser/package.json"));
  assert.equal(GeneratedData.parserVersion, packageJson.version);
  assert.equal(GeneratedData.parserCoreSha256, sha256Hex(readRepoFile("parser/src/production-script.cjs")));
  assert.deepEqual(
    plain(GeneratedData.expectedStructure),
    JSON.parse(readRepoFile("course/fixtures/expected-structure.json")),
  );
});
