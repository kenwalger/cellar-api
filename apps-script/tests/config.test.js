// Script Properties configuration (Config).

import assert from "node:assert/strict";
import { test } from "node:test";

import { loadAppsScript, plain } from "./helpers.js";

const { Config } = loadAppsScript();
const docId = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd";

test("requires MASTER_DOCUMENT_ID", () => {
  const { config, errors } = plain(Config.readConfig({}));
  assert.equal(config, null);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /MASTER_DOCUMENT_ID/);
});

test("accepts a document ID and applies defaults", () => {
  assert.deepEqual(plain(Config.readConfig({ MASTER_DOCUMENT_ID: docId })), {
    config: { masterDocumentId: docId, outputFolderId: null, requireExpectedStructure: true },
    errors: [],
  });
});

test("accepts full Google Docs and Drive folder URLs", () => {
  const { config } = plain(
    Config.readConfig({
      MASTER_DOCUMENT_ID: ` https://docs.google.com/document/d/${docId}/edit?tab=t.0 `,
      OUTPUT_FOLDER_ID: "https://drive.google.com/drive/folders/0BxFolderId_1234567890abcdefgh",
      REQUIRE_EXPECTED_STRUCTURE: "FALSE",
    }),
  );
  assert.deepEqual(config, {
    masterDocumentId: docId,
    outputFolderId: "0BxFolderId_1234567890abcdefgh",
    requireExpectedStructure: false,
  });
});

test("reports every invalid value at once", () => {
  const { config, errors } = plain(
    Config.readConfig({
      MASTER_DOCUMENT_ID: "not a doc id",
      OUTPUT_FOLDER_ID: "??",
      REQUIRE_EXPECTED_STRUCTURE: "maybe",
    }),
  );
  assert.equal(config, null);
  assert.equal(errors.length, 3);
});
