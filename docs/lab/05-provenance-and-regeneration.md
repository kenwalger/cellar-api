# Exercise 5: Provenance and regeneration

**Time:** 10 minutes
**Objective:** read a generation manifest, check what its hashes prove, and explain why outputs are regenerated instead of edited.
**Prerequisites:** [Exercise 4](04-estimate-production.md). Run the commands from the repository root:

```bash
cd ..
```

## Background

The master script is the **source**. The four Google Docs are **generated artifacts**: nobody edits them, and they can always be made again. Each generation run writes a new folder with the four documents and a `manifest.json`. The manifest records which source, which parser, and which estimator settings produced the documents. It never contains document content.

You don't need a Google account for this exercise. [`docs/lab/examples/`](examples/README.md) has two **instructional example manifests**. They weren't taken from a live run. They were produced offline by the repository's real `Generator` and `Manifest` code, with test doubles in place of Google Drive, from the current master script. Their IDs, URLs, run IDs, timestamps, and source title are placeholders. Run 2 differs from run 1 in one setting only: 160 words per minute instead of 140. A check in CI regenerates them and fails if they drift from the code.

## Steps

1. **Read a manifest.** Open [`examples/example-manifest-run-1.json`](examples/example-manifest-run-1.json). The fields follow manifest schema version 2, documented in [`apps-script/README.md`](../../apps-script/README.md#manifest):

   | Field | What it records | What it lets you establish |
   |---|---|---|
   | `runId`, `generatedAt` | A unique ID and UTC time for this run | Which run made which documents. In a live run the ID comes from a fresh UUID. |
   | `source.documentId`, `documentTitle`, `lastUpdated` | The master Google Doc and its Drive last-modified time | Which document was read. The title is recorded as it was, typos included. |
   | `source.extractedTextSha256` | SHA-256 of the exact text the parser received | Whether two runs read **identical** input |
   | `parser.version`, `parser.coreSha256` | The parser package version and the hash of its core file | Exactly which parser code ran |
   | `estimator.version`, `coreSha256`, `config` | The estimator code and the settings it used | Which code and which assumptions produced the numbers |
   | `output.folderId`, `output.documents` | The run folder and the four documents, with roles, IDs, URLs, and status | Where the outputs are, and whether each was written completely |
   | `counts`, `structureCheck` | Stages, videos, sections, and whether the structure matched the expected outline | What the validation gate saw |
   | `warnings` | Parser and extraction warnings (errors never get this far) | What a reviewer should know about the input |
   | `estimate` | Unrounded totals, per-video figures, and long-video warnings | Every number in the Production Summary |

2. **Check the hashes yourself.**

   ```bash
   sha256sum course/master-script.md parser/src/production-script.cjs production/src/production-estimator.cjs
   ```

   (On macOS, use `shasum -a 256` instead of `sha256sum`.) Compare the three hashes with `source.extractedTextSha256`, `parser.coreSha256`, and `estimator.coreSha256` in the example. They're identical. The parser and estimator hashes are also recorded in `apps-script/GeneratedData.js`, which the sync script writes from the source files.

   The source hash matches the file here because the offline example fed the repository file to the generator line by line. In a live run, the hash is of the text extracted from the Google Doc, which may differ slightly. For example, Docs may or may not keep a trailing empty paragraph. A hash identifies the exact parser input. It doesn't say which file that input came from.

3. **Change one word and hash again.**

   ```bash
   cp course/master-script.md lab-work/edited.md
   ```

   In `lab-work/edited.md`, change any single word, save, and run `sha256sum lab-work/edited.md`. *Expected:* a completely different hash. Any change to the text, even one character, changes it.

4. **Compare the two example runs.**

   ```bash
   git diff --no-index docs/lab/examples/example-manifest-run-1.json docs/lab/examples/example-manifest-run-2.json
   ```

   | Changed between the runs | Unchanged |
   |---|---|
   | `runId` and `generatedAt` | `source.extractedTextSha256`: same text in, same hash |
   | `output`: a new folder and four new documents | `parser.coreSha256` and `estimator.coreSha256`: same code |
   | `estimator.config.wordsPerMinute`: 140 → 160 | `counts` and every `spokenWordCount` |
   | Every duration in `estimate`, including the warning's | Which videos are flagged: only Stage 2, Video 2, still over 3 minutes at 249 s |

   **Changing estimator settings never changes the source hash.** The source hash changes only when the extracted source text changes.

5. **See that earlier runs are never touched.** Regenerating always creates a new folder. It never overwrites, reuses, or deletes an earlier run. The adapter's tests check this with test doubles:

   ```bash
   cd apps-script
   node --test --test-name-pattern="two runs" tests/generator.test.js
   cd ..
   ```

   *Expected:* `two runs create separate folders and leave the first run untouched` passes. It snapshots everything the first run wrote, runs again, and checks that every first-run entry is unchanged.

## Why regenerate instead of editing?

Suppose someone fixes a typo directly in a generated SCREENCAST document. The master script still has the typo, so the next run brings it back. The ONSET document may have the same sentence and still be wrong. And no manifest records the edit. With regeneration, the fix goes into the master once. Every role document picks it up, and the new manifest's source hash shows the input changed. The earlier run's folder stays as a record of what was produced before.

## What a local manifest does and doesn't prove

- **It teaches the schema** and shows which fields respond to which changes.
- **It doesn't prove that a live run happened.** These examples were never in Google Drive. Only a manifest from a real run folder, created by Exercise 6 or by a project owner, is evidence of a live run.

## Reflection

- Two manifests have the same `extractedTextSha256` and `estimator.coreSha256` but different durations. What's the only explanation, and which field confirms it?
- A Production Summary is circulated without its manifest. Which questions about it can no longer be answered?

## Evidence to capture

A short note or screenshot naming at least three provenance fields (for example `source.extractedTextSha256`, `parser.coreSha256`, and `estimator.config`), with what each one shows and whether it changed between the two example runs. See item 12 in the [evidence guide](evidence/README.md).

## Completion criterion

You've matched the three hashes to `sha256sum`, explained which fields changed between the example runs and why, and can say why a local example manifest isn't evidence of a live run.

**Next:** [Exercise 6 (optional): Generate the Google Docs](06-google-docs-extension.md), or you're done with the core lab.
