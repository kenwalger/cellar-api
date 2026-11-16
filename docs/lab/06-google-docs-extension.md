# Exercise 6 (optional): Generate the Google Docs

**Time:** 45 to 60 minutes, most of it one-time setup
**Objective:** run the complete workflow in Google: validate a master Google Doc, generate the four role documents and the manifest, and confirm that regenerating leaves earlier runs alone.
**Prerequisites:** the core lab, and a Google account with Google Docs, Google Drive, and Apps Script ([script.google.com](https://script.google.com)). No paid services are involved.

The setup reference is [`apps-script/README.md`](../../apps-script/README.md). This exercise follows it step by step and tells you what to look for. Use a personal account where you're comfortable authorizing your own script.

> **Verification status.** The project owner reported successful live runs of the three role documents (Phase 3B) and of the Production Summary (Phase 4, run `6146a211`). The Phase 4b presentation changes haven't been checked in a live Google account yet: monospaced examples, compact `[PAUSE]` cues, the video overview table, and the revised narration. Formatting and permissions can't be fully checked by offline tests, so **what you see in steps 9 and 10 is real evidence.** If something differs from this page, please open an issue with a screenshot (with private details removed).

## Steps

1. **Create the master Google Doc.** Follow [step 1 of the setup](../../apps-script/README.md#1-create-the-master-google-doc): paste `course/master-script.md` as **plain text** (Ctrl+Shift+V, or ⌘+Shift+V on a Mac) into a new Google Doc. Name it `Digital Cellar - Master Production Script`. Because you're pasting the current repository script, it already has the revised status-code narration. The rename and find-and-replace steps in the Phase 4b checklist are only for documents pasted before that change.

2. **Create the Apps Script project.** Follow [step 2](../../apps-script/README.md#2-create-the-apps-script-project).

3. **Install the source files.** Follow [step 3](../../apps-script/README.md#3-add-the-script-files). Copying and pasting the twelve files takes about 10 minutes, and clasp is optional. Then set `MASTER_DOCUMENT_ID` to your document's URL, as described in [step 4](../../apps-script/README.md#4-configure-the-master-document). Leave the estimator properties unset to use the defaults.

4. **Review the permissions.** Run `validateMasterDocument` once to trigger authorization ([step 5](../../apps-script/README.md#5-authorize)). Read the consent screen. The project asks for exactly two scopes: **documents**, to read the master and write the outputs, and **drive**, to create the run folder and the manifest. Google warns that the app isn't verified, because it's your own unpublished script. The warning is expected.

5. **Validate.** Run `validateMasterDocument` and open the **Execution log**. It makes no writes.

6. **Confirm the validation result.** *Expected:* the log shown in [step 6](../../apps-script/README.md#6-validate): `Stages: 2, videos: 6, sections: 13`, a matching structure, `READY`, six per-video estimate lines with `Stage 2, Video 2 "Handling Errors": 664 spoken words, estimated 4 min 45 s`, `Course estimate: 1978 spoken words, 14 min 8 s across 6 videos.`, and one `LONG_VIDEO_ESTIMATE` warning. These are the same numbers you calculated locally in Exercise 4.

7. *Optional:* **Block a run.** In the master Doc, change one `[/MOTION]` to `[/MOTON]` and run `generateProductionDocuments`. *Expected:* an `ERROR` line with the line and paragraph number, then *"Generation blocked … No files were created."* Check Drive: there's no new folder. This is the live counterpart of the gate you tested in Exercise 3. Undo the change.

8. **Generate.** Run `generateProductionDocuments`. *Expected:* `COMPLETE: run <id>` and five links: the four documents and the manifest ([step 8](../../apps-script/README.md#8-generate)).

9. **Inspect the folder and open all four documents.** The folder is named `Digital Cellar Production — <UTC timestamp> — <run id>`, in My Drive by default ([step 9](../../apps-script/README.md#9-find-the-output-folder)). Check each document against the [rendering rules](../../apps-script/README.md#10-inspect-the-documents-and-manifest):
   - **ONSET:** narration only, no `ACTION` or `VISUAL` text. Stage 2, Video 2 shows `Part 1 of 2` and `Part 2 of 2`.
   - **MOTION:** `VISUAL`, `VOICEOVER`, and `HIGHLIGHT` blocks only.
   - **SCREENCAST:** the four JSON bodies and two `curl` commands that follow a colon lead-in (`Run:`, `The response body:`) are in a **monospaced** font, upright and indented, and character-for-character identical to the script.
   - **`[PAUSE]` spacing:** in ONSET and SCREENCAST, each `[PAUSE]` is bold dark red and sits directly between its neighbors, with a small, even gap and no empty paragraphs around it.
   - **Production Summary:** a **Video overview** table follows the course overview, with six rows, and only `S2 V2 — Handling Errors` reads `Over`. Stage 1, Video 2's breakdown says `includes 1 URL, path, or code token`, in the singular.
   - **Revised narration:** in ONSET, Stage 2, Video 2's first section says the 400s "generally mean the server can't or won't fulfill the client's request".
   - **Source title:** each document's provenance line shows `Digital Cellar - Master Production Script`, spelled the way you named the document.

10. **Inspect `manifest.json`.** Open it from the folder. Compare it with the [example manifest](examples/example-manifest-run-1.json) from Exercise 5. It has the same structure, but now with real IDs and URLs, your document's title, a real run ID, and an `extractedTextSha256` for the text your Doc produced. Check that `parser.coreSha256` and `estimator.coreSha256` equal the values in `apps-script/GeneratedData.js`.

11. **Regenerate and confirm the first run is unchanged.** Change one sentence of narration in the master Doc and run `generateProductionDocuments` again ([steps 11 and 12](../../apps-script/README.md#11-and-12-edit-regenerate-and-confirm-earlier-runs-are-unchanged)). *Expected:* a second folder with a new run ID. The first run's documents still have the old sentence, and the two manifests have different `source.extractedTextSha256` values. Undo your edit in the master Doc afterwards. The documents you generated stay as they are.

12. *Optional:* **Change an assumption in Google.** These are the Exercise 4 experiments, run in Apps Script. In **Project Settings** → **Script properties**, set `WORDS_PER_MINUTE` to `160` and generate. Open the new Production Summary next to an earlier one. *Expected:* identical word and section counts, with shorter durations. Then delete that property, set `SCREENCAST_ALLOWANCE_SECONDS_PER_SECTION` to `60`, and generate again. *Expected:* two warnings, for Stage 1, Video 2 and Stage 2, Video 2, and none for Stage 2, Video 1 at exactly 3 min 0 s. The methodology section describes the allowance as an assumption. Delete the property afterwards to go back to the defaults.

## Expected results

- Validation reports 2 stages, 6 videos, 13 sections, READY, 1978 spoken words, and one warning.
- A run folder holds four documents and `manifest.json`, each document has only its own role's content, and the formatting checks in step 9 hold.
- A second run creates a second folder and leaves the first one unchanged.

## Reflection

- In step 9, which checks could the offline tests already have told you, and which could only be confirmed by looking at the real document?
- Your master Doc and `course/master-script.md` are now separate copies. If you fixed a typo in one, what would it take for the other, and for already generated documents, to pick it up?

## Evidence to capture

Screenshots 6 to 12 in the [evidence guide](evidence/README.md): the validation log, the generated folder, the four documents, and the manifest. **Before sharing any screenshot, hide document and folder IDs, URLs, your email address, and your account avatar.**

## Completion criterion

Your Drive has two run folders from this exercise, each with four documents and a manifest. You've checked every item in step 9, and you've noted anything that didn't match.
