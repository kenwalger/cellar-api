// Manifest construction and run naming.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { loadAppsScript, plain } from "./helpers.js";

const { Manifest } = loadAppsScript();

test("folder names carry a UTC timestamp and the run id", () => {
  const name = Manifest.formatFolderName(new Date(Date.UTC(2026, 0, 5, 7, 8, 9)), "a1b2c3d4");
  assert.equal(name, "Digital Cellar Production — 2026-01-05 070809 UTC — a1b2c3d4");
});

test("bytesToHex converts Apps Script's signed digest bytes", () => {
  const digest = createHash("sha256").update("Digital Cellar", "utf8").digest();
  const signed = Array.from(digest, (byte) => (byte > 127 ? byte - 256 : byte));
  assert.equal(Manifest.bytesToHex(signed), digest.toString("hex"));
});

const input = {
  status: "complete",
  runId: "a1b2c3d4",
  generatedAt: new Date(Date.UTC(2026, 10, 13, 23, 16, 5)),
  source: {
    documentId: "source-id",
    url: "https://docs.test/source-id",
    title: "Master Script",
    lastUpdated: "2026-11-13T22:00:00.000Z",
  },
  sourceSha256: "ab".repeat(32),
  lineCount: 401,
  parser: { version: "0.1.0", coreSha256: "cd".repeat(32) },
  folder: { id: "folder-1", url: "https://drive.test/folder-1", name: "Run folder" },
  documents: [
    { role: "ONSET", id: "d1", title: "ONSET — x", url: "https://docs.test/d1", status: "complete" },
  ],
  counts: { stages: 2, videos: 6, sections: { ONSET: 6, MOTION: 3, SCREENCAST: 4, total: 13 } },
  structure: { checked: true, matches: true, differences: [] },
  issues: [
    { source: "parser", code: "EMPTY_BLOCK", severity: "warning", line: 8, element: 8, partInElement: 1, message: "m" },
  ],
  estimator: { version: "0.1.0", coreSha256: "ef".repeat(32) },
  estimate: {
    schemaVersion: 1,
    config: { wordsPerMinute: 140, longVideoThresholdMinutes: 3, screencastAllowanceSecondsPerSection: 0 },
    stages: [{ stageNumber: 1 }],
    videos: [
      {
        stageNumber: 1,
        videoNumber: 1,
        title: "Long",
        sectionSequence: ["ONSET"],
        sectionCounts: { ONSET: 1, MOTION: 0, SCREENCAST: 0 },
        spokenWordCount: 700,
        technicalTokenCount: 1,
        narrationDurationSeconds: 300,
        screencastAllowanceSeconds: 0,
        estimatedDurationSeconds: 300,
        warnings: [{ code: "LONG_VIDEO_ESTIMATE" }],
      },
    ],
    totals: {
      stageCount: 1,
      videoCount: 1,
      sectionCounts: { ONSET: 1, MOTION: 0, SCREENCAST: 0 },
      spokenWordCount: 700,
      technicalTokenCount: 1,
      narrationDurationSeconds: 300,
      screencastAllowanceSeconds: 0,
      estimatedDurationSeconds: 300,
      videosOverThreshold: 1,
    },
    warnings: [
      {
        code: "LONG_VIDEO_ESTIMATE",
        stageNumber: 1,
        videoNumber: 1,
        title: "Long",
        estimatedDurationSeconds: 300,
        thresholdSeconds: 180,
        includesScreencastAllowance: false,
        message: "a message for people",
      },
    ],
    assumptions: [{ code: "NARRATION_ONLY", text: "t" }],
  },
  error: null,
};

test("buildManifest records provenance, outputs, counts, estimates, and warnings", () => {
  const manifest = plain(Manifest.buildManifest(input));
  assert.deepEqual(manifest, {
    schemaVersion: 2,
    status: "complete",
    runId: "a1b2c3d4",
    generatedAt: "2026-11-13T23:16:05.000Z",
    source: {
      documentId: "source-id",
      documentUrl: "https://docs.test/source-id",
      documentTitle: "Master Script",
      lastUpdated: "2026-11-13T22:00:00.000Z",
      extractedTextSha256: "ab".repeat(32),
      extractedLineCount: 401,
    },
    parser: { version: "0.1.0", coreSha256: "cd".repeat(32) },
    estimator: {
      schemaVersion: 1,
      version: "0.1.0",
      coreSha256: "ef".repeat(32),
      config: { wordsPerMinute: 140, longVideoThresholdMinutes: 3, screencastAllowanceSecondsPerSection: 0 },
    },
    output: {
      folderId: "folder-1",
      folderUrl: "https://drive.test/folder-1",
      folderName: "Run folder",
      documents: [
        { role: "ONSET", id: "d1", title: "ONSET — x", url: "https://docs.test/d1", status: "complete" },
      ],
    },
    counts: { stages: 2, videos: 6, sections: { ONSET: 6, MOTION: 3, SCREENCAST: 4, total: 13 } },
    structureCheck: { checked: true, matches: true },
    warnings: [{ source: "parser", code: "EMPTY_BLOCK", line: 8, message: "m" }],
    estimate: {
      totals: input.estimate.totals,
      videos: [
        {
          stageNumber: 1,
          videoNumber: 1,
          title: "Long",
          spokenWordCount: 700,
          technicalTokenCount: 1,
          narrationDurationSeconds: 300,
          screencastAllowanceSeconds: 0,
          estimatedDurationSeconds: 300,
        },
      ],
      warnings: [
        {
          code: "LONG_VIDEO_ESTIMATE",
          stageNumber: 1,
          videoNumber: 1,
          title: "Long",
          estimatedDurationSeconds: 300,
          thresholdSeconds: 180,
          includesScreencastAllowance: false,
        },
      ],
    },
    error: null,
  });
});

test("buildManifest leaves out assumption text and warning messages", () => {
  const json = JSON.stringify(Manifest.buildManifest(input));
  assert.doesNotMatch(json, /a message for people/);
  assert.doesNotMatch(json, /NARRATION_ONLY/);
});

test("buildManifest handles a failed run with no folder", () => {
  const manifest = plain(
    Manifest.buildManifest({ ...input, status: "failed", folder: null, documents: [], error: "Drive quota" }),
  );
  assert.equal(manifest.status, "failed");
  assert.equal(manifest.error, "Drive quota");
  assert.deepEqual(manifest.output, { folderId: null, folderUrl: null, folderName: null, documents: [] });
});

test("buildManifest only includes warnings, never errors or document content", () => {
  const manifest = plain(
    Manifest.buildManifest({
      ...input,
      issues: input.issues.concat([
        { source: "parser", code: "X", severity: "error", line: 1, element: 1, partInElement: 1, message: "e" },
      ]),
    }),
  );
  assert.deepEqual(
    manifest.warnings.map((w) => w.code),
    ["EMPTY_BLOCK"],
  );
});
