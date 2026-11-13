# course/fixtures/

Test fixtures for the parser in [`parser/`](../../parser), which `parser/tests/fixtures.test.js` runs against them. The grammar they test is defined in [`../README.md`](../README.md#script-grammar).

## expected-structure.json

This file is the structural oracle for [`../master-script.md`](../master-script.md). For each stage it lists the number, the title, and the videos. For each video it lists the number, the title, and `sections`, the exact sequence of production sections, including repeats (Stage 2, Video 2 has two ONSET sections).

The file was written from the course outline before the script was finished. **Don't regenerate it from the script.** If the course outline changes on purpose, edit this file by hand and then confirm that the script still matches.

A parser passes when the structure it extracts from the master script matches this file exactly.

## malformed-script.md

The file contains four isolated cases, each a small script with exactly one intentional defect. Cases are separated by delimiter lines:

```text
=== Case N: case-id ===
```

The delimiter belongs to this fixture file only and is not part of the script grammar. Tests should split the file on these lines and validate each case separately.

| Case | `case-id` | Defect | Expected failure |
|---|---|---|---|
| 1 | `missing-closing-tag` | `[ONSET]` is opened and the case ends without `[/ONSET]` | **Unclosed section**: ONSET, reported at its opening tag |
| 2 | `unexpected-closing-tag` | A `[/SCREENCAST]` appears when no section is open | **Unexpected closing tag**: SCREENCAST |
| 3 | `nested-section` | `[MOTION]` opens while `[ONSET]` is still open | **Nested section**: MOTION opened inside ONSET |
| 4 | `unknown-annotation` | `[NARRATION]` inside a SCREENCAST section | **Unknown annotation**: NARRATION |

The expected failure must be the **first** error reported for its case. A parser may report follow-on errors after it. For example, in case 3 a parser might also report the annotations and closing tag that follow the nested opening tag. Tests should assert on the first error and shouldn't depend on any follow-on errors.

These cases must stay invalid. Don't fix them, and don't let a parser repair them silently. A parser should report the problem.
