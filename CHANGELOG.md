# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Repository foundation: `pyproject.toml` with uv lockfile, Ruff and pytest configuration, `.editorconfig`, and `.python-version`.
- Read-only FastAPI application (`api/`) with:
  - `GET /api/v1/health`
  - `GET /api/v1/batches` with an optional, validated `status` filter and results sorted by `batch_id`
  - `GET /api/v1/batches/{batch_id}`, which returns 404 `{"detail": "Batch not found"}` for unknown IDs
- Twelve fictional wine production batches in `api/data/batches.json`, validated at load time with Pydantic. Malformed records, unknown fields, and duplicate IDs are rejected.
- pytest suite covering the endpoints and the data layer.
- GitHub Actions CI that runs Ruff lint, the Ruff format check, and pytest.
- Project documentation: README, CLAUDE.md, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, architecture, roadmap, and learning-lab outline.
- Master course script `course/master-script.md` for *Understanding APIs: A Winery's Digital Cellar*: two stages of three videos each, with `[ONSET]`, `[MOTION]`, and `[SCREENCAST]` sections and `[ACTION]`, `[VISUAL]`, `[VOICEOVER]`, `[HIGHLIGHT]`, and `[PAUSE]` annotations. Every API example was checked against the implementation. Stage 2, Video 2 is deliberately long, for testing the long-video threshold.
- Script grammar, annotation conventions, and Google Docs portability rules in `course/README.md`.
- Independently authored structural oracle `course/fixtures/expected-structure.json`.
- Four isolated malformed-script cases in `course/fixtures/malformed-script.md` (missing closing tag, unexpected closing tag, nested section, unknown annotation), with their expected failures documented in `course/fixtures/README.md`.
- Portable JavaScript parser in `parser/` (Phase 3A):
  - `parseProductionScript(sourceText)` returns a deterministic IR (stages, videos, sections in authored order, typed annotation blocks, `PAUSE` cues, verbatim text, source line numbers) and diagnostics.
  - Seventeen stable diagnostic codes for structural errors and document checks, sorted by line, with conservative error recovery documented in `parser/README.md`.
  - A host-neutral core (`src/production-script.cjs`) with no module syntax or Node/browser APIs, an ESM wrapper, and a `print-ir` inspection script.
  - `node:test` suites: master-script acceptance against `course/fixtures/expected-structure.json`, each malformed fixture case, IR and grammar edge cases, diagnostics, and an isolated-`vm` portability check. No npm dependencies.
- Google Apps Script integration in `apps-script/` (Phase 3B):
  - Manual entry points: `validateMasterDocument()` (read-only report of diagnostics, counts, and the structure check) and `generateProductionDocuments()`.
  - `DocumentReader` extracts paragraphs as text lines, splitting soft line breaks and keeping a line→paragraph map. It reports tables, images, smart chips, extra tabs, and similar content as errors, and list formatting, page breaks, and rules as warnings.
  - Validation runs the unchanged parser, maps diagnostics to document paragraphs, and, by default, requires an exact match with `course/fixtures/expected-structure.json`. Errors block generation and warnings don't.
  - ONSET, MOTION, and SCREENCAST documents rendered verbatim in source order, with stage and video headings, `Part N of M` headings for repeated sections, and instructions styled differently from spoken narration.
  - Each run creates a new `Digital Cellar Production — <UTC timestamp> — <run id>` folder with the three documents and a provenance `manifest.json` (schema version 1: source ID, URL, title, and last-updated time; extracted-text SHA-256; parser version and core hash; output IDs and URLs; counts; warnings; status).
  - Partial failures throw, write a `"failed"` manifest, and rename the folder with ` — FAILED`. Nothing is deleted or reused.
  - Script Properties configuration (`MASTER_DOCUMENT_ID`, `OUTPUT_FOLDER_ID`, `REQUIRE_EXPECTED_STRUCTURE`). There are no triggers.
  - 67 offline `node:test` tests using Body and Drive test doubles. No npm dependencies.
