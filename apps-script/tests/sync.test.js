// Copy fidelity: apps-script/ProductionScript.js, ProductionEstimator.js, and
// GeneratedData.js must match what scripts/sync-apps-script.mjs generates from
// their sources.

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

test("the Apps Script estimator copy is byte-for-byte identical to the estimator core", () => {
  assert.equal(
    readRepoFile("apps-script/ProductionEstimator.js"),
    readRepoFile("production/src/production-estimator.cjs"),
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
    if (path === "apps-script/ProductionEstimator.js") {
      return readRepoFile(path).replace("wordsPerMinute: 140", "wordsPerMinute: 150");
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
      ["apps-script/ProductionEstimator.js", "differs"],
      ["apps-script/ProductionScript.js", "differs"],
    ],
  );
});

test("GeneratedData records the parser and estimator versions and core hashes", () => {
  const { GeneratedData } = loadAppsScript();
  const packageJson = JSON.parse(readRepoFile("parser/package.json"));
  assert.equal(GeneratedData.parserVersion, packageJson.version);
  assert.equal(GeneratedData.parserCoreSha256, sha256Hex(readRepoFile("parser/src/production-script.cjs")));
  const estimatorPackage = JSON.parse(readRepoFile("production/package.json"));
  assert.equal(GeneratedData.estimatorVersion, estimatorPackage.version);
  assert.equal(
    GeneratedData.estimatorCoreSha256,
    sha256Hex(readRepoFile("production/src/production-estimator.cjs")),
  );
  assert.deepEqual(
    plain(GeneratedData.expectedStructure),
    JSON.parse(readRepoFile("course/fixtures/expected-structure.json")),
  );
});
