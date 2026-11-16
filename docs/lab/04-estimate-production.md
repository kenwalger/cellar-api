# Exercise 4: Estimate production

**Time:** 12 minutes
**Objective:** produce a narration-length estimate from the script, change its assumptions, and tell what was counted from what was assumed.
**Prerequisites:** [Exercise 3](03-break-the-contract.md). Run the commands from the `production/` folder:

```bash
cd production
```

## How the estimate works

The estimator reads the parser's IR. It never rereads the script text. It does three things:

1. **Counts spoken words.** Only ONSET narration and `VOICEOVER` blocks are spoken, because the grammar says so. `ACTION`, `VISUAL`, and `HIGHLIGHT` directions, headings, and tags aren't counted. A word is any whitespace-separated token with at least one letter or digit.
2. **Converts words to time** at an assumed speaking rate: seconds = words × 60 ÷ words per minute. You can optionally add a fixed allowance for each SCREENCAST section.
3. **Flags long videos.** A video is flagged when its estimate is strictly **over** the threshold (3 minutes by default). A video exactly at the threshold isn't flagged.

The full method is in [`production/README.md`](../../production/README.md).

## Steps

1. **Run the baseline.** Save the default estimate:

   ```bash
   node src/print-estimate.js ../course/master-script.md > ../lab-work/estimate-140.json
   ```

   Open `lab-work/estimate-140.json`. Look at `config` (140 words per minute, 3-minute threshold, 0-second allowance), then `videos`, `totals`, `warnings`, and `assumptions`. Durations are kept at full precision, such as `284.57142857142856`, and rounded only for display. Here are the figures in a table:

   <!-- lab-estimate -->
   | Video | Spoken words | Estimate (seconds) | Shown as | Over 3 min 0 s? |
   |---|---:|---:|---|---|
   | Stage 1, Video 1: What Is an API? | 273 | 117 | 1 min 57 s | No |
   | Stage 1, Video 2: Requests and Responses | 287 | 123 | 2 min 3 s | No |
   | Stage 1, Video 3: Understanding JSON | 246 | 105.43 | 1 min 45 s | No |
   | Stage 2, Video 1: Making API Requests | 280 | 120 | 2 min 0 s | No |
   | Stage 2, Video 2: Handling Errors | 664 | 284.57 | 4 min 45 s | **Yes** |
   | Stage 2, Video 3: Wrapping Up | 228 | 97.71 | 1 min 38 s | No |
   | **Course** | **1978** | **847.71** | **14 min 8 s** | 1 video |

   Stage 2, Video 2 (*Handling Errors*) is long on purpose, so the threshold has something to catch. It's the only warning, with code `LONG_VIDEO_ESTIMATE`.

2. **Change the speaking rate.** Assume a faster presenter:

   ```bash
   node src/print-estimate.js ../course/master-script.md '{"wordsPerMinute": 160}' > ../lab-work/estimate-160.json
   ```

   <!-- lab-estimate options='{"wordsPerMinute": 160}' -->
   | Video | Spoken words | Estimate (seconds) | Shown as | Over 3 min 0 s? |
   |---|---:|---:|---|---|
   | Stage 1, Video 1: What Is an API? | 273 | 102.38 | 1 min 42 s | No |
   | Stage 1, Video 2: Requests and Responses | 287 | 107.63 | 1 min 48 s | No |
   | Stage 1, Video 3: Understanding JSON | 246 | 92.25 | 1 min 32 s | No |
   | Stage 2, Video 1: Making API Requests | 280 | 105 | 1 min 45 s | No |
   | Stage 2, Video 2: Handling Errors | 664 | 249 | 4 min 9 s | **Yes** |
   | Stage 2, Video 3: Wrapping Up | 228 | 85.5 | 1 min 26 s | No |
   | **Course** | **1978** | **741.75** | **12 min 22 s** | 1 video |

   Compare the two files:

   ```bash
   git diff --no-index ../lab-work/estimate-140.json ../lab-work/estimate-160.json
   ```

   Every line marked `-` or `+` is the speaking rate, a duration, or a message that quotes one of them. `spokenWordCount` lines appear only as unchanged context, never marked `-` or `+`, because the words didn't change. Only an assumption did. (`git diff --no-index` exits with status 1 when files differ. That's normal.)

