// Generation orchestration (Generator), using fake Drive/Docs services.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { bodyFromText, fakeServices, lines, loadAppsScript, plain, readRepoFile, sha256Hex } from "./helpers.js";

const { DocumentReader, Generator, Manifest, ProductionEstimator, Render, Summary, Validation } = loadAppsScript();
const master = readRepoFile("course/master-script.md");
const expectedStructure = JSON.parse(readRepoFile("course/fixtures/expected-structure.json"));

function inputFor(text, { requireExpectedStructure = true, estimateOptions } = {}) {
  const extraction = DocumentReader.readBody(bodyFromText(text));
  return {
    source: { documentId: "source-id", url: "https://docs.test/source-id", title: "Master Script", lastUpdated: null },
    extraction,
    run: Validation.prepareRun(extraction, { requireExpectedStructure, expectedStructure }),
    outputFolderId: "parent-folder",
    parser: { version: "0.1.0", coreSha256: "cd".repeat(32) },
    estimator: { version: "0.1.0", coreSha256: "ef".repeat(32) },
    estimateOptions,
  };
}

function methods(services) {
  return services.calls.map((call) => call[0]);
}

describe("successful generation", () => {
  const services = fakeServices();
  const result = plain(Generator.generate(services, inputFor(master)));
  const manifestFile = Object.values(services.store.files)[0];
  const manifest = JSON.parse(manifestFile.content);

  test("creates one folder, four documents, and one manifest, in that order", () => {
    assert.equal(result.status, "complete");
    assert.deepEqual(methods(services), [
      "createFolder",
      "createDocument",
      "writeDocument",
      "createDocument",
      "writeDocument",
      "createDocument",
      "writeDocument",
      "createDocument",
      "writeDocument",
      "createJsonFile",
    ]);
    assert.deepEqual(services.calls[0], [
      "createFolder",
      "Digital Cellar Production — 2026-11-13 231605 UTC — run00001",
      "parent-folder",
    ]);
  });

  test("puts every document and the manifest in the new folder", () => {
    const folderId = result.folder.id;
    assert.ok(Object.values(services.store.documents).every((d) => d.folderId === folderId));
    assert.equal(manifestFile.folderId, folderId);
    assert.equal(manifestFile.name, "manifest.json");
  });

  test("writes the three role documents and the Production Summary", () => {
    const docs = Object.values(services.store.documents);
    assert.deepEqual(
      docs.map((d) => d.title.split(" — ")[0]),
      ["ONSET", "MOTION", "SCREENCAST", "Production Summary"],
    );
    assert.ok(docs.every((d) => Array.isArray(d.paragraphs) && d.paragraphs.length > 10));
  });

  const courseTitle = "Understanding APIs: A Winery's Digital Cellar";
  const parsedMaster = () =>
    Validation.prepareRun(DocumentReader.readBody(bodyFromText(master)), { requireExpectedStructure: false }).parse
      .document;

  test("the role documents are exactly what Render produces, unchanged by Phase 4", () => {
    const meta = { courseTitle, sourceTitle: "Master Script", generatedAt: "2026-11-13T23:16:05.000Z", runId: "run00001" };
    const docs = Object.values(services.store.documents);
    Render.ROLES.forEach((role, index) => {
      const expectedModel = plain(Render.buildRoleDocument(parsedMaster(), role, meta));
      assert.equal(docs[index].title, expectedModel.title);
      assert.deepEqual(plain(docs[index].paragraphs), expectedModel.paragraphs);
    });
  });

  test("the Production Summary is built from the estimator's results", () => {
    const estimate = ProductionEstimator.estimateProduction(parsedMaster());
    const expectedModel = plain(
      Summary.buildSummaryDocument(estimate, {
        courseTitle,
        sourceTitle: "Master Script",
        sourceUrl: "https://docs.test/source-id",
        generatedAt: "2026-11-13T23:16:05.000Z",
        runId: "run00001",
        folderName: Manifest.formatFolderName(new Date(Date.UTC(2026, 10, 13, 23, 16, 5)), "run00001"),
        parser: { version: "0.1.0", coreSha256: "cd".repeat(32) },
        estimator: { version: "0.1.0", coreSha256: "ef".repeat(32) },
      }),
    );
    const summaryDoc = Object.values(services.store.documents)[3];
    assert.equal(summaryDoc.title, expectedModel.title);
    assert.deepEqual(plain(summaryDoc.paragraphs), expectedModel.paragraphs);
    assert.ok(summaryDoc.paragraphs.some((p) => p.text === "Spoken words: 1980"));
  });

  test("the manifest links the source to every output", () => {
    assert.equal(manifest.status, "complete");
    assert.equal(manifest.runId, "run00001");
    assert.equal(manifest.source.documentId, "source-id");
    assert.equal(manifest.source.extractedTextSha256, sha256Hex(master));
    assert.equal(manifest.output.folderId, result.folder.id);
    assert.deepEqual(
      manifest.output.documents.map((d) => [d.role, d.status]),
      [
        ["ONSET", "complete"],
        ["MOTION", "complete"],
        ["SCREENCAST", "complete"],
        ["PRODUCTION_SUMMARY", "complete"],
      ],
    );
    assert.deepEqual(manifest.counts.sections, { ONSET: 6, MOTION: 3, SCREENCAST: 4, total: 13 });
    assert.deepEqual(manifest.structureCheck, { checked: true, matches: true });
  });

  test("the manifest records estimator provenance, configuration, totals, and warnings", () => {
    assert.equal(manifest.schemaVersion, 2);
    assert.deepEqual(manifest.estimator, {
      schemaVersion: 1,
      version: "0.1.0",
      coreSha256: "ef".repeat(32),
      config: { wordsPerMinute: 140, longVideoThresholdMinutes: 3, screencastAllowanceSecondsPerSection: 0 },
    });
    assert.equal(manifest.estimate.totals.spokenWordCount, 1980);
    assert.equal(manifest.estimate.totals.videosOverThreshold, 1);
    assert.equal(manifest.estimate.videos.length, 6);
    assert.deepEqual(
      manifest.estimate.warnings.map((w) => [w.code, w.stageNumber, w.videoNumber]),
      [["LONG_VIDEO_ESTIMATE", 2, 2]],
    );
  });

  test("the manifest doesn't contain document content", () => {
    assert.doesNotMatch(manifestFile.content, /Picture a small winery/);
  });
});

