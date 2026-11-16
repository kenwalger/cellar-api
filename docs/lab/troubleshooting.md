# Troubleshooting

## Local exercises

### `node --version` is older than 22

The parser, estimator, and tests need Node.js 22 or newer. Install a current LTS release from [nodejs.org](https://nodejs.org/) or with your version manager, then open a new terminal.

### `npm test` fails right after cloning

There's nothing to install, so `npm install` won't help. Check that you're in the right folder (`parser/`, `production/`, or `apps-script/`) and that your Node.js version is 22 or newer. If one test fails, keep the full output and [open an issue](https://github.com/kenwalger/cellar-api/issues).

### Windows: PowerShell and cmd

The commands are written for a POSIX shell. On Windows, use **Git Bash**, which comes with Git for Windows. If you use Windows PowerShell 5.1 anyway, three things go wrong:

- **JSON options lose their quotes.** `'{"wordsPerMinute": 160}'` reaches Node as `{wordsPerMinute: 160}`, and the estimator fails with a JSON `SyntaxError`. Escape the inner quotes: `'{\"wordsPerMinute\": 160}'`. PowerShell 7.3 and later pass the original form correctly.
- **`>` writes UTF-16.** The saved JSON files are then encoded as UTF-16, and `git diff` treats them as binary. Use `| Out-File -Encoding utf8 ../lab-work/estimate-140.json` instead of `>`.
- **`cp`, `mkdir -p`, and `sha256sum` differ.** Use `Copy-Item`, `New-Item -ItemType Directory -Force lab-work`, and `Get-FileHash -Algorithm SHA256 <file>`. `Get-FileHash` prints the hash in upper case.

### My output doesn't match the page

- Check that you're on the latest commit (`git pull`) and that `course/master-script.md` is unchanged (`git status --short course/`).
- In Exercise 3, check that you deleted line 387, the `[/ONSET]` just above `Video 3: Wrapping Up`, and nothing else. If your editor removed the blank line too, the heading moves up a line, and the message says `line 387` instead of `line 388`.
- If the hashes in Exercise 5 don't match, check whether your checkout has Windows line endings. The repository's `.gitattributes` asks Git for LF endings. A file converted to CRLF hashes differently. Run `git ls-files --eol course/master-script.md`. The working-tree value (`w/`) should be `lf`.

### `git diff --no-index` prints a diff and "fails"

It exits with status 1 whenever the files differ. That's expected in Exercises 4 and 5. In Exercise 2, `&& echo identical` prints only when the files are the same.

### `print-outline` or `print-estimate` exits with status 1

That's the intended result for a script with errors (Exercise 3). The diagnostics above the exit explain why.

### The estimator prints a `RangeError`

The options were rejected. Look for a typo in an option name (such as `wordsPerMinuet`), a value of 0 or less, or a value that isn't a number. The estimator never falls back to defaults.

## Google Docs extension

These cover the most common problems. The full reference is [`apps-script/README.md`](../../apps-script/README.md).

| Symptom | Likely cause | What to do |
|---|---|---|
| *"Google hasn't verified this app"* | Your own unpublished script | Expected. Choose **Advanced**, then **Go to … (unsafe)**. It's your project. |
| Configuration error naming `MASTER_DOCUMENT_ID` | The property is missing, or it isn't a Doc URL or ID | Set it in **Project Settings** → **Script properties** |
| Configuration error naming `WORDS_PER_MINUTE` (or another estimator property) | A value such as `140 wpm`, `0`, or `1e3` | Use a plain number, or delete the property to use the default |
| `STRUCTURE_MISMATCH` | The paste didn't reproduce the six-video course, for example because Markdown paste was used | Paste again with **Ctrl+Shift+V** (plain text) into an empty document |
| `UNSUPPORTED_ELEMENT` or `UNSUPPORTED_INLINE_ELEMENT` | A table, image, smart chip, or similar was added | Remove it. The master document must be plain paragraphs. |
| `MULTIPLE_TABS` | The document has more than one tab | Move everything into one tab |
| No new folder after a run | The run was blocked by an error, which is by design, or `OUTPUT_FOLDER_ID` points somewhere else | Read the log's `ERROR` lines, and check the output folder setting |
| A run folder ends in ` — FAILED` | A Drive or Docs call failed partway through | Read the error in the log and in that folder's `manifest.json`, then run again. Nothing is deleted or reused. |
| Formatting looks different from the descriptions in Exercise 6 | The Phase 4b presentation changes haven't been live-verified yet | Take a redacted screenshot and open an issue. That's useful evidence. |