- `scripts/sync-apps-script.mjs` generates `apps-script/ProductionScript.js` (a byte-for-byte copy of the parser core) and `apps-script/GeneratedData.js`, and `--check` detects drift.
- Portable production estimator in `production/` (Phase 4):
  - `estimateProduction(document, options)` reads the parser IR (it never reparses) and returns per-video, per-stage, and course word counts and durations, `LONG_VIDEO_ESTIMATE` warnings, the configuration used, and coded assumption statements (output schema version 1). Durations are unrounded. Totals are exact sums of the video values.
  - Spoken words come only from ONSET text and `VOICEOVER` blocks. Content with an unknown section, block, or item type, or an unclosed section, is refused instead of guessed at.
  - Documented word-count policy: a word is a whitespace-separated token with at least one Unicode letter or digit. A per-video `technicalTokenCount` flags URLs, paths, and code in narration. The master script's counts (273, 287, 246, 280, 666, 228; 1980 in total) match the Phase 2 reference figures exactly.
  - Configuration: `wordsPerMinute` (140), `longVideoThresholdMinutes` (3), and `screencastAllowanceSecondsPerSection` (0, a narration-only baseline). Non-numeric, non-finite, zero-rate, zero-threshold, and negative values, and unknown fields, throw `RangeError`. They never fall back to the defaults.
  - Videos strictly over the threshold are flagged. At the defaults, only Stage 2, Video 2 is (about 4 min 45 s).
  - A host-neutral core (`src/production-estimator.cjs`), an ESM wrapper, a `print-estimate` script, and 75 `node:test` tests (word count, classification, configuration, boundaries, reconciliation, non-mutation, determinism, master-script acceptance, and `vm` portability). No npm dependencies.
- Production Summary generation in `apps-script/` (Phase 4):
  - `Summary.js` builds a fourth Google Doc, `Production Summary — <course> — <run id>`, with provenance, estimator configuration, course overview, per-stage and per-video breakdown, warnings (or an explicit "none"), methodology and exclusions, and run provenance.
  - `apps-script/ProductionEstimator.js` is generated as a byte-for-byte copy of the estimator core. `GeneratedData.js` gains `estimatorVersion` and `estimatorCoreSha256`.
  - Script Properties `WORDS_PER_MINUTE`, `LONG_VIDEO_THRESHOLD_MINUTES`, and `SCREENCAST_ALLOWANCE_SECONDS_PER_SECTION` (plain decimals only, validated before any document is opened).
  - `validateMasterDocument()` and `generateProductionDocuments()` log the active estimator configuration, per-video estimates, the course total, and warnings.
  - Production Summary recipes in `docs/learning-lab.md` (Exercises 6 and 7: change the speaking rate, add a screencast allowance).

- Phase 4b cleanup:
  - SCREENCAST technical examples. In an `ACTION` or `HIGHLIGHT` block, the lines after a lead-in ending with a colon, up to the next blank line, render as a new `example` paragraph kind: Courier New, upright, and indented, with the text unchanged. This is a documented layout convention (`course/README.md`), not a grammar change and not a content heuristic.
  - A Production Summary **Video overview**: a native Google Docs table (video, spoken words, estimated duration, status) generated from the estimator result, placed between the course overview and the detailed breakdown.
  - A Phase 4b live verification checklist in `apps-script/README.md`, with exact steps for renaming the master Google Doc and applying the narration edit to it.