describe("blocking and warnings", () => {
  test("an invalid estimator configuration stops the run before any service call", () => {
    const services = fakeServices();
    assert.throws(
      () => Generator.generate(services, inputFor(master, { estimateOptions: { wordsPerMinute: 0 } })),
      /Invalid estimator configuration/,
    );
    assert.deepEqual(services.calls, []);
  });

  test("an estimator failure on the document stops the run before any service call", () => {
    const services = fakeServices();
    const input = inputFor(master);
    input.run.parse.document.stages[0].videos[0].sections[1].content[0].type = "NARRATION";
    assert.throws(() => Generator.generate(services, input), /NARRATION/);
    assert.deepEqual(services.calls, []);
  });

  test("long-video warnings don't block generation", () => {
    const services = fakeServices();
    const input = inputFor(master, { estimateOptions: { longVideoThresholdMinutes: 1 } });
    assert.equal(plain(Generator.generate(services, input)).status, "complete");
    const manifest = JSON.parse(Object.values(services.store.files)[0].content);
    assert.equal(manifest.estimate.warnings.length, 6);
    assert.equal(manifest.estimator.config.longVideoThresholdMinutes, 1);
  });

  test("error diagnostics block generation before any service call", () => {
    const services = fakeServices();
    const result = plain(
      Generator.generate(services, inputFor(lines("Stage 1: A", "Video 1: B", "[ONSET]", "Hi."))),
    );
    assert.equal(result.status, "blocked");
    assert.deepEqual(services.calls, []);
  });

  test("a structure mismatch blocks generation when required", () => {
    const services = fakeServices();
    const minimal = lines("Stage 1: A", "Video 1: B", "[ONSET]", "Hi.", "[/ONSET]");
    assert.equal(Generator.generate(services, inputFor(minimal)).status, "blocked");
    assert.deepEqual(services.calls, []);
  });

  test("warnings allow generation and are recorded in the manifest", () => {
    const services = fakeServices();
    const withWarning = lines("Stage 1: A", "Video 1: B", "[SCREENCAST]", "[ACTION]", "[VOICEOVER]", "Hi.", "[/SCREENCAST]");
    const result = plain(
      Generator.generate(services, inputFor(withWarning, { requireExpectedStructure: false })),
    );
    assert.equal(result.status, "complete");
    const manifest = JSON.parse(Object.values(services.store.files)[0].content);
    assert.deepEqual(
      manifest.warnings.map((w) => [w.code, w.line]),
      [["EMPTY_BLOCK", 4]],
    );
  });
});

