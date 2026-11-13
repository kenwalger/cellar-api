Malformed script fixtures

Each case below is a self-contained mini-script with exactly one intentional defect. Cases are separated by delimiter lines of the form "=== Case N: case-id ===". A test should split the file on those lines and validate each case on its own. Expected failures are documented in course/fixtures/README.md.

Do not repair these cases. They are invalid on purpose.

=== Case 1: missing-closing-tag ===

Stage 1: Fixture Stage

Video 1: Unclosed Section

[ONSET]

This narration opens an ONSET section that is never closed.

The case ends here without an ONSET closing tag.

=== Case 2: unexpected-closing-tag ===

Stage 1: Fixture Stage

Video 1: Stray Closing Tag

[ONSET]

This section is opened and closed correctly.

[/ONSET]

[/SCREENCAST]

=== Case 3: nested-section ===

Stage 1: Fixture Stage

Video 1: Nested Section

[ONSET]

This narration is inside an ONSET section.

[MOTION]

[VISUAL]

A MOTION section opened before the ONSET section was closed.

[VOICEOVER]

This voiceover belongs to a nested section.

[/MOTION]

[/ONSET]

=== Case 4: unknown-annotation ===

Stage 1: Fixture Stage

Video 1: Unknown Annotation

[SCREENCAST]

[ACTION]

Open http://127.0.0.1:8000/docs.

[NARRATION]

NARRATION is not a supported annotation. Spoken narration uses VOICEOVER.

[/SCREENCAST]
