# Lab examples

Files used by the [learning lab](../README.md). **None of them came from a live Google run.**

| File | What it is |
|---|---|
| [`example-manifest-run-1.json`](example-manifest-run-1.json) | An instructional generation manifest (schema version 2) at the default estimator settings |
| [`example-manifest-run-2.json`](example-manifest-run-2.json) | The same, from a second run at 160 words per minute |
| [`any-content-script.txt`](any-content-script.txt) | A tiny valid script about pottery, which shows that the parser checks structure, not subject matter |

## How the example manifests are made

`node scripts/lab-docs.mjs` runs the repository's real `Generator` and `Manifest` code from `apps-script/`, offline, on the current `course/master-script.md`. It uses the same test doubles as the adapter tests in place of Google Drive and Docs. So the structure and every computed value are what the code really produces:

- **Real values:** `schemaVersion`, `source.extractedTextSha256`, `extractedLineCount`, the parser and estimator versions and hashes (from `apps-script/GeneratedData.js`), `estimator.config`, `counts`, `structureCheck`, `warnings`, and `estimate`.
- **Placeholders:** `runId` (`example1`, `example2`), `generatedAt`, `source.documentId`, `documentUrl`, `documentTitle`, and `lastUpdated`, and every folder and document ID and URL (`folder-1`, `https://docs.test/doc-2`). The `.test` domain is reserved and never resolves.

`node scripts/lab-docs.mjs --check` (run in CI) regenerates them and fails if the committed files differ. It also checks the claims that [Exercise 5](../05-provenance-and-regeneration.md) makes about them, such as the same source hash in both runs and different durations.

These files are teaching material, not test oracles. The independent oracles are in [`course/fixtures/`](https://github.com/kenwalger/cellar-api/blob/main/course/fixtures/README.md).