describe("independent runs", () => {
  test("two runs create separate folders and leave the first run untouched", () => {
    const services = fakeServices();
    const first = plain(Generator.generate(services, inputFor(master)));
    const firstSnapshot = JSON.stringify(services.store);
    const second = plain(Generator.generate(services, inputFor(master)));

    assert.notEqual(first.folder.id, second.folder.id);
    assert.notEqual(first.folder.name, second.folder.name);
    assert.notEqual(first.runId, second.runId);
    // Every entry from the first run is unchanged after the second run.
    const before = JSON.parse(firstSnapshot);
    const after = JSON.parse(JSON.stringify(services.store));
    for (const kind of ["folders", "documents", "files"]) {
      for (const [id, value] of Object.entries(before[kind])) {
        assert.deepEqual(after[kind][id], value);
      }
    }
    assert.ok(!methods(services).includes("renameFolder"));
  });
});

describe("partial failure", () => {
  test("a failed document write is reported, recorded, and never shown as complete", () => {
    const services = fakeServices({ failOn: { method: "writeDocument", nth: 2 } });
    let thrown;
    try {
      Generator.generate(services, inputFor(master));
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown, "generation should throw");
    assert.match(thrown.message, /Simulated writeDocument failure/);
    const partial = plain(thrown.result);
    assert.equal(partial.status, "failed");
    assert.deepEqual(
      partial.manifest.output.documents.map((d) => [d.role, d.status]),
      [
        ["ONSET", "complete"],
        ["MOTION", "incomplete"],
      ],
    );
    // The estimate was made before the run started, so it's in the failure manifest.
    assert.equal(partial.manifest.estimate.totals.spokenWordCount, 1980);

    // The failure manifest is written into the run folder and the folder is marked.
    const files = Object.values(services.store.files);
    assert.equal(files.length, 1);
    assert.equal(JSON.parse(files[0].content).status, "failed");
    const folder = services.store.folders[partial.folder.id];
    assert.match(folder.name, / — FAILED$/);
    // Nothing is deleted: both created documents still exist.
    assert.equal(Object.keys(services.store.documents).length, 2);
  });

  test("a failed Production Summary write is recorded as incomplete", () => {
    const services = fakeServices({ failOn: { method: "writeDocument", nth: 4 } });
    assert.throws(() => Generator.generate(services, inputFor(master)), /Simulated writeDocument failure/);
    const manifest = JSON.parse(Object.values(services.store.files)[0].content);
    assert.equal(manifest.status, "failed");
    assert.deepEqual(
      manifest.output.documents.map((d) => [d.role, d.status]),
      [
        ["ONSET", "complete"],
        ["MOTION", "complete"],
        ["SCREENCAST", "complete"],
        ["PRODUCTION_SUMMARY", "incomplete"],
      ],
    );
  });

  test("a failure to create the folder creates nothing else", () => {
    const services = fakeServices({ failOn: { method: "createFolder", nth: 1 } });
    assert.throws(() => Generator.generate(services, inputFor(master)), /Simulated createFolder failure/);
    assert.deepEqual(methods(services), ["createFolder"]);
  });

  test("if the failure manifest can't be written, the original error still surfaces", () => {
    const services = fakeServices({ failOn: { method: "createJsonFile", always: true } });
    let thrown;
    try {
      Generator.generate(services, inputFor(master));
    } catch (error) {
      thrown = error;
    }
    assert.match(thrown.message, /Simulated createJsonFile failure/);
    assert.match(plain(thrown.result).manifestWriteError, /Simulated createJsonFile failure/);
  });
});