- Developer learning lab (Phase 5):
  - `docs/lab/`: an overview with twelve learning objectives mapped to exercises, five local exercises that need no Google account (set up; inspect the source; parse and validate; break the contract; estimate production; provenance and regeneration; about 57 minutes in all), and an optional Google Docs exercise. Each has a time, an objective, prerequisites, exact commands, expected results, reflection questions, evidence to capture, and a completion criterion.
  - `docs/lab/evidence/README.md`: twelve screenshots, each with what it demonstrates, what to show and redact, a filename, alt text, and whether it's local or Google. The inventory records that none has been captured yet.
  - `docs/lab/troubleshooting.md` (including Windows PowerShell quoting and encoding) and `docs/lab/maintainers.md` (fresh-checkout run, verification, independent fixtures, updating after code changes, privacy, levels of claims, a 60-minute workshop plan, and GitHub Pages publishing requirements).
  - `docs/index.md`: a GitHub Pages-ready landing page with a Mermaid architecture diagram that matches the implementation. Nothing is deployed, and no Pages workflow was added.
  - `docs/lab/examples/`: two instructional example manifests produced offline by the real `Generator` and `Manifest` code with test doubles (placeholder IDs on the reserved `.test` domain, and labeled as not from a live run), plus a tiny valid script on an unrelated subject.
  - `npm run print-outline` in `parser/` (`src/outline.js`, `src/print-outline.js`, with 5 tests): a Node-only text outline of a parse result, with sections in order, source lines, annotation counts, and diagnostics. The portable parser core is unchanged.
  - `scripts/lab-docs.mjs`: refreshes, and with `--check` verifies, the lab's documented command outputs, estimate tables, and example manifests against the current code, plus relative links and heading anchors, referenced commands, Mermaid syntax, Liquid safety, and the absence of private Google identifiers. It has no dependencies.

- GitHub Pages publishing (Phase 5a):
  - `_config.yml` for GitHub Pages' built-in Merlot theme (`jekyll-theme-merlot`), with `url` and `baseurl` for `https://kenwalger.github.io/cellar-api/`. `docs/index.md` is the home page at `/`. Every page gets the lab layout. An `exclude` list publishes only the lab (`docs/index.md` and `docs/lab/`), not the source, fixtures, or root documents.
  - `_data/lab.yml` (the reading order and reference pages) and `_layouts/lab.html`, which wraps Merlot's default layout with an "All lab pages" list, links to the lab home, the overview, and GitHub, and previous and next links. All of its links use `relative_url`.
  - `_includes/lab-mermaid.html`: Mermaid from jsDelivr, loaded and initialized once, only on pages with a diagram, in Merlot's colors. The diagram's source stays visible if JavaScript or the CDN is unavailable.
  - `assets/css/style.scss`: imports Merlot, then darkens link and table-header colors to meet WCAG AA contrast, underlines content links, wraps long inline code, makes wide tables and code blocks scroll inside the column (without re-wrapping code), and styles the navigation.
  - `scripts/lab-docs.mjs --check` also checks Pages link rules: a relative link from a published page must reach a published file, and links to `github.com/kenwalger/cellar-api` must point to an existing path and heading. It checks that every published page is in `_data/lab.yml` with the URL Jekyll gives it, and that `docs/index.md` is the home page.

### Changed

- Phase 5a:
  - In the published lab pages, 38 links to repository files outside the lab (the master script, fixtures, READMEs, `docs/architecture.md`, and `api/`) now point to GitHub, with their anchors kept, so they don't 404 on the site.
  - `docs/index.md` no longer embeds its own Mermaid script (the layout adds it), and it points to a text version of the flow.
  - `docs/lab/maintainers.md` documents the Pages configuration, the choice of Merlot, base-path handling, the manual Settings steps, a checklist for the deployed site, optional local preview, and how to add a page.
  - `.gitignore` excludes local Jekyll output and a scratch `Gemfile`. `README.md`, `CLAUDE.md`, `docs/roadmap.md`, and `docs/architecture.md` were updated.

- Phase 5:
  - CI runs `node scripts/lab-docs.mjs --check` in the `parser` job.
  - `docs/learning-lab.md` now points to `docs/lab/` and keeps only the two API activities that are outside the lab.
  - `.gitignore` ignores `lab-work/`, the lab's scratch folder.
  - `README.md` gains a Learning lab section. `README.md`, `CLAUDE.md`, `docs/roadmap.md`, `docs/architecture.md`, `parser/README.md`, and `apps-script/README.md` were updated for Phase 5. A stale README limitation now says that only the Phase 4b changes are unverified live.

