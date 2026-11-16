# Exercise 2: Parse and validate

**Time:** 10 minutes
**Objective:** watch the human-readable script become structured data (the intermediate representation, or IR), read the diagnostics, and confirm the structure matches an independent outline.
**Prerequisites:** [Exercise 1](01-inspect-the-source.md). Run the commands from the `parser/` folder:

```bash
cd parser
```

## Steps

1. **Print an outline.** The parser reads the whole script and returns two things: the IR and a list of diagnostics. This command prints a short outline of both:

   <!-- lab-output cwd="parser" -->
   ```bash
   node src/print-outline.js ../course/master-script.md
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
       ONSET      lines 381-387     2 narration paragraphs
     Video 3: Wrapping Up (line 389)
       ONSET      lines 391-409     7 narration paragraphs, PAUSE 1

   Totals: 2 stages, 6 videos, 13 sections (ONSET 6, MOTION 3, SCREENCAST 4)
   Annotations: ACTION 12, VISUAL 11, VOICEOVER 31, HIGHLIGHT 13, PAUSE 6
   Diagnostics: none
   ```

   (`npm run print-outline -- ../course/master-script.md` does the same thing.)

   Check three things:
   - **The totals match Exercise 1.** You counted the tags with `grep`. The parser built a tree from the same lines. Both give 13 sections, 31 `VOICEOVER` blocks, and 6 `PAUSE` cues.
   - **Order is preserved.** Stage 2, Video 2 lists ONSET, MOTION, SCREENCAST, ONSET, in source order, with each section's opening and closing line.
   - **`Diagnostics: none`.** There are no errors or warnings, so this script may be used to generate documents.

2. **Look at the IR itself.** Save the full IR as JSON and open it in your editor:

   ```bash
   node src/print-ir.js ../course/master-script.md > ../lab-work/master-ir.json
   ```

   Search the file for `"Handling Errors"`. You'll find the video's `sections` array. Each section has a `type`, its `sourceLine` and `endLine`, and `content`. In MOTION and SCREENCAST sections, `content` is a list of blocks (`"kind": "block"`, with a `type` such as `VOICEOVER`), each holding the exact source lines. In ONSET sections, it's narration text and `PAUSE` cues. Every item records its `sourceLine`, so any later message can point at the line it came from. The IR format is documented in [`parser/README.md`](../../parser/README.md#intermediate-representation).

3. **Confirm it's deterministic.** Parse again and compare the two files:

   ```bash
   node src/print-ir.js ../course/master-script.md > ../lab-work/master-ir-2.json
   git diff --no-index --stat ../lab-work/master-ir.json ../lab-work/master-ir-2.json && echo identical
   ```

   *Expected:* `identical`. The parser uses no clock, randomness, or network, so the same input always gives the same output.

4. **Check against the independent outline.** [`course/fixtures/expected-structure.json`](../../course/fixtures/expected-structure.json) was written by hand from the course plan, before the script existed. The parser's acceptance tests compare the parsed structure with it:

   ```bash
   node --test tests/fixtures.test.js
   ```

   *Expected:* 13 tests pass, including `matches the independent expected-structure fixture exactly` and `preserves the repeated ONSET section in Stage 2, Video 2`. The fixture is never regenerated from parser output. If it were, it would agree with the parser by definition and prove nothing.

5. **See that the parser doesn't understand winemaking.** [`examples/any-content-script.txt`](examples/any-content-script.txt) is a tiny script about pottery. It follows the same grammar:

   <!-- lab-output cwd="parser" -->
   ```bash
   node src/print-outline.js ../docs/lab/examples/any-content-script.txt
   ```

   ```text
   Stage 1: Pottery Basics (line 1)
     Video 1: Centering the Clay (line 3)
       ONSET      lines 5-13        2 narration paragraphs, PAUSE 1
       SCREENCAST lines 15-25       ACTION 1, VOICEOVER 1

   Totals: 1 stage, 1 video, 2 sections (ONSET 1, MOTION 0, SCREENCAST 1)
   Annotations: ACTION 1, VISUAL 0, VOICEOVER 1, HIGHLIGHT 0, PAUSE 1
   Diagnostics: none
   ```

   The parser checks the **structural contract**, which is the headings, tags, and annotations and where they're allowed. It never interprets what the narration means, and it never decides what's spoken from the wording. Spoken text is whatever the grammar says is spoken: ONSET prose and `VOICEOVER` blocks.

## Expected results

- The master script has 2 stages, 6 videos, and 13 sections (ONSET 6, MOTION 3, SCREENCAST 4), with `Diagnostics: none`.
- Two parses of the same file are identical.
- The fixture tests pass.

## Reflection

- The outline and `grep` agree on the counts. Why is it still useful to have the parser's acceptance tests compare against a separately written fixture?
- Why does every IR item keep its source line number, even though the generated documents don't show line numbers?

## Evidence to capture

The terminal showing the outline for the master script, from the Stage 2 heading down to `Diagnostics: none`. See item 2 in the [evidence guide](evidence/README.md).

## Completion criterion

You've seen `Diagnostics: none` and the 13-section totals, found the `Handling Errors` sections in the IR, and confirmed that two parses are identical.

**Next:** [Exercise 3: Break the contract](03-break-the-contract.md)
