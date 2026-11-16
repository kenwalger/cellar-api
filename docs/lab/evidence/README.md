# Evidence and screenshot guide

This guide lists what to capture while working through the lab, so that a learner can show their work and the project owner can illustrate the lab with **real** images.

**Inventory status: no screenshots have been captured yet.** [`docs/screenshots/`](../../screenshots) holds only a placeholder. Never add a generated, mocked-up, or edited-to-look-real image. Every screenshot must come from an actual run. Update the **Status** column when an image is added.

## Rules for every screenshot

- **Crop to the point.** Show only the window or panel that demonstrates the item.
- **Redact before saving.** Hide Google document, folder, file, and script IDs, and any URL containing one, as well as email addresses, profile pictures, account names, other files in your Drive, and browser tabs and bookmarks. Blur or block them out. Don't just crop to the edge.
- **Don't capture secrets.** Never capture access tokens, OAuth consent codes, or the Apps Script **Script properties** values. The property *names* are fine.
- **Keep text readable.** Use a zoom level at which the text can be read at the published width, and use PNG.
- **Name and describe it.** Use the suggested filename in `docs/screenshots/`, and use the suggested alt text, adjusted to what the image actually shows.

Terminal evidence (items 2 to 5) can be shared as text instead of an image. Copy it from the terminal, as long as it isn't retyped.

## Inventory

| # | Item | Lab | Status |
|---|---|---|---|
| 1 | Master script structure | Required (local) | Not captured |
| 2 | Successful parser validation | Required (local) | Not captured |
| 3 | Invalid-script diagnostic | Required (local) | Not captured |
| 4 | Default estimator output | Required (local) | Not captured |
| 5 | Changed estimator configuration | Required (local) | Not captured |
| 6 | Google Apps Script validation | Optional (Google) | Not captured |
| 7 | Generated Drive folder | Optional (Google) | Not captured |
| 8 | ONSET output | Optional (Google) | Not captured |
| 9 | MOTION output | Optional (Google) | Not captured |
| 10 | SCREENCAST output | Optional (Google) | Not captured |
| 11 | Production Summary | Optional (Google) | Not captured |
| 12 | Manifest | Local (example) or Google (live) | Not captured |

## Details

### 1. Master script structure

- **Exercise:** [1](../01-inspect-the-source.md)
- **Demonstrates:** one source document carries instructions for several production roles.
- **Visible:** `Video 2: Requests and Responses` with its `[ONSET]` section, a `[PAUSE]` cue, and the start of its `[SCREENCAST]` section with `[ACTION]` and `[VOICEOVER]` annotations. This can be in a text editor or in the master Google Doc.
- **Exclude:** editor sidebars showing personal paths, and Google account details.
- **Filename:** `lab-01-master-script-structure.png`
- **Alt text:** "The master script's Stage 1, Video 2, showing an ONSET section with a PAUSE cue followed by a SCREENCAST section with ACTION and VOICEOVER annotations."

### 2. Successful parser validation

- **Exercise:** [2](../02-parse-and-validate.md)
- **Demonstrates:** the parser turns the script into structure that matches the course outline, with no diagnostics.
- **Visible:** the `print-outline` output from `Stage 2: Working with an API` down to `Diagnostics: none`, including the totals line.
- **Exclude:** the shell prompt's user and machine name, if it shows them.
- **Filename:** `lab-02-parser-outline.png`
- **Alt text:** "Terminal output of the parser outline: Stage 2's three videos with their sections in order, then totals of 2 stages, 6 videos, and 13 sections, and Diagnostics: none."

### 3. Invalid-script diagnostic

- **Exercise:** [3](../03-break-the-contract.md)
- **Demonstrates:** broken structure produces a coded diagnostic with a source line, and nothing goes ahead.
- **Visible:** the `print-outline` output for `lab-work/missing-close.md`, ending with `UNCLOSED_SECTION at line 381` and its message. If it fits, include the estimator's refusal too.
- **Exclude:** personal paths in the prompt.
- **Filename:** `lab-03-unclosed-section-diagnostic.png`
- **Alt text:** "Terminal output showing one error, UNCLOSED_SECTION at line 381: the ONSET section opened on line 381 was not closed before the heading on line 388."

### 4. Default estimator output

- **Exercise:** [4](../04-estimate-production.md)
- **Demonstrates:** spoken words and narration estimates at the default assumptions.
- **Visible:** `lab-work/estimate-140.json` open at `config`, the Stage 2, Video 2 entry, and `totals` (1978 spoken words), or the baseline table.
- **Exclude:** nothing private is expected. Check the editor's title bar for personal paths.
- **Filename:** `lab-04-estimate-default.png`
- **Alt text:** "Estimator output at 140 words per minute: Stage 2, Video 2 has 664 spoken words, an estimate of about 284.57 seconds, and a long-video warning."

### 5. Changed estimator configuration

