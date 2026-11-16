# Exercise 1: Inspect the source

**Time:** 10 minutes
**Objective:** find the structure in the master production script, and see why one tagged source is safer than several hand-maintained scripts.
**Prerequisites:** [Exercise 0](00-setup.md). Run the commands from the repository root.

## Background: three production roles

A video course is produced by several people, and each needs different parts of the script:

| Role | Who uses it | What they need |
|---|---|---|
| **ONSET** | The presenter, on camera, reading from a teleprompter | Only the words to say, with pauses |
| **MOTION** | The motion-graphics designer | What each animation should show, plus the voiceover it plays under |
| **SCREENCAST** | The person recording the screen | What to click and type, what to highlight, and the voiceover |

If each role had its own script, every wording change would have to be made three times, by hand, without mistakes. Instead, this project keeps **one master script**, tags each part with its role, and generates the role documents from it.

## Steps

1. **Open the script.** Open [`course/master-script.md`](https://github.com/kenwalger/cellar-api/blob/main/course/master-script.md) in your editor. Despite the `.md` extension, it's plain text: structure comes only from literal lines, never from Markdown formatting. The grammar is in [`course/README.md`](https://github.com/kenwalger/cellar-api/blob/main/course/README.md#script-grammar).

2. **Find the headings.** Line 1 is the course title. Then list the stage and video headings:

   ```bash
   grep -nE '^(Stage|Video) [0-9]+:' course/master-script.md
   ```

   *Expected:* 2 stage headings (lines 5 and 191) and 6 video headings, three under each stage.

3. **Count the production sections.** A section opens with `[ONSET]`, `[MOTION]`, or `[SCREENCAST]` on its own line and closes with `[/ONSET]`, `[/MOTION]`, or `[/SCREENCAST]`:

   ```bash
   grep -c '^\[ONSET\]$' course/master-script.md
   grep -c '^\[MOTION\]$' course/master-script.md
   grep -c '^\[SCREENCAST\]$' course/master-script.md
   ```

   *Expected:* 6, 3, and 4, which is 13 sections.

4. **Read one video with two roles.** Go to `Video 2: Requests and Responses` (line 57). It has an ONSET section, then a SCREENCAST section. Here's a shortened excerpt (`…` marks omitted lines):

   ```text
   Video 2: Requests and Responses

   [ONSET]

   In the last video, we described an API as a counter where a client asks for something and gets an answer. …

   [PAUSE]

   The API answers with a response. …

   [/ONSET]

   [SCREENCAST]

   [ACTION]

   With the API running locally, open http://127.0.0.1:8000/docs in a browser.

   [VOICEOVER]

   This page is the interactive documentation for our winery API. …

   [HIGHLIGHT]

   The response code 200 and the response body:

   {"batch_id": "2026-014", "name": "North Block Pinot Noir", …}
   …
   [/SCREENCAST]
   ```

5. **Tell sections from annotations.** Sections (`[ONSET]` … `[/ONSET]`) are the top level, and they decide **which document** content goes to. Annotations live *inside* a section and say **what kind of content** follows:

   | Annotation | Kind | Spoken? | Allowed in |
   |---|---|---|---|
   | `[ACTION]` | Block: what the screen recorder does | No | SCREENCAST |
   | `[VISUAL]` | Block: what the animation shows | No | MOTION |
   | `[VOICEOVER]` | Block: narration over the visuals | **Yes** | MOTION, SCREENCAST |
   | `[HIGHLIGHT]` | Block: what to emphasize on screen | No | MOTION, SCREENCAST |
   | `[PAUSE]` | Cue: a deliberate pause, with no content | No | All three |

   A block runs until the next block annotation or the end of its section. Annotations have no closing tags. Count them:

   ```bash
   grep -c '^\[ACTION\]$' course/master-script.md
   grep -c '^\[VOICEOVER\]$' course/master-script.md
   grep -c '^\[PAUSE\]$' course/master-script.md
   ```

   *Expected:* 12 `ACTION`, 31 `VOICEOVER`, and 6 `PAUSE`. (`VISUAL` is 11 and `HIGHLIGHT` is 13.) You'll get the same numbers from the parser in Exercise 2, by a completely different route.

6. **Find the repeated section.** Go to `Video 2: Handling Errors` (line 251). Its sections are ONSET, MOTION, SCREENCAST, and then **ONSET again** (line 381). A video can repeat a role, and order matters: the presenter introduces the topic, the animation and screen recording follow, and the presenter wraps up. Check that the same sequence is listed for this video in [`course/fixtures/expected-structure.json`](https://github.com/kenwalger/cellar-api/blob/main/course/fixtures/expected-structure.json), an outline written by hand *before* the script.

## Expected results

- 2 stages, 6 videos, and 13 sections: 6 ONSET, 3 MOTION, and 4 SCREENCAST.
- Stage 2, Video 2 has the section sequence ONSET, MOTION, SCREENCAST, ONSET.

## Reflection

- A presenter reads from a teleprompter while looking at the camera. What goes wrong if their script also contains `[ACTION] Expand GET /api/v1/batches/{batch_id}`?
- Suppose the ONSET, MOTION, and SCREENCAST scripts were three separate documents, and a reviewer fixed a factual error in one of them. What would have to happen for the other two to stay correct, and who would notice if it didn't?

## Evidence to capture

A short excerpt of one video that shows at least two production roles, such as the Stage 1, Video 2 excerpt above, in your editor or in a Google Doc. See item 1 in the [evidence guide](evidence/README.md).

## Completion criterion

You can point to one stage heading, one video heading, one section of each type, one example of each annotation, and the repeated ONSET section in Stage 2, Video 2.

**Next:** [Exercise 2: Parse and validate](02-parse-and-validate.md)
