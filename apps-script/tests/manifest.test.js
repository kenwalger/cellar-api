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
  error: null,
};

test("buildManifest records provenance, outputs, counts, and warnings", () => {
  const manifest = plain(Manifest.buildManifest(input));
  assert.deepEqual(manifest, {
    schemaVersion: 1,
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
    error: null,
  });
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
