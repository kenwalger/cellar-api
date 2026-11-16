// Script Properties configuration (Config).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { loadAppsScript, plain } from "./helpers.js";

const { Config } = loadAppsScript();
const docId = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd";

test("requires MASTER_DOCUMENT_ID", () => {
  const { config, errors } = plain(Config.readConfig({}));
  assert.equal(config, null);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /MASTER_DOCUMENT_ID/);
});

const defaultEstimate = { wordsPerMinute: 140, longVideoThresholdMinutes: 3, screencastAllowanceSecondsPerSection: 0 };

test("accepts a document ID and applies defaults", () => {
  assert.deepEqual(plain(Config.readConfig({ MASTER_DOCUMENT_ID: docId })), {
    config: {
      masterDocumentId: docId,
      outputFolderId: null,
      requireExpectedStructure: true,
      estimate: defaultEstimate,
    },
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
    estimate: defaultEstimate,
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

describe("estimator settings", () => {
  function estimateFrom(properties) {
    return plain(Config.readConfig({ MASTER_DOCUMENT_ID: docId, ...properties }));
  }

  test("reads all three settings as numbers", () => {
    const { config, errors } = estimateFrom({
      WORDS_PER_MINUTE: " 160 ",
      LONG_VIDEO_THRESHOLD_MINUTES: "2.5",
      SCREENCAST_ALLOWANCE_SECONDS_PER_SECTION: "30",
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(config.estimate, {
      wordsPerMinute: 160,
      longVideoThresholdMinutes: 2.5,
      screencastAllowanceSecondsPerSection: 30,
    });
  });

  test("blank settings use the defaults", () => {
    const { config } = estimateFrom({ WORDS_PER_MINUTE: "", SCREENCAST_ALLOWANCE_SECONDS_PER_SECTION: "  " });
    assert.deepEqual(config.estimate, defaultEstimate);
  });

  test("a zero screencast allowance is valid", () => {
    assert.equal(estimateFrom({ SCREENCAST_ALLOWANCE_SECONDS_PER_SECTION: "0" }).config.estimate.screencastAllowanceSecondsPerSection, 0);
  });

  const invalid = [
    ["WORDS_PER_MINUTE", "fast"],
    ["WORDS_PER_MINUTE", "0"],
    ["WORDS_PER_MINUTE", "-140"],
    ["WORDS_PER_MINUTE", "Infinity"],
    ["WORDS_PER_MINUTE", "NaN"],
    ["WORDS_PER_MINUTE", "0x8C"],
    ["WORDS_PER_MINUTE", "140 wpm"],
    ["LONG_VIDEO_THRESHOLD_MINUTES", "0"],
    ["LONG_VIDEO_THRESHOLD_MINUTES", "3:00"],
    ["SCREENCAST_ALLOWANCE_SECONDS_PER_SECTION", "-1"],
    ["SCREENCAST_ALLOWANCE_SECONDS_PER_SECTION", "1e3"],
  ];

  for (const [name, value] of invalid) {
    test(`rejects ${name} = "${value}"`, () => {
      const { config, errors } = estimateFrom({ [name]: value });
      assert.equal(config, null);
      assert.equal(errors.length, 1, JSON.stringify(errors));
      assert.match(errors[0], new RegExp(name));
    });
  }
});