3. **Restore the default.** There's nothing to undo. Options apply only to the run you give them to. Running without options gives the baseline again, and the script was never touched.

4. **Add a screencast allowance.** The default allowance is 0 seconds, which makes the estimate narration-only. Nobody has measured how long the on-screen actions take. Before you run this, predict which videos will go over three minutes with 60 seconds added for each SCREENCAST section:

   ```bash
   node src/print-estimate.js ../course/master-script.md '{"screencastAllowanceSecondsPerSection": 60}' > ../lab-work/estimate-allowance.json
   ```

   <!-- lab-estimate options='{"screencastAllowanceSecondsPerSection": 60}' -->
   | Video | Spoken words | Estimate (seconds) | Shown as | Over 3 min 0 s? |
   |---|---:|---:|---|---|
   | Stage 1, Video 1: What Is an API? | 273 | 117 | 1 min 57 s | No |
   | Stage 1, Video 2: Requests and Responses | 287 | 183 | 3 min 3 s | **Yes** |
   | Stage 1, Video 3: Understanding JSON | 246 | 165.43 | 2 min 45 s | No |
   | Stage 2, Video 1: Making API Requests | 280 | 180 | 3 min 0 s | No |
   | Stage 2, Video 2: Handling Errors | 664 | 344.57 | 5 min 45 s | **Yes** |
   | Stage 2, Video 3: Wrapping Up | 228 | 97.71 | 1 min 38 s | No |
   | **Course** | **1978** | **1087.71** | **18 min 8 s** | 2 videos |

   - **Stage 1, Video 2** goes from 123 s to 183 s, which is over 180 s, so it's flagged.
   - **Stage 2, Video 1** lands at **exactly** 180 s. It isn't flagged, because the rule is strictly greater than.
   - In `lab-work/estimate-allowance.json`, each warning now has `"includesScreencastAllowance": true`, and the `SCREENCAST_ALLOWANCE` assumption states the 60 seconds.

5. **Try an invalid setting.**

   ```bash
   node src/print-estimate.js ../course/master-script.md '{"wordsPerMinute": 0}'
   ```

   *Expected:* the command fails with `RangeError: Invalid estimator configuration: wordsPerMinute must be a finite number greater than 0, not 0.` The estimator never falls back to a default. A misspelled option name, such as `wordsPerMinuet`, is rejected the same way.

## Facts, calculations, and assumptions

Every number in the estimate is one of these four kinds. Keep them apart when you read a Production Summary:

| Kind | Examples | Where it comes from |
|---|---|---|
| **Observed in the script** | Spoken word counts (1978 for the course, 664 for Stage 2, Video 2), section counts | Counted from the IR. The same script always gives the same counts. |
| **Calculated** | Narration seconds, totals, which videos are flagged | Arithmetic on the counts and the configuration |
| **Assumed** | 140 words per minute, the 3-minute threshold, the 0- or 60-second allowance | Configuration. Change it, and the calculations change. The script doesn't. |
| **Not measured at all** | The finished video's real length | Pacing, retakes, pauses, transitions, editing, and animation timing aren't modeled. The `UNMODELED_FACTORS` assumption says so. |

That's why the output carries an `assumptions` list with codes such as `SPEAKING_RATE` and `SCREENCAST_ALLOWANCE`. A number shown without its assumptions looks like a measurement.

## Reflection

- A producer says, "The summary says Stage 2, Video 2 runs 4 min 45 s." What's wrong with that sentence, and how would you rephrase it?
- The allowance is the same for every SCREENCAST section, whatever it contains. What evidence would you want before setting it to anything other than 0?

## Evidence to capture

The baseline and the 60-second-allowance results side by side, for example the two tables above or the two JSON files, showing that the word counts are identical while durations and warnings differ. See items 4 and 5 in the [evidence guide](evidence/README.md).

## Completion criterion

You've produced the three estimate files in `lab-work/`, explained why Stage 2, Video 1 isn't flagged at exactly 180 s, and sorted the figures into observed, calculated, and assumed.

**Next:** [Exercise 5: Provenance and regeneration](05-provenance-and-regeneration.md)
