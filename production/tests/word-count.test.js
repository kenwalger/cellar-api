// The word-count policy (production/README.md#word-count-policy).
// A word is a whitespace-separated token that contains at least one Unicode
// letter or digit.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { countWords, isTechnicalToken, spokenTokens } from "../src/index.js";

describe("countWords", () => {
  test("ordinary words", () => {
    assert.equal(countWords("The client sends a request."), 5);
  });

  test("contractions are one word, with straight or curly apostrophes", () => {
    assert.equal(countWords("don't it's we'll"), 3);
    assert.equal(countWords("don’t it’s"), 2);
  });

  test("hyphenated terms are one word", () => {
    assert.equal(countWords("case-sensitive three-digit key-value"), 3);
  });

  test("numbers are words, including decimals, IDs, and trailing punctuation", () => {
    assert.equal(countWords("200, 404, and 422."), 4);
    assert.equal(countWords("21.4"), 1);
    assert.equal(countWords("batch 2026-014"), 2);
  });

  test("punctuation-only tokens are not words", () => {
    assert.equal(countWords("Wait — really ..."), 2);
    assert.equal(countWords("- : ; ( ) \" '"), 0);
  });

  test("blank and whitespace-only text has no words", () => {
    assert.equal(countWords(""), 0);
    assert.equal(countWords("   \t  "), 0);
  });

  test("any whitespace separates words, including tabs and no-break spaces", () => {
    assert.equal(countWords("  a\tb c  "), 3);
  });

  test("letters from any script count", () => {
    assert.equal(countWords("Café über naïve"), 3);
    assert.equal(countWords("Ελληνικά κρασιά"), 2);
  });

  test("text without spaces is one word per whitespace-separated run (documented limitation)", () => {
    assert.equal(countWords("こんにちは 世界"), 2);
  });

  test("URLs, paths, and code-like tokens count as one word each, as written", () => {
    assert.equal(countWords("at the path /api/v1/batches."), 4);
    assert.equal(countWords("open http://127.0.0.1:8000/docs"), 2);
    assert.equal(countWords("status=fermenting"), 1);
  });

  test("rejects non-string input", () => {
    assert.throws(() => countWords(null), TypeError);
    assert.throws(() => countWords(42), TypeError);
  });
});

describe("spokenTokens", () => {
  test("returns the counted tokens in order, unchanged", () => {
    assert.deepEqual(spokenTokens("So — we'll  see 200."), ["So", "we'll", "see", "200."]);
  });
});

describe("isTechnicalToken", () => {
  test("flags tokens whose spoken form is likely longer than one word", () => {
    for (const token of ["/api/v1/batches", "temperature_c", "status=fermenting", "{batch_id}", "a@b", "#tag", "x<y", "a\\b"]) {
      assert.equal(isTechnicalToken(token), true, token);
    }
  });

  test("ordinary words, numbers, and punctuation are not technical", () => {
    for (const token of ["don't", "case-sensitive", "21.4", "2026-014", "200,", "fermenting."]) {
      assert.equal(isTechnicalToken(token), false, token);
    }
  });
});
