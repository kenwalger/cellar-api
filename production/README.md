# production/

A portable, deterministic **production estimator** for the master production script. It reads the parser's intermediate representation (IR), counts spoken words for each video, estimates narration time, and flags videos whose estimate is over a configurable threshold. The Apps Script tooling in [`apps-script/`](../apps-script) turns the result into the fourth generated document, the **Production Summary**.

**Status: Phase 4. Implemented and tested offline with Node.js.** The estimator runs inside Google Apps Script as a byte-for-byte copy, `apps-script/ProductionEstimator.js`. Running it in a live Google account is part of the [live verification checklist](../apps-script/README.md#live-verification-checklist).

The estimate is **not** a prediction of finished video length. It's a reproducible calculation from stated assumptions. See [What the estimate leaves out](#what-the-estimate-leaves-out).

## Layout

```text
production/
├── package.json                  no dependencies; "npm test" runs node --test
├── src/
│   ├── production-estimator.cjs  portable core: word counting, configuration, estimation, display
│   ├── index.js                  ESM entry point for Node.js
│   └── print-estimate.js         parses a script file and prints its estimate as JSON
└── tests/
    ├── word-count.test.js        the word-count policy
    ├── estimator.test.js         classification, configuration, durations, warnings, input handling
    ├── fixtures.test.js          acceptance tests against the master script
    ├── portability.test.js       the core runs with no module system
    └── helpers.js                Node-only file loading and test-script helpers
```

Word counting and estimation share one file, `production-estimator.cjs`, rather than separate `estimator.js` and `word-count.js` files. That follows the parser's pattern: Google Apps Script has no module system, so one self-contained file is the simplest thing to copy there, and Node and Apps Script are guaranteed to use the same counting code.

## Commands

Requires Node.js 22 or newer. There's nothing to install.

```bash
cd production
npm test                                                     # run all estimator tests
npm run print-estimate -- ../course/master-script.md         # estimate with the defaults
npm run print-estimate -- ../course/master-script.md '{"wordsPerMinute": 160}'
```

`print-estimate` exits with status 1 if the script has parser errors.

## Public API

```javascript
import { estimateProduction, checkOptions, countWords, formatDuration } from "./src/index.js";
import { parseProductionScript } from "../parser/src/index.js";

const { document, diagnostics } = parseProductionScript(sourceText);
// Only estimate a document with no error diagnostics.
const estimate = estimateProduction(document, { wordsPerMinute: 150 });
```

| Export | Purpose |
|---|---|
| `estimateProduction(document, options)` | Returns the estimate described [below](#output). Doesn't modify `document` or `options`. |
| `checkOptions(options)` | Returns an array of problems with `options`, empty if they're valid. Never throws. |
| `countWords(text)` | Words in one line of text, under the [word-count policy](#word-count-policy). |
| `spokenTokens(text)` | The tokens `countWords` counts, in order and unchanged. |
| `isTechnicalToken(token)` | True if a counted token looks like a URL, path, identifier, or code. |
| `formatDuration(seconds)` | Display text, such as `4 min 45 s`. See [Rounding](#rounding). |
| `DEFAULT_OPTIONS` | The frozen defaults. |
| `WarningCode` | Stable warning codes. Currently only `LONG_VIDEO_ESTIMATE`. |
| `SCHEMA_VERSION` | The output schema version, currently `1`. |

### Input and errors

The input is the parser's **document IR**, not script text. The estimator never reparses or revalidates the script. The parser and the generation gate decide whether a document is valid, so **call it only when the parse had no error diagnostics.** As a second line of defense, it refuses to estimate content it can't classify:

| Situation | Thrown |
|---|---|
| `document` isn't an object with a `stages` array | `TypeError` |
| Invalid options (see [Configuration](#configuration)) | `RangeError` whose message starts with `Invalid estimator configuration:` and lists every problem |
| A section with `endLine: null` (unclosed, which means the parse had errors) | `Error` |
| An unknown section type, block type, or content kind, whose spoken status can't be determined | `Error` that names it |

It never guesses whether unknown content is spoken, and it never estimates part of a document.

## Configuration

| Option | Default | Rule |
|---|---|---|
| `wordsPerMinute` | `140` | A finite number greater than 0 |
| `longVideoThresholdMinutes` | `3` | A finite number greater than 0 |
| `screencastAllowanceSecondsPerSection` | `0` | A finite number of 0 or more |

- `options` may be omitted. Omitted fields take their defaults.
- Values must be JavaScript numbers. Strings, `null`, `NaN`, and `Infinity` are rejected.
- **Unknown fields are rejected**, so a misspelled option such as `wordsPerMinuet` is an error instead of being silently ignored.
- Invalid options never fall back to the defaults. `estimateProduction` throws, and `checkOptions` reports every problem at once.

**Why the screencast allowance defaults to 0.** No evidence-based figure for how long on-screen actions take has been established. A zero default makes the baseline a **narration-only estimate**. It isn't a claim that screen actions take no time. Set an allowance explicitly when you have a figure you trust. The estimator doesn't infer time from the number of `ACTION`, `VISUAL`, or `HIGHLIGHT` annotations, and it doesn't estimate motion graphics production work.

In Apps Script, these options come from Script Properties. See [`apps-script/README.md`](../apps-script/README.md#4-configure-the-master-document).

## Spoken content

What counts as spoken comes **only from the grammar** ([`course/README.md`](../course/README.md#spoken-words-versus-non-spoken-content)), as represented in the IR:

| Section | Counted | Not counted |
|---|---|---|
| ONSET | Every `text` item | `PAUSE` cues |
| MOTION | `text` items in `VOICEOVER` blocks | `VISUAL` and `HIGHLIGHT` blocks, `PAUSE` cues |
| SCREENCAST | `text` items in `VOICEOVER` blocks | `ACTION` and `HIGHLIGHT` blocks, `PAUSE` cues |

Stage and video headings, front matter, and the tags themselves aren't in any section's content, so they're never counted. Text is never treated as narration because it looks like a sentence. A URL or JSON example in an `ACTION` or `HIGHLIGHT` block is never counted. A URL that the script puts inside narration *is* counted, because the grammar says that line is spoken.

## Word-count policy

**A word is a whitespace-separated token that contains at least one Unicode letter or digit.** Each spoken text line is split on any run of whitespace (JavaScript `\s`, which includes tabs and no-break spaces), and tokens without a letter or digit (`\p{L}` or `\p{N}`) are dropped.

| Case | Example | Words | Why |
|---|---|---|---|
| Ordinary words | `The client sends a request.` | 5 | Trailing punctuation stays attached to its word |
| Contractions | `don't`, `it’s` | 1 each | No whitespace inside |
| Hyphenated terms | `case-sensitive`, `key-value` | 1 each | No whitespace inside |
| Numbers | `200,` `21.4` `2026-014` | 1 each | Digits count as word characters |
| Punctuation alone | `—`, `...`, `:` | 0 | No letter or digit |
| Blank lines | `""`, `"   "` | 0 | No tokens |
| Unicode text | `Café`, `Ελληνικά` | 1 each | `\p{L}` covers every script |
| URLs, paths, code in narration | `/api/v1/batches`, `status=fermenting` | 1 each, as written | See below |

The goal is reproducible estimation, not linguistic accuracy. Known limitations:

- **Spoken form of symbols.** `/api/v1/batches` counts as one word, but it takes several words to say aloud. Each video reports a `technicalTokenCount`: counted tokens that contain one of `/ \ = _ { } [ ] < > @ #`. The Production Summary shows that number next to the word count so a reader knows where the estimate may be low. The count is informational. It doesn't change any duration.
- **Numbers.** `422` is one word, though it's said as "four twenty-two" or "four hundred twenty-two".
- **Languages written without spaces,** such as Japanese or Chinese, count one word per whitespace-separated run. The course is in English, so this doesn't affect it.
- **Hyphens and dashes.** A spaced dash (`a — b`) isn't a word, but an unspaced one (`a—b`) joins its neighbors into one token.

### Acceptance figures

The counts below were calculated by this policy from the current master script, at the default configuration. They match the spoken-word counts recorded during Phase 2 content authoring exactly. Those Phase 2 counts weren't produced by this estimator, so `tests/fixtures.test.js` uses them as an outside check of the policy.

| Video | Title | Phase 2 reference | Counted | Technical tokens | Narration at 140 WPM | Flagged at 3 min |
|---|---|---:|---:|---:|---:|---|
| Stage 1, Video 1 | What Is an API? | 273 | 273 | 0 | 117.00 s (1 min 57 s) | No |
| Stage 1, Video 2 | Requests and Responses | 287 | 287 | 1 | 123.00 s (2 min 3 s) | No |
| Stage 1, Video 3 | Understanding JSON | 246 | 246 | 2 | 105.43 s (1 min 45 s) | No |
| Stage 2, Video 1 | Making API Requests | 280 | 280 | 1 | 120.00 s (2 min 0 s) | No |
| Stage 2, Video 2 | Handling Errors | 666 | 666 | 0 | 285.43 s (4 min 45 s) | **Yes** |
| Stage 2, Video 3 | Wrapping Up | 228 | 228 | 3 | 97.71 s (1 min 38 s) | No |
| **Course** | | **1980** | **1980** | **7** | **848.57 s (14 min 9 s)** | **1 video** |

Stage totals: Stage 1 has 806 words (345.43 s), and Stage 2 has 1174 words (503.14 s).

With `screencastAllowanceSecondsPerSection: 60`, Stage 1, Video 2 also goes over (183 s). Stage 2, Video 1 lands at exactly 180 s, which isn't over the threshold, so it isn't flagged.

## Durations

For each video, at full floating-point precision:

```text
narrationDurationSeconds   = spokenWordCount × 60 / wordsPerMinute
screencastAllowanceSeconds = (number of SCREENCAST sections) × screencastAllowanceSecondsPerSection
estimatedDurationSeconds   = narrationDurationSeconds + screencastAllowanceSeconds
```

The multiplication happens before the division, so exact values stay exact. For example, 420 words at 140 WPM is exactly 180 seconds, which makes the threshold boundary reliable.

Stage totals are the sums of their videos' values, and course totals are the sums of every video's values, both added in document order. That's why the totals match the per-video numbers exactly before rounding.

### Rounding

The output contains unrounded numbers. Rounding happens only for display: `formatDuration` rounds to the nearest whole second, with halves rounding up, and shows minutes and seconds (`285.43` → `4 min 45 s`). Because of this:

- A flagged video can *display* as exactly the threshold (for example, 180.3 s shows as `3 min 0 s`).
- Rounded per-video values may not add up exactly to the rounded total.

## Warnings

A video gets a `LONG_VIDEO_ESTIMATE` warning when `estimatedDurationSeconds` is **strictly greater than** `longVideoThresholdMinutes × 60`. A video exactly at the threshold isn't flagged. Warnings are calculated, never forced: there's no expected number of them.

```javascript
{
  code: "LONG_VIDEO_ESTIMATE",
  stageNumber: 2,
  videoNumber: 2,
  title: "Handling Errors",
  estimatedDurationSeconds: 285.42857142857144,
  thresholdSeconds: 180,
  includesScreencastAllowance: false,   // true only if this video's allowance is > 0
  message: "Stage 2, Video 2 \"Handling Errors\": estimated 4 min 45 s is over the 3 min 0 s threshold (narration only)."
}
```

Tools should rely on `code` and the numeric fields. The `message` is written for people and may change. Warnings never block document generation.

## Output

`estimateProduction` returns plain JSON-compatible data:

```javascript
{
  schemaVersion: 1,
  config: { wordsPerMinute, longVideoThresholdMinutes, screencastAllowanceSecondsPerSection },
  stages: [{
    stageNumber, title, videoCount,
    sectionCounts: { ONSET, MOTION, SCREENCAST },
    spokenWordCount, technicalTokenCount,
    narrationDurationSeconds, screencastAllowanceSeconds, estimatedDurationSeconds,
    warningCount
  }],
  videos: [{                         // every video in document order
    stageNumber, videoNumber, title,
    sectionSequence: ["ONSET", "MOTION", "SCREENCAST", "ONSET"],
    sectionCounts: { ONSET: 2, MOTION: 1, SCREENCAST: 1 },
    spokenWordCount: 666, technicalTokenCount: 0,
    narrationDurationSeconds: 285.428..., screencastAllowanceSeconds: 0, estimatedDurationSeconds: 285.428...,
    warnings: [ /* LONG_VIDEO_ESTIMATE, if any */ ]
  }],
  totals: {
    stageCount, videoCount, sectionCounts,
    spokenWordCount, technicalTokenCount,
    narrationDurationSeconds, screencastAllowanceSeconds, estimatedDurationSeconds,
    videosOverThreshold
  },
  warnings: [ /* every video's warnings, in document order */ ],
  assumptions: [{ code, text }]       // NARRATION_ONLY, SPEAKING_RATE, SCREENCAST_ALLOWANCE,
                                       // THRESHOLD_RULE, WORD_COUNT_POLICY, UNMODELED_FACTORS
}
```

**Observed facts and estimates are kept apart.** `sectionSequence`, `sectionCounts`, `spokenWordCount`, and `technicalTokenCount` are facts observed in the script. The `...Seconds` fields and warnings are estimates that depend on `config`. `assumptions` states the method in words, with the configured values filled in.

### What the estimate leaves out

Presenter pacing variation, retakes, pauses (`[PAUSE]` has no assigned duration), screen transitions, unscripted demonstrations, editing decisions, animation timing, and production labor. The Production Summary says so in its methodology section.

## Apps Script integration

1. `scripts/sync-apps-script.mjs` copies `src/production-estimator.cjs` byte for byte to `apps-script/ProductionEstimator.js`. It also writes this package's version and the core's SHA-256 into `apps-script/GeneratedData.js` as `estimatorVersion` and `estimatorCoreSha256`, for the manifest.
2. `node scripts/sync-apps-script.mjs --check` (in CI) and `apps-script/tests/sync.test.js` fail if the copy has drifted.
3. `Config.js` reads the three settings from Script Properties and checks them with `checkOptions` before any document is opened.
4. `Generator.js` calls `estimateProduction` before the first Drive write, and `Summary.js` turns the result into the Production Summary document.

**After changing the core**, run `node scripts/sync-apps-script.mjs` and commit the regenerated `apps-script/` files with it.

## Portability

The core follows the same rules as the parser core: one classic script defining one global (`ProductionEstimator`), no `import`/`export`/`require`, no Node or browser APIs, no clocks or randomness, and no `?.` or `??`. `tests/portability.test.js` checks the source and runs the core in an empty `node:vm` context.

The word pattern uses a Unicode property escape (`/[\p{L}\p{N}]/u`, ES2018). Apps Script's V8 runtime is expected to support it, but that's confirmed only by the live checkpoint. If it weren't supported, `ProductionEstimator.js` would fail to load with a syntax error, and the run would stop before any write.
