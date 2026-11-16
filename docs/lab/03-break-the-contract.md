# Exercise 3: Break the contract

**Time:** 10 minutes
**Objective:** see how the parser reports broken structure, and why validation runs before anything is generated.
**Prerequisites:** [Exercise 2](02-parse-and-validate.md). Run the commands from the `parser/` folder unless a step says otherwise.

> **Never edit `course/master-script.md`.** It's the authoritative source. This exercise breaks a *copy* in `lab-work/`, which Git ignores.

## Steps

1. **Run the parser on deliberately broken scripts.** [`course/fixtures/malformed-script.md`](https://github.com/kenwalger/cellar-api/blob/main/course/fixtures/malformed-script.md) holds four tiny scripts, each with one defect. Run the outline on the whole file:

   <!-- lab-output cwd="parser" exit="1" -->
   ```bash
   node src/print-outline.js ../course/fixtures/malformed-script.md
   ```

   ```text
   Stage 1: Fixture Stage (line 9)
     Video 1: Unclosed Section (line 11)
       ONSET      lines 13-unclosed 3 narration paragraphs
   Stage 1: Fixture Stage (line 21)
     Video 1: Stray Closing Tag (line 23)
       ONSET      lines 25-29       1 narration paragraph
   Stage 1: Fixture Stage (line 35)
     Video 1: Nested Section (line 37)
       ONSET      lines 39-55       3 narration paragraphs
   Stage 1: Fixture Stage (line 59)
     Video 1: Unknown Annotation (line 61)
       SCREENCAST lines 63-73       ACTION 1

   Totals: 4 stages, 4 videos, 4 sections (ONSET 3, MOTION 0, SCREENCAST 1)
   Annotations: ACTION 1, VISUAL 0, VOICEOVER 0, HIGHLIGHT 0, PAUSE 0
   Diagnostics: 9 errors, 0 warnings
     error   UNCLOSED_SECTION at line 13: The ONSET section opened on line 13 was not closed before the heading on line 21. Add [/ONSET] where the section ends.
     error   UNEXPECTED_CLOSING_TAG at line 31: [/SCREENCAST] on line 31 has no matching [SCREENCAST] opening tag.
     error   CONTENT_OUTSIDE_SECTION at line 33: Text on line 33 is outside any production section. Move it into an [ONSET], [MOTION], or [SCREENCAST] section.
     error   NESTED_SECTION at line 43: [MOTION] on line 43 opens a section inside the ONSET section opened on line 39. Close it with [/ONSET] first.
     error   ANNOTATION_NOT_ALLOWED at line 45: [VISUAL] on line 45 isn't allowed in a ONSET section. Allowed: [PAUSE].
     error   ANNOTATION_NOT_ALLOWED at line 49: [VOICEOVER] on line 49 isn't allowed in a ONSET section. Allowed: [PAUSE].
     error   UNEXPECTED_CLOSING_TAG at line 53: [/MOTION] on line 53 doesn't match the ONSET section opened on line 39.
     error   CONTENT_OUTSIDE_SECTION at line 57: Text on line 57 is outside any production section. Move it into an [ONSET], [MOTION], or [SCREENCAST] section.
     error   UNKNOWN_ANNOTATION at line 69: [NARRATION] on line 69 is not a known tag. Annotations are [ACTION], [VISUAL], [VOICEOVER], [HIGHLIGHT], [PAUSE].
   ```

   The command exits with status 1, because there are errors. Each diagnostic has a stable **code**, a **line**, and a message for people. Find the four documented defects:

   | Case | Defect | First error |
   |---|---|---|
   | 1 | `[ONSET]` is never closed | `UNCLOSED_SECTION` at its opening tag |
   | 2 | A `[/SCREENCAST]` with nothing open | `UNEXPECTED_CLOSING_TAG` |
   | 3 | `[MOTION]` opens inside an open `[ONSET]` | `NESTED_SECTION` |
   | 4 | `[NARRATION]` isn't a known annotation | `UNKNOWN_ANNOTATION` |

   The other errors are **follow-on errors**. After a nested tag, for example, the parser keeps reading lines as part of the outer ONSET section, so `[VISUAL]` and `[VOICEOVER]` are reported as not allowed there. The `=== Case N ===` delimiter lines belong to the fixture file, not the grammar, which is why lines 33 and 57 are reported as text outside a section. The tests split the file and check each case's *first* error (see [`course/fixtures/README.md`](https://github.com/kenwalger/cellar-api/blob/main/course/fixtures/README.md)). All codes are listed in [`parser/README.md`](https://github.com/kenwalger/cellar-api/blob/main/parser/README.md#diagnostics).

2. **Make your own broken copy.**

   ```bash
   cp ../course/master-script.md ../lab-work/missing-close.md
   ```

   Open `lab-work/missing-close.md` in your editor. Go to line 387. It's the `[/ONSET]` that closes the second ONSET section of Stage 2, Video 2, just above `Video 3: Wrapping Up`. Delete that one line and save.

3. **Parse the copy.**

   <!-- lab-output cwd="parser" exit="1" copy="course/master-script.md" to="lab-work/missing-close.md" delete-line="387" delete-text="[/ONSET]" -->
   ```bash
   node src/print-outline.js ../lab-work/missing-close.md
   ```

   ```text
   Stage 1: Understanding the Interface (line 5)
     Video 1: What Is an API? (line 7)
       ONSET      lines 9-19        3 narration paragraphs, PAUSE 1
       MOTION     lines 21-55       VISUAL 3, VOICEOVER 4, HIGHLIGHT 1
     Video 2: Requests and Responses (line 57)
       ONSET      lines 59-71       4 narration paragraphs, PAUSE 1
       SCREENCAST lines 73-113      ACTION 3, VOICEOVER 4, HIGHLIGHT 2
     Video 3: Understanding JSON (line 115)
       MOTION     lines 117-151     VISUAL 4, VOICEOVER 4
       SCREENCAST lines 153-189     ACTION 2, VOICEOVER 3, HIGHLIGHT 2, PAUSE 1
   Stage 2: Working with an API (line 191)
     Video 1: Making API Requests (line 193)
       ONSET      lines 195-201     2 narration paragraphs
       SCREENCAST lines 203-249     ACTION 3, VOICEOVER 5, HIGHLIGHT 3
     Video 2: Handling Errors (line 251)
       ONSET      lines 253-263     3 narration paragraphs, PAUSE 1
       MOTION     lines 265-307     VISUAL 4, VOICEOVER 5, HIGHLIGHT 1
       SCREENCAST lines 309-379     ACTION 4, VOICEOVER 6, HIGHLIGHT 4, PAUSE 1
       ONSET      lines 381-unclosed 2 narration paragraphs
     Video 3: Wrapping Up (line 388)
       ONSET      lines 390-408     7 narration paragraphs, PAUSE 1

   Totals: 2 stages, 6 videos, 13 sections (ONSET 6, MOTION 3, SCREENCAST 4)
   Annotations: ACTION 12, VISUAL 11, VOICEOVER 31, HIGHLIGHT 13, PAUSE 6
   Diagnostics: 1 error, 0 warnings
     error   UNCLOSED_SECTION at line 381: The ONSET section opened on line 381 was not closed before the heading on line 388. Add [/ONSET] where the section ends.
   ```

   There's exactly one error: `UNCLOSED_SECTION` at line 381, the opening tag of the section you broke. The outline still shows 13 sections, and that section is marked `unclosed`. The parser recovers so it can report as much as possible, but it never closes a section silently. Any error-level diagnostic means the script isn't valid.

4. **Try to estimate the broken copy.** Switch to the `production/` folder:

   ```bash
   cd ../production
   ```

   <!-- lab-output cwd="production" exit="1" copy="course/master-script.md" to="lab-work/missing-close.md" delete-line="387" delete-text="[/ONSET]" -->
   ```bash
   node src/print-estimate.js ../lab-work/missing-close.md
   ```

   ```text
   [
     {
       "code": "UNCLOSED_SECTION",
       "severity": "error",
       "line": 381,
       "message": "The ONSET section opened on line 381 was not closed before the heading on line 388. Add [/ONSET] where the section ends."
     }
   ]
   The script has parser errors, so it can't be estimated.
   ```

   The estimator only accepts a document that parsed without errors, so this command prints the diagnostic and stops without producing numbers.

5. **See the generation gate.** Parsing *reports* problems. A separate gate *decides* whether generation may go ahead. In the Apps Script code, `Validation.prepareRun` sets `canGenerate` to false when there's any error, and `Generator.generate` returns `blocked` before it touches Google Drive. The adapter's tests prove this offline with test doubles that record every Drive and Docs call:

   ```bash
   cd ../apps-script
   node --test --test-name-pattern="before any service call" tests/generator.test.js
   ```

   *Expected:* 3 tests pass, including `error diagnostics block generation before any service call`. That test generates from a script with an error, then checks that the fake Drive recorded **no calls at all**: no folder, no documents, and no manifest.

6. **Confirm the master is untouched.** From the repository root:

   ```bash
   cd ..
   git status --short course/
   ```

   *Expected:* no output.

## What this does and doesn't show

- **Shown here:** the parser reports each structural defect with a code and a line. The estimator refuses invalid input. The generator's logic stops before any service call, as tested with test doubles.
- **Not shown here:** that a real Google account sees no new folder. Local parsing can't prove anything about Google Drive. For that, try a blocked run in [Exercise 6](06-google-docs-extension.md).

## Reflection

- Why is it safer to block generation entirely than to generate documents from the parts of the script that *did* parse?
- The diagnostic for your copy names line 381, but you deleted line 387. Why does the parser report the opening tag instead of the place where the closing tag should have been?

## Evidence to capture

The terminal showing the `UNCLOSED_SECTION` diagnostic for your copy, with its code, line, and message. See item 3 in the [evidence guide](evidence/README.md).

## Completion criterion

You've seen the four fixture defects, produced `UNCLOSED_SECTION` at line 381 from your own copy, seen the estimator refuse it, and confirmed with `git status` that `course/` is unchanged.

**Next:** [Exercise 4: Estimate production](04-estimate-production.md)