- **Exercise:** [4](../04-estimate-production.md)
- **Demonstrates:** changing an assumption changes the calculations and not the counts.
- **Visible:** the `git diff --no-index` of the 140 and 160 words-per-minute estimates, or the baseline and 60-second-allowance results side by side, showing that Stage 1, Video 2 is flagged and Stage 2, Video 1 sits at exactly 180 s.
- **Exclude:** personal paths.
- **Filename:** `lab-05-estimate-comparison.png`
- **Alt text:** "Side-by-side estimates. Word counts are identical, while durations change. With a 60-second screencast allowance, Stage 1, Video 2 is flagged and Stage 2, Video 1 lands exactly on the 3-minute threshold."

### 6. Google Apps Script validation

- **Exercise:** [6](../06-google-docs-extension.md), steps 5 and 6
- **Demonstrates:** the same parser and estimator running in Apps Script and reporting READY.
- **Visible:** the Execution log with the stage, video, and section counts, the structure check, `READY`, the course estimate, and the warning.
- **Exclude:** the `Master document:` line's URL (blur the ID), the account avatar, and the project's script ID in the browser address bar.
- **Filename:** `lab-06-apps-script-validation.png`
- **Alt text:** "Apps Script execution log for validateMasterDocument: 2 stages, 6 videos, 13 sections, structure matches, READY, 1978 spoken words, and one long-video warning."

### 7. Generated Drive folder

- **Exercise:** [6](../06-google-docs-extension.md), step 9 (and step 11 for two folders)
- **Demonstrates:** each run creates its own folder with four documents and a manifest. With two folders, it shows the earlier run is kept.
- **Visible:** the folder name (`Digital Cellar Production — <timestamp> — <run id>`) and its five files.
- **Exclude:** the address bar (folder ID), other Drive files, the sharing panel, and the account avatar.
- **Filename:** `lab-07-generated-folder.png`
- **Alt text:** "A Google Drive run folder containing the ONSET, MOTION, SCREENCAST, and Production Summary documents and manifest.json."

### 8. ONSET output

- **Exercise:** [6](../06-google-docs-extension.md), step 9
- **Demonstrates:** the presenter's document contains only narration and pauses.
- **Visible:** Stage 2, Video 2 with `Part 1 of 2`, a compact `[PAUSE]` cue, and the revised status-code sentence.
- **Exclude:** the address bar, the account avatar, and the comment and sharing panels.
- **Filename:** `lab-08-onset-output.png`
- **Alt text:** "The generated ONSET document showing Stage 2, Video 2, Part 1 of 2: narration paragraphs with a bold PAUSE cue between them."

### 9. MOTION output

- **Exercise:** [6](../06-google-docs-extension.md), step 9
- **Demonstrates:** the motion designer's document contains only MOTION sections.
- **Visible:** one video's `VISUAL` (gray italic) and `VOICEOVER` (plain) blocks with their bold labels.
- **Exclude:** as for item 8.
- **Filename:** `lab-09-motion-output.png`
- **Alt text:** "The generated MOTION document showing VISUAL instructions in gray italics and VOICEOVER narration in plain text, each with a bold label."

### 10. SCREENCAST output

- **Exercise:** [6](../06-google-docs-extension.md), step 9
- **Demonstrates:** screen-recording instructions, with technical examples set apart. This is a Phase 4b presentation change that hasn't been live-verified yet.
- **Visible:** an `ACTION` lead-in such as `Run:` followed by the monospaced, indented `curl` command, or a monospaced JSON response body, and a nearby `[PAUSE]` cue.
- **Exclude:** as for item 8.
- **Filename:** `lab-10-screencast-output.png`
- **Alt text:** "The generated SCREENCAST document showing an ACTION instruction ending in 'Run:' followed by a curl command in a monospaced, indented font."

### 11. Production Summary

- **Exercise:** [6](../06-google-docs-extension.md), step 9
- **Demonstrates:** an estimate built from the script, with its assumptions stated.
- **Visible:** the course overview and the **Video overview** table, with Stage 2, Video 2 marked `Over`. A second image of the Warnings and methodology sections is welcome.
- **Exclude:** the source document link (blur its ID), the address bar, and the account avatar.
- **Filename:** `lab-11-production-summary.png`
- **Alt text:** "The generated Production Summary showing the course overview and a six-row video overview table, with Stage 2, Video 2 marked Over the 3-minute threshold."

### 12. Manifest

- **Exercise:** [5](../05-provenance-and-regeneration.md) (example) or [6](../06-google-docs-extension.md), step 10 (live)
- **Demonstrates:** provenance: the source hash, the parser and estimator hashes and configuration, and the output documents.
- **Visible:** `source`, `parser`, `estimator`, and the start of `output.documents`. **Say in the caption whether it's the instructional example or a live manifest.** Only a live manifest is evidence of a live run.
- **Exclude:** for a live manifest, every `documentId`, `folderId`, `id`, and URL (blur them) and `documentTitle` if it's personal.
- **Filename:** `lab-12-manifest-example.png` or `lab-12-manifest-live.png`
- **Alt text:** "A generation manifest (schema version 2) showing the source text SHA-256, the parser and estimator versions and hashes, the estimator configuration, and the list of output documents."

## Publishing screenshots

Add images to `docs/screenshots/` in a pull request, update the **Status** column above, and reference them from the lab pages or the [lab home page](../../index.md#screenshots). Before merging, a reviewer should open each image at full size and check it for anything listed under **Exclude**.