- Phase 4b cleanup:
  - `[PAUSE]` cues render without the blank separator lines around them, and get even spacing (6 pt before and after) in Google Docs. Their text and position are unchanged, and so are the IR and estimator.
  - Production Summary technical-token note: `includes 1 URL, path, or code token` and `includes N ... tokens`, `that may take longer to narrate`. It replaces the ungrammatical `1 are URLs...`. Counts are unchanged.
  - `course/master-script.md`, Stage 2, Video 2: the 400s and 500s sentences now say the 400s "generally mean the server can't or won't fulfill the client's request" and the 500s "mean the server encountered an error while trying to handle the request." Spoken words go from 666 to 664 for that video and from 1,980 to 1,978 for the course (14 min 9 s to 14 min 8 s at 140 WPM). Structure is unchanged, and the expected-structure fixture is unchanged. The estimator's reference count for that video is adjusted by a hand count (−2).
  - The live-status notes record the owner-reported Phase 4 live run (run `6146a211`, November 16, 2026).
- `generateProductionDocuments()` now creates four documents. The estimate is calculated and every document rendered before the first Drive write, so invalid estimator settings, or a document the estimator refuses, create no folder. Long-video warnings never block generation. The ONSET, MOTION, and SCREENCAST documents are unchanged.
- The generation manifest moves to **schema version 2**. It adds an `estimator` object (output schema, version, core SHA-256, configuration), an `estimate` object (totals, per-video figures, and long-video warnings, with numbers only), and a `PRODUCTION_SUMMARY` entry in `output.documents`. No version 1 field was removed or renamed. Failure manifests also carry the estimate.
- `scripts/sync-apps-script.mjs` also generates and drift-checks `apps-script/ProductionEstimator.js`.
- CI runs the estimator tests (`npm test` in `production/`). The drift check covers the estimator copy.
- `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/learning-lab.md`, `apps-script/README.md`, `course/README.md`, and `parser/README.md` updated for Phase 4. They record the project owner's report of a successful live Phase 3B run and add a Phase 4 live checklist, which hasn't been run yet.
- `docs/learning-lab.md`: removed a duplicated copy of Exercise 5. `CLAUDE.md`: removed a duplicated "Google Apps Script" conventions section.

- CI gains a `parser` job (Node.js 22, `npm test`). The Python job is unchanged.
- The CI `parser` job also runs the Apps Script adapter tests and the drift check.
- `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/learning-lab.md`, `parser/README.md`, and `course/README.md` updated for Phase 3B. Live Google Apps Script verification is listed as a pending manual checkpoint.
- `.gitignore` excludes `apps-script/.clasp.json`.
- `.editorconfig` uses two-space indentation for JavaScript.
- `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/roadmap.md`, and `docs/learning-lab.md` updated for Phase 3A. They describe the implemented parser, the JavaScript conventions, and a planned parser exercise. Phase 3B and Phase 4 remain planned.
- `docs/architecture.md`, `docs/roadmap.md`, `docs/learning-lab.md`, and `README.md` updated for Phase 2. They now describe the master script as the authoritative source, mark Phase 2 complete, and outline a planned Exercise 3.

### Fixed

- The Mermaid architecture diagram on the GitHub Pages home page showed as source code. GitHub Pages emits a `mermaid` fence as a bare `<pre><code class="language-mermaid">` because Rouge has no Mermaid lexer, but the loader only looked for Rouge's wrapped `div.language-mermaid` form. So it found nothing and never loaded Mermaid. `_includes/lab-mermaid.html` now handles both shapes. It renders each diagram before replacing its source, so a failed render or an unreachable CDN leaves the source visible. `scripts/lab-docs.mjs --check` now checks that the layout includes the loader and that the loader supports both shapes and loads and initializes Mermaid once.
